import { Chess, type Move, type Square } from "chess.js";

export type UciMove = {
  from: string;
  to: string;
  promotion?: string;
};

export function makeChess(fen: string) {
  return new Chess(fen);
}

export function uciToMove(uci: string): UciMove {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4]
  };
}

export function moveToUci(move: { from: string; to: string; promotion?: string }) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export function normalizeUci(uci: string) {
  return uci.trim().toLowerCase().replace(/[^a-h1-8qrbn]/g, "");
}

export function applyUci(fen: string, uci: string) {
  const chess = makeChess(fen);
  const move = tryMove(chess, uci);
  if (!move) throw new Error(`Illegal move ${uci}`);
  return chess.fen();
}

export function tryApplyUci(fen: string, uci: string) {
  const chess = makeChess(fen);
  const move = tryMove(chess, uci);
  return move ? { fen: chess.fen(), move } : null;
}

export function sanForUci(fen: string, uci: string) {
  const chess = makeChess(fen);
  const move = tryMove(chess, uci);
  return move?.san ?? formatUci(uci);
}

export function isLegalUci(fen: string, uci: string) {
  const chess = makeChess(fen);
  return legalUciMovesFromChess(chess).some((move) => move === uci || move.slice(0, 4) === uci.slice(0, 4));
}

export function legalTargets(fen: string, square: string) {
  const chess = makeChess(fen);
  return chess.moves({ square: square as Square, verbose: true }).map((move) => move.to as string);
}

export function legalUciMoves(fen: string) {
  return legalUciMovesFromChess(makeChess(fen));
}

export function sideToMoveLabel(fen: string) {
  return makeChess(fen).turn() === "w" ? "백" : "흑";
}

export function sideToMoveOrientation(fen: string): "white" | "black" {
  return makeChess(fen).turn() === "w" ? "white" : "black";
}

export function isCheck(fen: string) {
  return makeChess(fen).isCheck();
}

export function isCheckmateAfter(fen: string, uci: string) {
  const chess = makeChess(fen);
  const move = tryMove(chess, uci);
  return Boolean(move && chess.isCheckmate());
}

export function isCheckmateFen(fen: string) {
  return makeChess(fen).isCheckmate();
}

export function isSidePiece(fen: string, piece: string | undefined) {
  if (!piece) return false;
  const turn = makeChess(fen).turn();
  return turn === "w" ? piece[0] === "w" : piece[0] === "b";
}

export function pieceAt(fen: string, square: string) {
  return makeChess(fen).get(square as Square);
}

export function countMaterial(fen: string) {
  return [...fen.split(" ")[0]].filter((char) => /[pnbrqPNBRQ]/.test(char)).length;
}

export function moveNumber(fen: string) {
  return Number(fen.split(" ")[5] || 1);
}

export function formatUci(uci?: string) {
  if (!uci) return "-";
  const promotion = uci[4] ? `=${uci[4].toUpperCase()}` : "";
  return `${uci.slice(0, 2)}-${uci.slice(2, 4)}${promotion}`;
}

export function moveSquares(uci?: string) {
  return {
    from: uci?.slice(0, 2) ?? "",
    to: uci?.slice(2, 4) ?? ""
  };
}

function tryMove(chess: Chess, uci: string): Move | null {
  try {
    return chess.move(uciToMove(uci));
  } catch {
    return null;
  }
}

function legalUciMovesFromChess(chess: Chess) {
  return chess.moves({ verbose: true }).map(moveToUci);
}
