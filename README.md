# CBK - Claude Ball Knowledge

Kahoot-style live quiz for Claude Builder Club meetings. Up to 200 players join by QR code or 6-digit code, get a random name, and answer on their phones. The top 3 phones turn bright gold on every leaderboard and on the final podium.

## Run

```bash
npm install
npm run dev                     # server :3001 + Vite client :5173 (open http://localhost:5173)
npm run build && npm start      # production: one server on :3001 serves everything
```

| Env var          | Default      | Purpose                                              |
| ---------------- | ------------ | ---------------------------------------------------- |
| `ADMIN_PASSWORD` | `cbc-admin`  | Protects `/admin` and the admin API. Change it in prod. |
| `PUBLIC_URL`     | inferred     | Base URL encoded in the join QR code                 |
| `PORT`           | `3001`       | Server port                                          |

## Pages

- `/admin` - create/edit question sets, create a session, run the game (Space / → advances)
- `/display/:code` - projector screen (QR lobby, question, answers, reveal, leaderboard, podium). Press `f` for fullscreen.
- `/` - player join (`/?code=123456` auto-joins; this is what the QR encodes)
- `/play` - player game screen; refreshing or reconnecting keeps the same name and score

## Game flow

Lobby → question text alone for 3 s → four answers + timer (ends early when everyone answers) → reveal → leaderboard → next question … → final podium.
Scoring: correct = 500–1000 by speed, plus a streak bonus of up to +250.

## Notes

- State is in memory (sessions are lost on restart). Question sets persist to `server/data/question-sets.json`, seeded with a 10-question Claude trivia set.
- Load test: `npm start` in one terminal, then `PLAYERS=200 URL=http://localhost:3001 npm run loadtest`.
