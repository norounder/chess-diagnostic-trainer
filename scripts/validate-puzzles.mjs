import { applyUciMoveToFen, isCheckmate, legalMoves, parseFen } from "../src/chess.js";
import { SAMPLE_PUZZLES } from "../src/puzzles.js";

const failures = [];

for (const puzzle of SAMPLE_PUZZLES) {
  if (puzzle.source !== "curated" && puzzle.source !== "lichess") {
    failures.push(`${puzzle.id}: unsupported source ${puzzle.source}`);
  }

  if (puzzle.source === "curated" && puzzle.ratingDeviation !== 0) {
    failures.push(`${puzzle.id}: curated seed must not pretend to have Lichess rating deviation`);
  }

  const presented = parseFen(puzzle.fenPresented);
  if (!findKing(presented.rows, "w") || !findKing(presented.rows, "b")) {
    failures.push(`${puzzle.id}: both kings must be present`);
    continue;
  }

  let fen = puzzle.fenPresented;
  for (const move of puzzle.solutionMovesUci) {
    const legal = legalMoves(fen);
    if (!legal.includes(move) && !legal.some((candidate) => candidate.slice(0, 4) === move.slice(0, 4))) {
      failures.push(`${puzzle.id}: illegal solution move ${move}`);
      break;
    }
    fen = applyUciMoveToFen(fen, move);
  }

  if (puzzle.verification?.outcome === "checkmate" && !isCheckmate(fen)) {
    failures.push(`${puzzle.id}: final position is not checkmate`);
  }

  if (puzzle.objective?.type === "checkmate" && puzzle.objective.plies === 1) {
    const mateMoves = legalMoves(puzzle.fenPresented).filter((move) => isCheckmate(applyUciMoveToFen(puzzle.fenPresented, move)));
    if (!mateMoves.length) {
      failures.push(`${puzzle.id}: mate objective has no legal mate move`);
    }
    if (puzzle.objective.acceptEquivalent !== true) {
      failures.push(`${puzzle.id}: mate objective must accept equivalent checkmates`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Validated ${SAMPLE_PUZZLES.length} curated puzzles.`);

function findKing(rows, color) {
  const king = color === "w" ? "K" : "k";
  for (const row of rows) {
    if (row.includes(king)) return true;
  }
  return false;
}
