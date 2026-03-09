import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CanvasTexture,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  PerspectiveCamera,
  Plane,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3
} from 'three';
import {
  CHECKER_SIZE,
  FACE_VARIANTS,
  PLAYER_COLLISION_DISTANCE,
  PLAYER_DASH_DURATION_MS,
  PLAYER_DASH_SPEED,
  PLAYER_HEIGHT,
  PLAYER_INSPECT_DURATION_MS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../shared/gameConfig.js';
import {
  CITY_BENCHES,
  CITY_BUILDINGS,
  CITY_OBSTACLES,
  CITY_PLAZAS,
  CITY_ROADS,
  CITY_TREES
} from '../shared/cityLayout.js';

const CAMERA_FOV = 46;
const CAMERA_OFFSET = new Vector3(0, 390, 250);
const CAMERA_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const CAMERA_CORNERS = [
  new Vector2(-1, -1),
  new Vector2(1, -1),
  new Vector2(-1, 1),
  new Vector2(1, 1)
];
const TILES_PER_TEXTURE = 4;
const FACE_SIZE = 26;
const CHAT_BUBBLE_MAX_WIDTH = 420;
const CHAT_BUBBLE_SCALE = 0.15;
const INFO_BUBBLE_SCALE = 0.105;
const MAX_DASH_PARTICLES = 28;
const MAX_COLLISION_PARTICLES = 84;
const DASH_TRAIL_LIFETIME_MS = 240;
const COLLISION_SPARK_LIFETIME_MS = 260;
const COLLISION_EVENT_COOLDOWN_MS = 90;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ease(current, target, delta, strength) {
  return MathUtils.lerp(current, target, 1 - Math.exp(-delta * strength));
}

function lightenColor(baseColor, amount) {
  return `#${new Color(baseColor).lerp(new Color('#ffffff'), amount).getHexString()}`;
}

function createParticlePool(size) {
  return Array.from({ length: size }, () => ({
    active: false,
    bornAt: 0,
    color: '#ffffff',
    life: 0,
    scale: 1,
    startScale: 1,
    endScale: 0.1,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0
  }));
}

function createSpriteCanvasTexture(draw, width, height) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;

  if (!context) {
    return new Texture();
  }

  draw(context, canvas);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createSoftCircleTexture() {
  return createSpriteCanvasTexture((context, canvas) => {
    const gradient = context.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      12,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.58, 'rgba(255, 255, 255, 0.84)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, 128, 128);
}

function resolveLocalCollision(selfState, otherState) {
  let dx = selfState.x - otherState.x;
  let dz = selfState.z - otherState.z;
  let distance = Math.hypot(dx, dz);

  if (distance >= PLAYER_COLLISION_DISTANCE) {
    return;
  }

  if (distance < 0.0001) {
    dx = 1;
    dz = 0;
    distance = 1;
  }

  const overlap = PLAYER_COLLISION_DISTANCE - distance;
  const normalX = dx / distance;
  const normalZ = dz / distance;

  selfState.x = clamp(
    selfState.x + normalX * overlap,
    PLAYER_RADIUS,
    WORLD_WIDTH - PLAYER_RADIUS
  );
  selfState.z = clamp(
    selfState.z + normalZ * overlap,
    PLAYER_RADIUS,
    WORLD_HEIGHT - PLAYER_RADIUS
  );
}

function createFloorTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 512;
  canvas.height = 512;

  if (!context) {
    return new Texture();
  }

  const tileSize = canvas.width / TILES_PER_TEXTURE;
  const grout = 8;

  context.fillStyle = '#16262d';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < TILES_PER_TEXTURE; row += 1) {
    for (let column = 0; column < TILES_PER_TEXTURE; column += 1) {
      const offsetX = column * tileSize;
      const offsetY = row * tileSize;
      const evenTile = (row + column) % 2 === 0;
      const gradient = context.createLinearGradient(
        offsetX,
        offsetY,
        offsetX + tileSize,
        offsetY + tileSize
      );

      gradient.addColorStop(0, evenTile ? '#274852' : '#23414a');
      gradient.addColorStop(1, evenTile ? '#223c45' : '#1d363f');

      context.fillStyle = gradient;
      context.fillRect(
        offsetX + grout,
        offsetY + grout,
        tileSize - grout * 2,
        tileSize - grout * 2
      );

      context.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      context.lineWidth = 2;
      context.strokeRect(
        offsetX + grout + 1,
        offsetY + grout + 1,
        tileSize - grout * 2 - 2,
        tileSize - grout * 2 - 2
      );

      context.fillStyle = 'rgba(255, 255, 255, 0.022)';
      context.fillRect(
        offsetX + grout + 10,
        offsetY + grout + 10,
        tileSize - grout * 2 - 20,
        10
      );
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(
    WORLD_WIDTH / (CHECKER_SIZE * TILES_PER_TEXTURE),
    WORLD_HEIGHT / (CHECKER_SIZE * TILES_PER_TEXTURE)
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;

  return texture;
}

function createDisplayState(player) {
  return {
    x: player.x,
    z: player.y,
    vx: 0,
    vz: 0,
    tiltX: 0,
    tiltZ: 0,
    bobSeed: Math.random() * Math.PI * 2
  };
}

function drawFaceFeatures(context, variant) {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#061015';
  context.fillStyle = '#061015';

  switch (variant) {
    case 1:
      context.lineWidth = 10;
      context.beginPath();
      context.arc(128, 146, 44, 0.2, Math.PI - 0.2);
      context.stroke();
      break;
    case 2:
      context.lineWidth = 8;
      context.beginPath();
      context.arc(128, 152, 36, Math.PI + 0.2, Math.PI * 2 - 0.2);
      context.stroke();
      break;
    case 3:
      context.lineWidth = 8;
      context.beginPath();
      context.moveTo(84, 146);
      context.quadraticCurveTo(128, 118, 172, 146);
      context.stroke();
      break;
    case 4:
      context.lineWidth = 8;
      context.beginPath();
      context.moveTo(88, 154);
      context.lineTo(168, 154);
      context.stroke();
      break;
    case 5:
      context.lineWidth = 8;
      context.beginPath();
      context.arc(128, 150, 34, 0.15, Math.PI - 0.15);
      context.stroke();
      context.beginPath();
      context.moveTo(108, 150);
      context.lineTo(108, 168);
      context.moveTo(148, 150);
      context.lineTo(148, 168);
      context.stroke();
      break;
    case 6:
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(86, 154);
      context.quadraticCurveTo(106, 132, 126, 154);
      context.quadraticCurveTo(148, 132, 170, 154);
      context.stroke();
      break;
    case 7:
      context.lineWidth = 8;
      context.beginPath();
      context.arc(128, 146, 42, 0.12, Math.PI - 0.12);
      context.stroke();
      context.fillStyle = '#ffeef4';
      context.fillRect(104, 148, 48, 16);
      break;
    case 8:
      context.lineWidth = 8;
      context.beginPath();
      context.moveTo(88, 152);
      context.quadraticCurveTo(128, 170, 168, 152);
      context.stroke();
      context.beginPath();
      context.moveTo(98, 106);
      context.lineTo(114, 116);
      context.moveTo(142, 116);
      context.lineTo(158, 106);
      context.stroke();
      break;
    case 9:
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(90, 152);
      context.bezierCurveTo(110, 132, 146, 172, 166, 152);
      context.stroke();
      context.beginPath();
      context.moveTo(92, 110);
      context.quadraticCurveTo(108, 98, 120, 110);
      context.moveTo(136, 110);
      context.quadraticCurveTo(148, 98, 164, 110);
      context.stroke();
      break;
    default:
      context.lineWidth = 8;
      context.beginPath();
      context.arc(128, 146, 40, 0.15, Math.PI - 0.15);
      context.stroke();
  }
}

function createFaceTextures() {
  return Array.from({ length: FACE_VARIANTS }, (_, index) => {
    const variant = index + 1;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = 256;
    canvas.height = 256;

    if (!context) {
      return new Texture();
    }

    const gradient = context.createRadialGradient(110, 86, 24, 128, 128, 128);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#d9f7ff');

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(0, 0, 0, 0.22)';
    context.beginPath();
    context.ellipse(128, 216, 64, 20, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(128, 118, 84, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = 'rgba(0, 18, 28, 0.35)';
    context.lineWidth = 8;
    context.stroke();

    context.fillStyle = '#061015';
    context.beginPath();
    context.arc(94, 102, 11, 0, Math.PI * 2);
    context.arc(162, 102, 11, 0, Math.PI * 2);
    context.fill();

    drawFaceFeatures(context, variant);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.needsUpdate = true;

    return texture;
  });
}

function wrapText(context, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function createBubbleTexture({
  text,
  font,
  maxWidth,
  minWidth,
  paddingX,
  lineHeight,
  radius,
  scale,
  canvasWidth,
  canvasHeight,
  bubbleColor,
  borderColor,
  tailSize = 24,
  maxBubbleWidth
}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  if (!context) {
    return {
      texture: new Texture(),
      width: 36,
      height: 18
    };
  }

  context.font = font;
  const lines = wrapText(context, text, maxWidth);
  const contentWidth = Math.max(
    ...lines.map((line) => context.measureText(line).width),
    minWidth
  );
  const bubbleWidth = Math.min(maxBubbleWidth, contentWidth + paddingX * 2);
  const bubbleHeight = Math.min(
    canvasHeight - 56,
    lines.length * lineHeight + 48
  );
  const bubbleX = (canvas.width - bubbleWidth) / 2;
  const bubbleY = 18;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(0, 0, 0, 0.22)';
  context.beginPath();
  context.ellipse(
    canvas.width / 2,
    bubbleHeight + 60,
    bubbleWidth * 0.3,
    18,
    0,
    0,
    Math.PI * 2
  );
  context.fill();

  context.fillStyle = bubbleColor;
  context.strokeStyle = borderColor;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(bubbleX + radius, bubbleY);
  context.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
  context.quadraticCurveTo(
    bubbleX + bubbleWidth,
    bubbleY,
    bubbleX + bubbleWidth,
    bubbleY + radius
  );
  context.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
  context.quadraticCurveTo(
    bubbleX + bubbleWidth,
    bubbleY + bubbleHeight,
    bubbleX + bubbleWidth - radius,
    bubbleY + bubbleHeight
  );
  context.lineTo(canvas.width / 2 + tailSize, bubbleY + bubbleHeight);
  context.lineTo(canvas.width / 2, bubbleY + bubbleHeight + tailSize + 4);
  context.lineTo(canvas.width / 2 - tailSize, bubbleY + bubbleHeight);
  context.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
  context.quadraticCurveTo(
    bubbleX,
    bubbleY + bubbleHeight,
    bubbleX,
    bubbleY + bubbleHeight - radius
  );
  context.lineTo(bubbleX, bubbleY + radius);
  context.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = '#f1fff8';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  lines.forEach((line, index) => {
    context.fillText(
      line,
      canvas.width / 2,
      bubbleY +
        bubbleHeight / 2 -
        (lines.length - 1) * (lineHeight / 2) +
        index * lineHeight
    );
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;

  return {
    texture,
    width: bubbleWidth * scale,
    height: (bubbleHeight + tailSize + 20) * scale
  };
}

function createChatBubbleTexture(message) {
  return createBubbleTexture({
    text: message,
    font: '700 62px "Segoe UI", sans-serif',
    maxWidth: CHAT_BUBBLE_MAX_WIDTH,
    minWidth: 140,
    paddingX: 44,
    lineHeight: 68,
    radius: 26,
    scale: CHAT_BUBBLE_SCALE,
    canvasWidth: 640,
    canvasHeight: 320,
    bubbleColor: 'rgba(8, 17, 22, 0.92)',
    borderColor: 'rgba(214, 255, 244, 0.18)',
    maxBubbleWidth: 580
  });
}

function createInfoBubbleTexture(name) {
  return createBubbleTexture({
    text: name,
    font: '700 40px "Segoe UI", sans-serif',
    maxWidth: 320,
    minWidth: 120,
    paddingX: 34,
    lineHeight: 46,
    radius: 22,
    scale: INFO_BUBBLE_SCALE,
    canvasWidth: 512,
    canvasHeight: 220,
    bubbleColor: 'rgba(8, 17, 22, 0.88)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    tailSize: 18,
    maxBubbleWidth: 420
  });
}

function ChatBubble({ message, expiresAt }) {
  const bubble = useMemo(() => createChatBubbleTexture(message), [message]);

  useEffect(() => () => {
    bubble.texture.dispose();
  }, [bubble]);

  if (!message || expiresAt <= Date.now()) {
    return null;
  }

  return (
    <sprite
      position={[0, PLAYER_HEIGHT + 58, 0]}
      scale={[bubble.width, bubble.height, 1]}
    >
      <spriteMaterial
        alphaTest={0.06}
        depthWrite={false}
        map={bubble.texture}
        toneMapped={false}
        transparent
      />
    </sprite>
  );
}

function circleIntersectsRect(x, z, radius, rect) {
  const closestX = clamp(x, rect.x - rect.width / 2, rect.x + rect.width / 2);
  const closestZ = clamp(z, rect.z - rect.depth / 2, rect.z + rect.depth / 2);
  const dx = x - closestX;
  const dz = z - closestZ;

  return dx * dx + dz * dz < radius * radius;
}

function collidesWithMap(x, z, radius) {
  return CITY_OBSTACLES.some((obstacle) =>
    circleIntersectsRect(x, z, radius, obstacle)
  );
}

function resolveLocalMapCollision(displayState, moveX, moveZ) {
  let nextX = clamp(displayState.x + moveX, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
  let nextZ = displayState.z;

  if (collidesWithMap(nextX, nextZ, PLAYER_RADIUS)) {
    nextX = displayState.x;
  }

  nextZ = clamp(displayState.z + moveZ, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);

  if (collidesWithMap(nextX, nextZ, PLAYER_RADIUS)) {
    nextZ = displayState.z;
  }

  displayState.x = nextX;
  displayState.z = nextZ;
}

function InfoBubble({ name, visible }) {
  const bubble = useMemo(() => createInfoBubbleTexture(name), [name]);

  useEffect(
    () => () => {
      bubble.texture.dispose();
    },
    [bubble]
  );

  if (!visible || !name) {
    return null;
  }

  return (
    <sprite
      position={[0, PLAYER_HEIGHT + 56, 0]}
      scale={[bubble.width, bubble.height, 1]}
    >
      <spriteMaterial
        alphaTest={0.06}
        depthWrite={false}
        map={bubble.texture}
        toneMapped={false}
        transparent
      />
    </sprite>
  );
}

function ParticleLayer({ particlePoolRef, meshRefs, texture }) {
  const particleCount = particlePoolRef.current.length;

  return (
    <>
      {Array.from({ length: particleCount }, (_, index) => (
        <sprite
          key={index}
          ref={(node) => {
            meshRefs.current[index] = node;
          }}
          visible={false}
        >
          <spriteMaterial
            alphaTest={0.04}
            depthWrite={false}
            map={texture}
            toneMapped={false}
            transparent
          />
        </sprite>
      ))}
    </>
  );
}

function createCameraFootprint(aspect) {
  const probeCamera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 5000);
  const raycaster = new Raycaster();
  const intersections = [];

  probeCamera.position.copy(CAMERA_OFFSET);
  probeCamera.lookAt(0, 0, 0);
  probeCamera.updateProjectionMatrix();
  probeCamera.updateMatrixWorld();

  for (const corner of CAMERA_CORNERS) {
    raycaster.setFromCamera(corner, probeCamera);
    const hit = raycaster.ray.intersectPlane(CAMERA_PLANE, new Vector3());

    if (hit) {
      intersections.push(hit);
    }
  }

  return {
    minX: Math.min(...intersections.map((point) => point.x)),
    maxX: Math.max(...intersections.map((point) => point.x)),
    minZ: Math.min(...intersections.map((point) => point.z)),
    maxZ: Math.max(...intersections.map((point) => point.z))
  };
}

function RoadSegment({ x, z, width, depth, lane }) {
  const stripeCount = Math.max(
    3,
    Math.floor((lane === 'horizontal' ? width : depth) / 160)
  );

  return (
    <group>
      <mesh position={[x, 0.65, z]} receiveShadow>
        <boxGeometry args={[width, 1.3, depth]} />
        <meshPhongMaterial color="#182932" shininess={10} />
      </mesh>

      {Array.from({ length: stripeCount }, (_, index) => {
        const offset =
          ((index / Math.max(1, stripeCount - 1)) - 0.5) *
          ((lane === 'horizontal' ? width : depth) - 120);
        const stripePosition =
          lane === 'horizontal'
            ? [x + offset, 1.15, z]
            : [x, 1.15, z + offset];
        const stripeSize =
          lane === 'horizontal' ? [38, 8, 1] : [8, 38, 1];

        return (
          <mesh
            key={`${x}-${z}-${index}`}
            position={stripePosition}
          >
            <boxGeometry args={[stripeSize[0], 0.5, stripeSize[1]]} />
            <meshBasicMaterial color="#d7eee6" opacity={0.68} transparent />
          </mesh>
        );
      })}
    </group>
  );
}

function BuildingLot({ x, z, width, depth, height, body, cap }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshPhongMaterial color={body} shininess={28} />
      </mesh>

      <mesh position={[0, height + 8, 0]}>
        <boxGeometry args={[width * 0.82, 14, depth * 0.82]} />
        <meshPhongMaterial color={cap} shininess={60} />
      </mesh>

      <mesh position={[0, 18, depth / 2 + 0.4]}>
        <boxGeometry args={[width * 0.18, 28, 2]} />
        <meshBasicMaterial color="#d8f8ff" opacity={0.52} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function HouseLot({ x, z, width, depth, height, body, roof }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshPhongMaterial color={body} shininess={18} />
      </mesh>

      <mesh position={[0, height + 18, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[Math.max(width, depth) * 0.72, 36, 4]} />
        <meshPhongMaterial color={roof} shininess={10} />
      </mesh>

      <mesh position={[0, 16, depth / 2 + 0.4]}>
        <boxGeometry args={[width * 0.22, 22, 2]} />
        <meshPhongMaterial color="#f7f4db" />
      </mesh>

      <mesh position={[-width * 0.22, 22, depth / 2 + 0.4]}>
        <boxGeometry args={[14, 12, 2]} />
        <meshBasicMaterial color="#d5feff" opacity={0.55} transparent toneMapped={false} />
      </mesh>
      <mesh position={[width * 0.22, 22, depth / 2 + 0.4]}>
        <boxGeometry args={[14, 12, 2]} />
        <meshBasicMaterial color="#d5feff" opacity={0.55} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function Tree({ x, z, scale }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 18, 0]}>
        <cylinderGeometry args={[5, 6, 36, 8]} />
        <meshPhongMaterial color="#4f3624" />
      </mesh>
      <mesh position={[0, 44, 0]}>
        <sphereGeometry args={[20, 10, 10]} />
        <meshPhongMaterial color="#4ac17e" shininess={20} />
      </mesh>
      <mesh position={[-8, 56, 6]}>
        <sphereGeometry args={[15, 10, 10]} />
        <meshPhongMaterial color="#71dd9b" shininess={20} />
      </mesh>
    </group>
  );
}

function Bench({ x, z, rotation }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[34, 4, 10]} />
        <meshPhongMaterial color="#8d694b" />
      </mesh>
      <mesh position={[0, 18, -4]}>
        <boxGeometry args={[34, 4, 4]} />
        <meshPhongMaterial color="#9a7555" />
      </mesh>
      <mesh position={[-12, 5, 0]}>
        <boxGeometry args={[3, 10, 3]} />
        <meshPhongMaterial color="#36444f" />
      </mesh>
      <mesh position={[12, 5, 0]}>
        <boxGeometry args={[3, 10, 3]} />
        <meshPhongMaterial color="#36444f" />
      </mesh>
    </group>
  );
}

function CityScenery() {
  return (
    <>
      {CITY_ROADS.map((road, index) => (
        <RoadSegment key={index} {...road} />
      ))}

      {CITY_PLAZAS.map((plaza, index) => (
        <mesh key={index} position={[plaza.x, 1, plaza.z]}>
          <boxGeometry args={[plaza.width, 2, plaza.depth]} />
          <meshPhongMaterial color={plaza.color} shininess={24} />
        </mesh>
      ))}

      <mesh position={[CITY_PLAZAS[0].x, 12, CITY_PLAZAS[0].z]}>
        <cylinderGeometry args={[54, 62, 24, 24]} />
        <meshPhongMaterial color="#5d7682" shininess={36} />
      </mesh>
      <mesh position={[CITY_PLAZAS[0].x, 34, CITY_PLAZAS[0].z]}>
        <cylinderGeometry args={[20, 28, 20, 20]} />
        <meshPhongMaterial color="#7ee9ff" emissive="#235f69" emissiveIntensity={0.6} />
      </mesh>

      {CITY_BUILDINGS.map((building, index) =>
        building.type === 'tower' || building.type === 'hub' ? (
          <BuildingLot
            key={index}
            body={building.body}
            cap={building.accent}
            depth={building.depth}
            height={building.height}
            width={building.width}
            x={building.x}
            z={building.z}
          />
        ) : (
          <HouseLot
            key={index}
            body={building.body}
            depth={building.depth}
            height={building.height}
            roof={building.roof}
            width={building.width}
            x={building.x}
            z={building.z}
          />
        )
      )}
      {CITY_TREES.map((tree, index) => (
        <Tree key={index} {...tree} />
      ))}
      {CITY_BENCHES.map((bench, index) => (
        <Bench key={index} {...bench} />
      ))}
    </>
  );
}

function PlayerMarker({
  color,
  chatExpiresAt,
  chatMessage,
  face,
  faceTextures,
  inspectionName,
  isSelf,
  onInspect,
  registerBody,
  registerRing,
  registerRoot
}) {
  const topColor = useMemo(() => lightenColor(color, 0.62), [color]);
  const faceTexture = faceTextures[Math.max(0, (face ?? 1) - 1)] ?? faceTextures[0];
  const clickProps = !isSelf
    ? {
        onClick: (event) => {
          event.stopPropagation();
          onInspect();
        }
      }
    : {};

  return (
    <group ref={registerRoot}>
      {chatMessage ? (
        <ChatBubble expiresAt={chatExpiresAt} message={chatMessage} />
      ) : (
        <InfoBubble name={inspectionName} visible={Boolean(inspectionName)} />
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]} {...clickProps}>
        <circleGeometry args={[PLAYER_RADIUS * 1.08, 18]} />
        <meshBasicMaterial
          color="#000000"
          depthWrite={false}
          opacity={0.18}
          transparent
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.24, 0]} {...clickProps}>
        <circleGeometry args={[PLAYER_RADIUS * 1.22, 18]} />
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          opacity={0.32}
          toneMapped={false}
          transparent
        />
      </mesh>

      {isSelf ? (
        <mesh
          ref={registerRing}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.26, 0]}
          renderOrder={1000}
        >
          <ringGeometry args={[PLAYER_RADIUS * 1.35, PLAYER_RADIUS * 1.72, 28]} />
          <meshBasicMaterial
            color="#e8fff3"
            depthTest={false}
            depthWrite={false}
            opacity={0.28}
            toneMapped={false}
            transparent
          />
        </mesh>
      ) : null}

      <group ref={registerBody}>
        <mesh position={[0, PLAYER_HEIGHT / 2, 0]} {...clickProps}>
          <cylinderGeometry args={[PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_HEIGHT, 18]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>

        <mesh position={[0, PLAYER_HEIGHT + 1.25, 0]} {...clickProps}>
          <cylinderGeometry
            args={[PLAYER_RADIUS * 0.88, PLAYER_RADIUS * 0.88, 2.5, 18]}
          />
          <meshBasicMaterial color={topColor} toneMapped={false} />
        </mesh>

        <sprite position={[0, PLAYER_HEIGHT + 23, 0]} scale={[FACE_SIZE, FACE_SIZE, 1]}>
          <spriteMaterial
            alphaTest={0.08}
            depthWrite={false}
            map={faceTexture}
            toneMapped={false}
            transparent
          />
        </sprite>
      </group>
    </group>
  );
}

function World({
  inputRef,
  playersRef,
  roster,
  selfId,
  inspectedPlayerId,
  onInspectPlayer
}) {
  const { camera, gl, size } = useThree();
  const floorTexture = useMemo(() => createFloorTexture(), []);
  const faceTextures = useMemo(() => createFaceTextures(), []);
  const particleTexture = useMemo(() => createSoftCircleTexture(), []);
  const playerRefs = useRef(new Map());
  const displayStateRef = useRef(new Map());
  const dashParticlePoolRef = useRef(createParticlePool(MAX_DASH_PARTICLES));
  const dashParticleMeshRefs = useRef([]);
  const collisionParticlePoolRef = useRef(
    createParticlePool(MAX_COLLISION_PARTICLES)
  );
  const collisionParticleMeshRefs = useRef([]);
  const recentDashRef = useRef(new Map());
  const recentCollisionRef = useRef(new Map());
  const cameraTargetRef = useRef(new Vector3(WORLD_WIDTH / 2, 0, WORLD_HEIGHT / 2));
  const desiredCameraTargetRef = useRef(
    new Vector3(WORLD_WIDTH / 2, 0, WORLD_HEIGHT / 2)
  );
  const cameraPositionRef = useRef(
    new Vector3(
      WORLD_WIDTH / 2,
      CAMERA_OFFSET.y,
      WORLD_HEIGHT / 2 + CAMERA_OFFSET.z
    )
  );
  const cameraFootprint = useMemo(
    () => createCameraFootprint(size.width / size.height),
    [size.height, size.width]
  );

  useEffect(() => {
    camera.fov = CAMERA_FOV;
    camera.near = 0.1;
    camera.far = 5000;
    camera.position.copy(cameraPositionRef.current);
    camera.lookAt(cameraTargetRef.current);
    camera.updateProjectionMatrix();

    floorTexture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
    floorTexture.needsUpdate = true;

    return () => {
      floorTexture.dispose();
      particleTexture.dispose();
      for (const texture of faceTextures) {
        texture.dispose();
      }
    };
  }, [camera, faceTextures, floorTexture, gl, particleTexture]);

  useEffect(() => {
    const activeIds = new Set(roster.map((player) => player.id));

    for (const player of roster) {
      const networkState = playersRef.current.get(player.id);

      if (networkState && !displayStateRef.current.has(player.id)) {
        displayStateRef.current.set(player.id, createDisplayState(networkState));
      }
    }

    for (const playerId of [...displayStateRef.current.keys()]) {
      if (!activeIds.has(playerId)) {
        displayStateRef.current.delete(playerId);
        playerRefs.current.delete(playerId);
        recentDashRef.current.delete(playerId);
      }
    }
  }, [playersRef, roster]);

  function setPlayerRef(playerId, key, node) {
    const current = playerRefs.current.get(playerId) ?? {};

    if (node) {
      current[key] = node;
      playerRefs.current.set(playerId, current);
      return;
    }

    delete current[key];

    if (Object.keys(current).length === 0) {
      playerRefs.current.delete(playerId);
      return;
    }

    playerRefs.current.set(playerId, current);
  }

  function spawnParticleBurst(poolRef, x, y, z, color, count, speed, lifeMs) {
    for (
      let particleIndex = 0;
      particleIndex < poolRef.current.length && count > 0;
      particleIndex += 1
    ) {
      const particle = poolRef.current[particleIndex];

      if (particle.active) {
        continue;
      }

      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.55 + Math.random() * 0.7);
      particle.active = true;
      particle.bornAt = performance.now();
      particle.life = lifeMs * (0.7 + Math.random() * 0.45);
      particle.color = color;
      particle.startScale = 8 + Math.random() * 8;
      particle.endScale = 0.4 + Math.random() * 0.6;
      particle.scale = particle.startScale;
      particle.x = x + (Math.random() - 0.5) * 4;
      particle.y = y;
      particle.z = z + (Math.random() - 0.5) * 4;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = 8 + Math.random() * 20;
      particle.vz = Math.sin(angle) * velocity;
      count -= 1;
    }
  }

  function spawnDashTrail(player, displayState) {
    const dashAngle = Math.atan2(player.dashDirectionY, player.dashDirectionX);
    const trailColor = lightenColor(player.color, 0.22);

    spawnParticleBurst(
      dashParticlePoolRef,
      displayState.x - Math.cos(dashAngle) * 18,
      PLAYER_HEIGHT * 0.5,
      displayState.z - Math.sin(dashAngle) * 18,
      trailColor,
      5,
      90,
      DASH_TRAIL_LIFETIME_MS
    );
  }

  function spawnCollisionBurst(firstState, secondState, firstColor, secondColor) {
    const midX = (firstState.x + secondState.x) * 0.5;
    const midZ = (firstState.z + secondState.z) * 0.5;
    const burstColor =
      Math.random() > 0.5
        ? lightenColor(firstColor, 0.42)
        : lightenColor(secondColor, 0.42);

    spawnParticleBurst(
      collisionParticlePoolRef,
      midX,
      PLAYER_HEIGHT * 0.45,
      midZ,
      burstColor,
      8,
      150,
      COLLISION_SPARK_LIFETIME_MS
    );
  }

  function updateParticleMeshes(poolRef, meshRefs, deltaSeconds, nowMs) {
    for (let index = 0; index < poolRef.current.length; index += 1) {
      const particle = poolRef.current[index];
      const mesh = meshRefs.current[index];

      if (!mesh) {
        continue;
      }

      if (!particle.active) {
        mesh.visible = false;
        continue;
      }

      const age = nowMs - particle.bornAt;
      const progress = particle.life <= 0 ? 1 : age / particle.life;

      if (progress >= 1) {
        particle.active = false;
        mesh.visible = false;
        continue;
      }

      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.z += particle.vz * deltaSeconds;
      particle.vx *= 0.9;
      particle.vy *= 0.88;
      particle.vz *= 0.9;
      particle.scale = MathUtils.lerp(
        particle.startScale,
        particle.endScale,
        progress
      );

      mesh.visible = true;
      mesh.position.set(particle.x, particle.y, particle.z);
      mesh.scale.setScalar(particle.scale);
      mesh.material.opacity = (1 - progress) * 0.72;
      mesh.material.color.set(particle.color);
    }
  }

  useFrame((state, delta) => {
    const nowMs = performance.now();
    const input = inputRef.current;
    const inputX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const inputZ = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const inputMagnitude = Math.hypot(inputX, inputZ) || 1;
    let selfState = null;

    for (const player of roster) {
      const networkPlayer = playersRef.current.get(player.id);

      if (!networkPlayer) {
        continue;
      }

      const previousDashAt = recentDashRef.current.get(player.id) ?? 0;

      if (networkPlayer.dashAt && networkPlayer.dashAt !== previousDashAt) {
        const dashDisplayState =
          displayStateRef.current.get(player.id) ?? createDisplayState(networkPlayer);
        spawnDashTrail(networkPlayer, dashDisplayState);
        recentDashRef.current.set(player.id, networkPlayer.dashAt);
      }

      const displayState =
        displayStateRef.current.get(player.id) ?? createDisplayState(networkPlayer);
      const previousX = displayState.x;
      const previousZ = displayState.z;
      const dashActive = (networkPlayer.dashEndsAt ?? 0) > Date.now();

      if (player.id === selfId) {
        if (inputX !== 0 || inputZ !== 0) {
          resolveLocalMapCollision(
            displayState,
            (inputX / inputMagnitude) * PLAYER_SPEED * delta,
            (inputZ / inputMagnitude) * PLAYER_SPEED * delta
          );
        }

        if (dashActive) {
          resolveLocalMapCollision(
            displayState,
            (networkPlayer.dashDirectionX ?? 0) * PLAYER_DASH_SPEED * delta,
            (networkPlayer.dashDirectionY ?? 0) * PLAYER_DASH_SPEED * delta
          );
        }

        for (const otherPlayer of roster) {
          if (otherPlayer.id === selfId) {
            continue;
          }

          const otherState = displayStateRef.current.get(otherPlayer.id);

          if (!otherState) {
            continue;
          }

          resolveLocalCollision(displayState, otherState);
        }

        displayState.x = ease(
          displayState.x,
          networkPlayer.x,
          delta,
          dashActive ? 24 : 18
        );
        displayState.z = ease(
          displayState.z,
          networkPlayer.y,
          delta,
          dashActive ? 24 : 18
        );
        selfState = displayState;
      } else {
        displayState.x = ease(
          displayState.x,
          networkPlayer.x,
          delta,
          dashActive ? 16 : 11
        );
        displayState.z = ease(
          displayState.z,
          networkPlayer.y,
          delta,
          dashActive ? 16 : 11
        );
      }

      displayState.vx = (displayState.x - previousX) / Math.max(delta, 0.0001);
      displayState.vz = (displayState.z - previousZ) / Math.max(delta, 0.0001);
      displayState.tiltX = ease(
        displayState.tiltX,
        MathUtils.clamp(-displayState.vz / 1100, -0.12, 0.12),
        delta,
        10
      );
      displayState.tiltZ = ease(
        displayState.tiltZ,
        MathUtils.clamp(displayState.vx / 1100, -0.12, 0.12),
        delta,
        10
      );

      displayStateRef.current.set(player.id, displayState);

      const speedFactor = Math.min(
        1,
        Math.hypot(displayState.vx, displayState.vz) / PLAYER_SPEED
      );
      const dashBoost = dashActive
        ? 0.75 +
          Math.max(
            0,
            (networkPlayer.dashEndsAt - Date.now()) / PLAYER_DASH_DURATION_MS
          ) *
            0.35
        : 0;
      const bobOffset =
        Math.sin(state.clock.elapsedTime * 8 + displayState.bobSeed) *
        speedFactor *
        0.45;
      const refs = playerRefs.current.get(player.id);

      if (refs?.root) {
        refs.root.position.set(displayState.x, 0, displayState.z);
      }

      if (refs?.body) {
        refs.body.position.y = bobOffset;
        refs.body.rotation.x = displayState.tiltX;
        refs.body.rotation.z = displayState.tiltZ;
        refs.body.scale.setScalar(1 + dashBoost * 0.08);
      }

      if (refs?.ring) {
        refs.ring.scale.setScalar(1 + speedFactor * 0.1 + dashBoost * 0.08);
      }
    }

    for (let firstIndex = 0; firstIndex < roster.length; firstIndex += 1) {
      const first = roster[firstIndex];
      const firstState = displayStateRef.current.get(first.id);

      if (!firstState) {
        continue;
      }

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < roster.length;
        secondIndex += 1
      ) {
        const second = roster[secondIndex];
        const secondState = displayStateRef.current.get(second.id);

        if (!secondState) {
          continue;
        }

        const dx = secondState.x - firstState.x;
        const dz = secondState.z - firstState.z;
        const distance = Math.hypot(dx, dz);
        const relativeSpeed = Math.hypot(
          firstState.vx - secondState.vx,
          firstState.vz - secondState.vz
        );

        if (distance > PLAYER_COLLISION_DISTANCE + 1 || relativeSpeed < 120) {
          continue;
        }

        const pairKey = `${first.id}:${second.id}`;
        const previousCollisionAt = recentCollisionRef.current.get(pairKey) ?? 0;

        if (nowMs - previousCollisionAt < COLLISION_EVENT_COOLDOWN_MS) {
          continue;
        }

        recentCollisionRef.current.set(pairKey, nowMs);
        spawnCollisionBurst(firstState, secondState, first.color, second.color);
      }
    }

    updateParticleMeshes(
      dashParticlePoolRef,
      dashParticleMeshRefs,
      delta,
      nowMs
    );
    updateParticleMeshes(
      collisionParticlePoolRef,
      collisionParticleMeshRefs,
      delta,
      nowMs
    );

    if (!selfState) {
      return;
    }

    const targetX = clamp(
      selfState.x,
      -cameraFootprint.minX,
      WORLD_WIDTH - cameraFootprint.maxX
    );
    const targetZ = clamp(
      selfState.z,
      -cameraFootprint.minZ,
      WORLD_HEIGHT - cameraFootprint.maxZ
    );

    cameraPositionRef.current.set(
      targetX + CAMERA_OFFSET.x,
      CAMERA_OFFSET.y,
      targetZ + CAMERA_OFFSET.z
    );
    camera.position.lerp(cameraPositionRef.current, 1 - Math.exp(-delta * 7));

    desiredCameraTargetRef.current.set(targetX, 0, targetZ);
    cameraTargetRef.current.lerp(
      desiredCameraTargetRef.current,
      1 - Math.exp(-delta * 9)
    );
    camera.lookAt(cameraTargetRef.current);
  });

  return (
    <>
      <color attach="background" args={['#081116']} />
      <fog attach="fog" args={['#081116', 900, 1850]} />

      <ambientLight intensity={1.26} />
      <hemisphereLight intensity={0.72} color="#d7fff7" groundColor="#071015" />
      <directionalLight intensity={1.12} position={[240, 380, 150]} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[WORLD_WIDTH / 2, 0, WORLD_HEIGHT / 2]}
      >
        <planeGeometry args={[WORLD_WIDTH, WORLD_HEIGHT]} />
        <meshPhongMaterial color="#1d3d49" map={floorTexture} shininess={18} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[WORLD_WIDTH / 2, -3, WORLD_HEIGHT / 2]}
      >
        <planeGeometry args={[WORLD_WIDTH + 800, WORLD_HEIGHT + 800]} />
        <meshBasicMaterial color="#061015" />
      </mesh>

      <CityScenery />

      {roster.map((player) => (
        <PlayerMarker
          key={player.id}
          chatExpiresAt={player.chatExpiresAt}
          chatMessage={player.chatMessage}
          color={player.color}
          face={player.face}
          faceTextures={faceTextures}
          inspectionName={
            inspectedPlayerId === player.id && !player.chatMessage
              ? player.name
              : ''
          }
          isSelf={player.id === selfId}
          onInspect={() => onInspectPlayer(player.id)}
          registerBody={(node) => setPlayerRef(player.id, 'body', node)}
          registerRing={(node) => setPlayerRef(player.id, 'ring', node)}
          registerRoot={(node) => setPlayerRef(player.id, 'root', node)}
        />
      ))}

      <ParticleLayer
        meshRefs={dashParticleMeshRefs}
        particlePoolRef={dashParticlePoolRef}
        texture={particleTexture}
      />
      <ParticleLayer
        meshRefs={collisionParticleMeshRefs}
        particlePoolRef={collisionParticlePoolRef}
        texture={particleTexture}
      />
    </>
  );
}

export default function GameScene({ inputRef, playersRef, roster, selfId }) {
  const [inspectedPlayerId, setInspectedPlayerId] = useState(null);

  useEffect(() => {
    if (!inspectedPlayerId) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setInspectedPlayerId(null);
    }, PLAYER_INSPECT_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [inspectedPlayerId]);

  useEffect(() => {
    if (!inspectedPlayerId) {
      return;
    }

    const inspectedPlayer = roster.find((player) => player.id === inspectedPlayerId);

    if (!inspectedPlayer || inspectedPlayer.chatMessage) {
      setInspectedPlayerId(null);
    }
  }, [inspectedPlayerId, roster]);

  return (
    <Canvas
      camera={{
        fov: CAMERA_FOV,
        near: 0.1,
        far: 5000,
        position: [
          WORLD_WIDTH / 2,
          CAMERA_OFFSET.y,
          WORLD_HEIGHT / 2 + CAMERA_OFFSET.z
        ]
      }}
      className="game-canvas"
      dpr={[1, 1.2]}
      flat
      gl={{
        alpha: false,
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false
      }}
      performance={{ min: 0.75 }}
    >
      <World
        inputRef={inputRef}
        playersRef={playersRef}
        roster={roster}
        selfId={selfId}
        inspectedPlayerId={inspectedPlayerId}
        onInspectPlayer={setInspectedPlayerId}
      />
    </Canvas>
  );
}
