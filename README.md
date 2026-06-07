# Chess Diagnostic Trainer

Chess Diagnostic Trainer is a personal chess training web app focused on diagnosing weaknesses, not just serving random puzzles.

The app tracks how a user solves puzzles and answers four questions:

- Which phase is weak: opening, middlegame, or endgame?
- Which puzzle themes fail most often?
- Which thinking skills break down?
- What should the next training session prioritize?

## Current Features

- React, TypeScript, and Vite frontend
- Interactive chessboard powered by `react-chessboard`
- Legal move validation with `chess.js`
- Lichess Puzzle CSV import
- Correct Lichess puzzle handling:
  - Apply the first move in `Moves` to the source `FEN`
  - Present the resulting position to the user
  - Treat the remaining moves as the solution line
- Puzzle classification by:
  - phase
  - theme
  - family
  - thinking skill
  - opening tag
- Training sessions:
  - balanced
  - weakness-based
  - review
  - opening
- Visual move feedback:
  - previous opponent move
  - previous user move
  - legal target squares for the selected piece
- Attempt tracking:
  - first move correctness
  - full line correctness
  - solve time
  - hint count
  - result type
  - self-reported mistake reasons
- Review queue for failed puzzles
- Rule-based weakness reports
- Stockfish Web Worker for wrong-move evaluation
- FastAPI and SQLite backend scaffold

## Opening Training

Opening training uses imported Lichess puzzles with `OpeningTags` or positions classified as opening-phase puzzles.

This is not an opening repertoire memorizer yet. The current goal is to diagnose early-game tactical and transition mistakes.

## Tech Stack

- Frontend: React, TypeScript, Vite
- Board UI: `react-chessboard`
- Chess rules: `chess.js`
- Engine evaluation: Stockfish Web Worker
- Backend scaffold: FastAPI, SQLite
- Puzzle source: Lichess Puzzle Database

## Getting Started

Install dependencies:

```powershell
npm install
```

Run the development server:

```powershell
npm start
```

Run validation:

```powershell
npm test
npm run build
```

## Backend Scaffold

The backend scaffold is under `backend/`.

Planned API surface:

- `GET /health`
- `GET /puzzles`
- `POST /puzzles/import/lichess`
- `POST /attempts`
- `GET /reports/summary`

## Roadmap

- Connect frontend state to the FastAPI SQLite backend
- Add user/profile separation
- Add PGN upload
- Import Lichess and Chess.com game history
- Analyze personal games with Stockfish
- Generate personal puzzles from mistakes
- Add sparring modes:
  - exploit a weakness
  - mirror strengths
  - anti-mirror defensive training

## License Notes

The Lichess Puzzle Database is distributed under CC0.

Stockfish is GPL-3.0. Any production or commercial distribution should review the licensing implications of bundling or serving Stockfish.
