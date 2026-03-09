import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
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
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../shared/gameConfig.js';

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ease(current, target, delta, strength) {
  return MathUtils.lerp(current, target, 1 - Math.exp(-delta * strength));
}

function lightenColor(baseColor, amount) {
  return `#${new Color(baseColor).lerp(new Color('#ffffff'), amount).getHexString()}`;
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

function PlayerMarker({
  color,
  isSelf,
  registerBody,
  registerRing,
  registerRoot
}) {
  const topColor = useMemo(() => lightenColor(color, 0.62), [color]);

  return (
    <group ref={registerRoot}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}>
        <circleGeometry args={[PLAYER_RADIUS * 1.08, 18]} />
        <meshBasicMaterial
          color="#000000"
          depthWrite={false}
          opacity={0.18}
          transparent
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.24, 0]}>
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
        >
          <ringGeometry args={[PLAYER_RADIUS * 1.35, PLAYER_RADIUS * 1.72, 28]} />
          <meshBasicMaterial
            color="#e8fff3"
            depthWrite={false}
            opacity={0.28}
            toneMapped={false}
            transparent
          />
        </mesh>
      ) : null}

      <group ref={registerBody}>
        <mesh position={[0, PLAYER_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_HEIGHT, 18]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>

        <mesh position={[0, PLAYER_HEIGHT + 1.25, 0]}>
          <cylinderGeometry
            args={[PLAYER_RADIUS * 0.88, PLAYER_RADIUS * 0.88, 2.5, 18]}
          />
          <meshBasicMaterial color={topColor} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function World({ inputRef, playersRef, roster, selfId }) {
  const { camera, gl, size } = useThree();
  const floorTexture = useMemo(() => createFloorTexture(), []);
  const playerRefs = useRef(new Map());
  const displayStateRef = useRef(new Map());
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
    };
  }, [camera, floorTexture, gl]);

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

  useFrame((state, delta) => {
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

      const displayState =
        displayStateRef.current.get(player.id) ?? createDisplayState(networkPlayer);
      const previousX = displayState.x;
      const previousZ = displayState.z;

      if (player.id === selfId) {
        if (inputX !== 0 || inputZ !== 0) {
          displayState.x = clamp(
            displayState.x + (inputX / inputMagnitude) * PLAYER_SPEED * delta,
            PLAYER_RADIUS,
            WORLD_WIDTH - PLAYER_RADIUS
          );
          displayState.z = clamp(
            displayState.z + (inputZ / inputMagnitude) * PLAYER_SPEED * delta,
            PLAYER_RADIUS,
            WORLD_HEIGHT - PLAYER_RADIUS
          );
        }

        displayState.x = ease(displayState.x, networkPlayer.x, delta, 18);
        displayState.z = ease(displayState.z, networkPlayer.y, delta, 18);
        selfState = displayState;
      } else {
        displayState.x = ease(displayState.x, networkPlayer.x, delta, 11);
        displayState.z = ease(displayState.z, networkPlayer.y, delta, 11);
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
      }

      if (refs?.ring) {
        refs.ring.scale.setScalar(1 + speedFactor * 0.1);
      }
    }

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

      {roster.map((player) => (
        <PlayerMarker
          key={player.id}
          color={player.color}
          isSelf={player.id === selfId}
          registerBody={(node) => setPlayerRef(player.id, 'body', node)}
          registerRing={(node) => setPlayerRef(player.id, 'ring', node)}
          registerRoot={(node) => setPlayerRef(player.id, 'root', node)}
        />
      ))}
    </>
  );
}

export default function GameScene({ inputRef, playersRef, roster, selfId }) {
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
      dpr={[1, 1.25]}
      flat
      gl={{
        alpha: false,
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false
      }}
    >
      <World
        inputRef={inputRef}
        playersRef={playersRef}
        roster={roster}
        selfId={selfId}
      />
    </Canvas>
  );
}
