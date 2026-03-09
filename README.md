# Circle Chat Arena

Projeto base de um joguinho multiplayer em React. Cada jogador controla uma bolinha pela arena usando `WASD`.

## Rodar localmente

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Servidor WebSocket: `ws://localhost:3001`

## Como testar o multiplayer

1. Abra `http://localhost:5173` em duas abas ou em dois dispositivos na mesma rede.
2. Mova cada bolinha com `W`, `A`, `S`, `D`.
3. O jogador local aparece destacado.

## Scripts

- `npm run dev`: sobe cliente e servidor juntos
- `npm run dev:client`: sobe apenas o React
- `npm run dev:server`: sobe apenas o WebSocket server
- `npm run build`: gera a build do frontend
