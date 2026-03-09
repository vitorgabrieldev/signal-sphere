import { useEffect, useRef, useState } from 'react';
import GameScene from './GameScene.jsx';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  PLAYER_DASH_COOLDOWN_MS
} from '../shared/gameConfig.js';

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
    name: player.name,
    face: player.face,
    chatExpiresAt: player.chatExpiresAt ?? 0,
    chatMessage: player.chatMessage ?? ''
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

    if (currentRoster[index]?.face !== nextPlayers[index].face) {
      return false;
    }

    if (
      currentRoster[index]?.chatExpiresAt !==
      (nextPlayers[index].chatExpiresAt ?? 0)
    ) {
      return false;
    }

    if (
      currentRoster[index]?.chatMessage !==
      (nextPlayers[index].chatMessage ?? '')
    ) {
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
  const chatInputRef = useRef(null);
  const chatOpenRef = useRef(false);
  const playersRef = useRef(new Map());
  const previousRosterRef = useRef([]);
  const toastTimeoutsRef = useRef(new Set());
  const hasHydratedRosterRef = useRef(false);
  const [chatDraft, setChatDraft] = useState('');
  const [dashCooldownEndsAt, setDashCooldownEndsAt] = useState(0);
  const [dashClock, setDashClock] = useState(Date.now());
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [roster, setRoster] = useState([]);
  const [selfId, setSelfId] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    selfIdRef.current = selfId;
  }, [selfId]);

  useEffect(() => {
    chatOpenRef.current = isChatOpen;

    if (isChatOpen) {
      chatInputRef.current?.focus();
    }
  }, [isChatOpen]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const currentSelfId = selfIdRef.current;
      const selfPlayer = currentSelfId
        ? playersRef.current.get(currentSelfId)
        : null;

      setDashCooldownEndsAt(selfPlayer?.dashCooldownEndsAt ?? 0);
      setDashClock(Date.now());
    }, 80);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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
    function sendDash() {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }

      socketRef.current.send(
        JSON.stringify({
          type: 'dash'
        })
      );
    }

    function sendFace(face) {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }

      socketRef.current.send(
        JSON.stringify({
          type: 'face',
          payload: { face }
        })
      );
    }

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

    function closeChatComposer() {
      chatOpenRef.current = false;
      setIsChatOpen(false);
      setChatDraft('');
    }

    function openChatComposer() {
      chatOpenRef.current = true;
      setInput(createEmptyInput());
      setChatDraft('');
      setIsChatOpen(true);
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

    const handleKeyDown = (event) => {
      if (chatOpenRef.current) {
        return;
      }

      if (
        event.target instanceof HTMLElement &&
        (event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.isContentEditable)
      ) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        openChatComposer();
        return;
      }

      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        if (!event.repeat) {
          event.preventDefault();
          sendDash();
        }

        return;
      }

      const faceCodeMatch = event.code.match(/^Digit([1-9])$|^Numpad([1-9])$/);

      if (faceCodeMatch) {
        event.preventDefault();
        sendFace(Number(faceCodeMatch[1] ?? faceCodeMatch[2]));
        return;
      }

      updateInput(event, true);
    };
    const handleKeyUp = (event) => {
      if (chatOpenRef.current) {
        return;
      }

      updateInput(event, false);
    };
    const resetInput = () => {
      if (!hasActiveInput(inputRef.current)) {
        return;
      }

      setInput(createEmptyInput());
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        resetInput();
        closeChatComposer();
      }
    };
    const handleWindowBlur = () => {
      resetInput();
      closeChatComposer();
    };
    const handlePageHide = () => {
      resetInput();
      closeChatComposer();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  function closeChatComposer() {
    chatOpenRef.current = false;
    setIsChatOpen(false);
    setChatDraft('');
  }

  function handleChatSubmit(event) {
    event.preventDefault();

    const message = chatDraft.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH);
    closeChatComposer();

    if (!message || socketRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    socketRef.current.send(
      JSON.stringify({
        type: 'chat',
        payload: { message }
      })
    );
  }

  function handleChatKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeChatComposer();
    }
  }

  const dashRemaining = Math.max(0, dashCooldownEndsAt - dashClock);
  const dashRatio =
    PLAYER_DASH_COOLDOWN_MS === 0
      ? 1
      : 1 - dashRemaining / PLAYER_DASH_COOLDOWN_MS;
  const dashReady = dashRemaining <= 0;

  return (
    <main className="app-shell">
      <GameScene
        inputRef={inputRef}
        playersRef={playersRef}
        roster={roster}
        selfId={selfId}
      />

      <section className="dash-meter" aria-label="Recarga do dash">
        <div className="dash-meter-copy">
          <strong>Dash</strong>
          <span>{dashReady ? 'Pronto' : `${(dashRemaining / 1000).toFixed(1)}s`}</span>
        </div>
        <div className="dash-meter-track">
          <div
            className="dash-meter-fill"
            data-ready={dashReady}
            style={{
              '--dash-progress': `${Math.max(0, Math.min(1, dashRatio))}`
            }}
          />
        </div>
      </section>

      {isChatOpen ? (
        <form className="chat-composer" onSubmit={handleChatSubmit}>
          <input
            ref={chatInputRef}
            className="chat-input"
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            onChange={(event) => setChatDraft(event.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder="Digite sua mensagem e pressione Enter"
            value={chatDraft}
          />
        </form>
      ) : null}

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
