import { useEffect, useRef, useState } from 'react';
import GameScene from './GameScene.jsx';

const DIRECTIONS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right'
};

function createEmptyInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false
  };
}

function getSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:3001`;
}

function hasActiveInput(input) {
  return input.up || input.down || input.left || input.right;
}

function isSameInput(left, right) {
  return (
    left.up === right.up &&
    left.down === right.down &&
    left.left === right.left &&
    left.right === right.right
  );
}

function createRoster(players) {
  return players.map((player) => ({
    id: player.id,
    color: player.color,
    name: player.name
  }));
}

function isSameRoster(currentRoster, nextPlayers) {
  if (currentRoster.length !== nextPlayers.length) {
    return false;
  }

  for (let index = 0; index < nextPlayers.length; index += 1) {
    if (currentRoster[index]?.id !== nextPlayers[index].id) {
      return false;
    }

    if (currentRoster[index]?.color !== nextPlayers[index].color) {
      return false;
    }

    if (currentRoster[index]?.name !== nextPlayers[index].name) {
      return false;
    }
  }

  return true;
}

function createToast(id, message, color) {
  return {
    id,
    message,
    color
  };
}

export default function App() {
  const socketRef = useRef(null);
  const inputRef = useRef(createEmptyInput());
  const selfIdRef = useRef(null);
  const playersRef = useRef(new Map());
  const previousRosterRef = useRef([]);
  const toastTimeoutsRef = useRef(new Set());
  const hasHydratedRosterRef = useRef(false);
  const [roster, setRoster] = useState([]);
  const [selfId, setSelfId] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    selfIdRef.current = selfId;
  }, [selfId]);

  useEffect(() => {
    const socket = new WebSocket(getSocketUrl());
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          type: 'input',
          payload: inputRef.current
        })
      );
    });

    socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'welcome') {
        setSelfId(data.selfId);
        return;
      }

      if (data.type !== 'state') {
        return;
      }

      playersRef.current = new Map(
        data.players.map((player) => [player.id, player])
      );

      const previousRoster = previousRosterRef.current;
      const nextRoster = createRoster(data.players);

      if (hasHydratedRosterRef.current) {
        const previousIds = new Set(previousRoster.map((player) => player.id));

        for (const player of nextRoster) {
          if (player.id === selfIdRef.current || previousIds.has(player.id)) {
            continue;
          }

          const toastId = `${player.id}-${Date.now()}`;
          setToasts((currentToasts) => [
            ...currentToasts,
            createToast(toastId, `${player.name} entrou na partida`, player.color)
          ]);

          const timeoutId = setTimeout(() => {
            setToasts((currentToasts) =>
              currentToasts.filter((toast) => toast.id !== toastId)
            );
            toastTimeoutsRef.current.delete(timeoutId);
          }, 2600);

          toastTimeoutsRef.current.add(timeoutId);
        }
      } else {
        hasHydratedRosterRef.current = true;
      }

      previousRosterRef.current = nextRoster;
      setRoster((currentRoster) =>
        isSameRoster(currentRoster, data.players)
          ? currentRoster
          : nextRoster
      );
    });

    socket.addEventListener('close', () => {
      playersRef.current = new Map();
      previousRosterRef.current = [];
      hasHydratedRosterRef.current = false;
      selfIdRef.current = null;
      setRoster([]);
      setSelfId(null);
      setToasts([]);
    });

    return () => {
      for (const timeoutId of toastTimeoutsRef.current) {
        clearTimeout(timeoutId);
      }
      toastTimeoutsRef.current.clear();
      socket.close();
    };
  }, []);

  useEffect(() => {
    function sendInput(nextInput) {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }

      socketRef.current.send(
        JSON.stringify({
          type: 'input',
          payload: nextInput
        })
      );
    }

    function setInput(nextInput) {
      if (isSameInput(nextInput, inputRef.current)) {
        return;
      }

      inputRef.current = nextInput;
      sendInput(nextInput);
    }

    function updateInput(event, value) {
      const direction = DIRECTIONS[event.code];

      if (!direction) {
        return;
      }

      event.preventDefault();

      const nextInput = {
        ...inputRef.current,
        [direction]: value
      };

      setInput(nextInput);
    }

    const handleKeyDown = (event) => updateInput(event, true);
    const handleKeyUp = (event) => updateInput(event, false);
    const resetInput = () => {
      if (!hasActiveInput(inputRef.current)) {
        return;
      }

      setInput(createEmptyInput());
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        resetInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', resetInput);
    window.addEventListener('pagehide', resetInput);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', resetInput);
      window.removeEventListener('pagehide', resetInput);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <main className="app-shell">
      <GameScene
        inputRef={inputRef}
        playersRef={playersRef}
        roster={roster}
        selfId={selfId}
      />

      <aside className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-card">
            <span
              className="toast-swatch"
              style={{ '--toast-color': toast.color }}
            />
            <p>{toast.message}</p>
          </div>
        ))}
      </aside>
    </main>
  );
}
