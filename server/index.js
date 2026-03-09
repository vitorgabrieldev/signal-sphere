import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  PLAYER_COLLISION_DISTANCE,
  STATE_BROADCAST_HZ,
  PLAYER_RADIUS,
  PLAYER_SPAWN_CLEARANCE,
  PLAYER_SPEED,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../shared/gameConfig.js';

const PORT = Number(process.env.PORT || 3001);
const TICK_RATE = 1000 / 60;
const BROADCAST_RATE = 1000 / STATE_BROADCAST_HZ;

const COLORS = ['#00f5ff', '#ffe14d', '#ff5fd2', '#6dff7a', '#ff8a3d', '#7b8cff'];
const PHONETIC_ALPHABET = [
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliett',
  'Kilo',
  'Lima',
  'Mike',
  'November',
  'Oscar',
  'Papa',
  'Quebec',
  'Romeo',
  'Sierra',
  'Tango',
  'Uniform',
  'Victor',
  'Whiskey',
  'Xray',
  'Yankee',
  'Zulu'
];
const players = new Map();
let stateDirty = false;

const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(
    JSON.stringify({
      ok: true,
      players: players.size
    })
  );
});

const wss = new WebSocketServer({ server });

function pickPlayerColor() {
  const usage = new Map(COLORS.map((color) => [color, 0]));

  for (const player of players.values()) {
    usage.set(player.color, (usage.get(player.color) ?? 0) + 1);
  }

  const lowestUsage = Math.min(...usage.values());
  const candidates = COLORS.filter(
    (color) => usage.get(color) === lowestUsage
  );

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function createPlayerName() {
  const usedNames = new Set([...players.values()].map((player) => player.name));

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const firstWord =
      PHONETIC_ALPHABET[Math.floor(Math.random() * PHONETIC_ALPHABET.length)];
    let secondWord =
      PHONETIC_ALPHABET[Math.floor(Math.random() * PHONETIC_ALPHABET.length)];

    if (secondWord === firstWord) {
      secondWord =
        PHONETIC_ALPHABET[
          (PHONETIC_ALPHABET.indexOf(secondWord) + 7) %
            PHONETIC_ALPHABET.length
        ];
    }

    const name = `${firstWord} ${secondWord}`;

    if (!usedNames.has(name)) {
      return name;
    }
  }

  return `Alpha ${PHONETIC_ALPHABET[players.size % PHONETIC_ALPHABET.length]}`;
}

function getSpawnAnchor() {
  const connectedPlayers = [...players.values()];

  if (connectedPlayers.length === 0) {
    return {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2
    };
  }

  const basePlayer = connectedPlayers[connectedPlayers.length - 1];

  return {
    x: basePlayer.x,
    y: basePlayer.y
  };
}

function isSpawnClear(x, y, ignoreId = null) {
  for (const player of players.values()) {
    if (player.id === ignoreId) {
      continue;
    }

    const dx = player.x - x;
    const dy = player.y - y;

    if (dx * dx + dy * dy < PLAYER_SPAWN_CLEARANCE * PLAYER_SPAWN_CLEARANCE) {
      return false;
    }
  }

  return true;
}

function createSpawnPoint() {
  const anchor = getSpawnAnchor();

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const ring = Math.floor(attempt / 6);
    const angle = attempt * 2.399963229728653;
    const distance = ring === 0 ? 0 : 78 + ring * 46;
    const x = clamp(
      anchor.x + Math.cos(angle) * distance,
      PLAYER_RADIUS,
      WORLD_WIDTH - PLAYER_RADIUS
    );
    const y = clamp(
      anchor.y + Math.sin(angle) * distance,
      PLAYER_RADIUS,
      WORLD_HEIGHT - PLAYER_RADIUS
    );

    if (isSpawnClear(x, y)) {
      return { x, y };
    }
  }

  return {
    x: clamp(anchor.x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
    y: clamp(anchor.y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS)
  };
}

function createPlayer(id) {
  const spawn = createSpawnPoint();

  return {
    id,
    name: createPlayerName(),
    color: pickPlayerColor(),
    x: spawn.x,
    y: spawn.y,
    input: {
      up: false,
      down: false,
      left: false,
      right: false
    }
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeInput(input) {
  const next = {
    up: Boolean(input?.up),
    down: Boolean(input?.down),
    left: Boolean(input?.left),
    right: Boolean(input?.right)
  };

  return next;
}

function serializePlayers() {
  return [...players.values()].map(({ input, ...player }) => player);
}

function resolvePlayerCollisions() {
  const playerList = [...players.values()];
  let moved = false;

  for (let pass = 0; pass < 4; pass += 1) {
    let passMoved = false;

    for (let index = 0; index < playerList.length; index += 1) {
      const current = playerList[index];

      for (let otherIndex = index + 1; otherIndex < playerList.length; otherIndex += 1) {
        const other = playerList[otherIndex];
        let dx = other.x - current.x;
        let dy = other.y - current.y;
        let distance = Math.hypot(dx, dy);

        if (distance >= PLAYER_COLLISION_DISTANCE) {
          continue;
        }

        if (distance < 0.0001) {
          const angle = (index + 1) * (otherIndex + 3);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const overlap = PLAYER_COLLISION_DISTANCE - distance;
        const normalX = dx / distance;
        const normalY = dy / distance;
        const pushX = normalX * overlap * 0.5;
        const pushY = normalY * overlap * 0.5;
        const nextCurrentX = clamp(
          current.x - pushX,
          PLAYER_RADIUS,
          WORLD_WIDTH - PLAYER_RADIUS
        );
        const nextCurrentY = clamp(
          current.y - pushY,
          PLAYER_RADIUS,
          WORLD_HEIGHT - PLAYER_RADIUS
        );
        const nextOtherX = clamp(
          other.x + pushX,
          PLAYER_RADIUS,
          WORLD_WIDTH - PLAYER_RADIUS
        );
        const nextOtherY = clamp(
          other.y + pushY,
          PLAYER_RADIUS,
          WORLD_HEIGHT - PLAYER_RADIUS
        );

        if (
          nextCurrentX !== current.x ||
          nextCurrentY !== current.y ||
          nextOtherX !== other.x ||
          nextOtherY !== other.y
        ) {
          current.x = nextCurrentX;
          current.y = nextCurrentY;
          other.x = nextOtherX;
          other.y = nextOtherY;
          passMoved = true;
        }
      }
    }

    if (!passMoved) {
      break;
    }

    moved = true;
  }

  return moved;
}

function broadcastState() {
  const snapshot = JSON.stringify({
    type: 'state',
    players: serializePlayers()
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.playerId) {
      client.send(snapshot);
    }
  }
}

function step(deltaSeconds) {
  let moved = false;

  for (const player of players.values()) {
    const horizontal =
      (player.input.right ? 1 : 0) - (player.input.left ? 1 : 0);
    const vertical =
      (player.input.down ? 1 : 0) - (player.input.up ? 1 : 0);

    if (horizontal === 0 && vertical === 0) {
      continue;
    }

    const magnitude = Math.hypot(horizontal, vertical) || 1;
    const nextX = clamp(
      player.x + (horizontal / magnitude) * PLAYER_SPEED * deltaSeconds,
      PLAYER_RADIUS,
      WORLD_WIDTH - PLAYER_RADIUS
    );
    const nextY = clamp(
      player.y + (vertical / magnitude) * PLAYER_SPEED * deltaSeconds,
      PLAYER_RADIUS,
      WORLD_HEIGHT - PLAYER_RADIUS
    );

    if (nextX !== player.x || nextY !== player.y) {
      player.x = nextX;
      player.y = nextY;
      moved = true;
    }
  }

  const collided = resolvePlayerCollisions();

  if (moved || collided) {
    stateDirty = true;
  }
}

wss.on('connection', (socket) => {
  const playerId = crypto.randomUUID();
  const player = createPlayer(playerId);

  players.set(playerId, player);
  resolvePlayerCollisions();
  socket.playerId = playerId;
  stateDirty = true;

  socket.send(
    JSON.stringify({
      type: 'welcome',
      selfId: playerId
    })
  );
  broadcastState();
  stateDirty = false;

  socket.on('message', (rawMessage) => {
    try {
      const message = JSON.parse(String(rawMessage));

      if (message.type !== 'input') {
        return;
      }

      const currentPlayer = players.get(playerId);
      if (!currentPlayer) {
        return;
      }

      const nextInput = normalizeInput(message.payload);
      const inputChanged =
        nextInput.up !== currentPlayer.input.up ||
        nextInput.down !== currentPlayer.input.down ||
        nextInput.left !== currentPlayer.input.left ||
        nextInput.right !== currentPlayer.input.right;

      currentPlayer.input = nextInput;

      if (inputChanged) {
        stateDirty = true;
      }
    } catch {
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Mensagem invalida'
        })
      );
    }
  });

  socket.on('close', () => {
    players.delete(playerId);
    stateDirty = true;
    broadcastState();
    stateDirty = false;
  });
});

let previousTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const deltaSeconds = (now - previousTick) / 1000;
  previousTick = now;
  step(deltaSeconds);
}, TICK_RATE);

setInterval(() => {
  if (!stateDirty) {
    return;
  }

  stateDirty = false;
  broadcastState();
}, BROADCAST_RATE);

server.listen(PORT, () => {
  console.log(`Multiplayer server listening on http://localhost:${PORT}`);
});
