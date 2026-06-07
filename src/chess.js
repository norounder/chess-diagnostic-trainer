const PIECES = {
  K: "&#9812;",
  Q: "&#9813;",
  R: "&#9814;",
  B: "&#9815;",
  N: "&#9816;",
  P: "&#9817;",
  k: "&#9818;",
  q: "&#9819;",
  r: "&#9820;",
  b: "&#9821;",
  n: "&#9822;",
  p: "&#9823;"
};

const KNIGHT_DELTAS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];

const KING_DELTAS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

const BISHOP_DIRECTIONS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const QUEEN_DIRECTIONS = [...BISHOP_DIRECTIONS, ...ROOK_DIRECTIONS];

export function parseFen(fen) {
  const [placement, activeColor = "w", castling = "-", enPassant = "-", halfmove = "0", fullmove = "1"] = fen.split(" ");
  const rows = placement.split("/").map((rank) => {
    const cells = [];
    for (const char of rank) {
      if (/\d/.test(char)) {
        for (let i = 0; i < Number(char); i += 1) cells.push(null);
      } else {
        cells.push(char);
      }
    }
    return cells;
  });

  return { rows, activeColor, castling, enPassant, halfmove, fullmove };
}

export function boardToPlacement(rows) {
  return rows
    .map((rank) => {
      let out = "";
      let empty = 0;
      for (const piece of rank) {
        if (!piece) {
          empty += 1;
        } else {
          if (empty) out += String(empty);
          empty = 0;
          out += piece;
        }
      }
      if (empty) out += String(empty);
      return out;
    })
    .join("/");
}

export function applyUciMoveToFen(fen, uci) {
  const parsed = parseFen(fen);
  const nextRows = applyUciMoveToRows(parsed.rows, uci, parsed.enPassant);
  const nextColor = parsed.activeColor === "w" ? "b" : "w";
  const nextFullmove = parsed.activeColor === "b" ? String(Number(parsed.fullmove) + 1) : parsed.fullmove;
  return `${boardToPlacement(nextRows)} ${nextColor} ${updateCastling(parsed.castling, uci, parsed.rows)} ${nextEnPassant(parsed.rows, uci)} 0 ${nextFullmove}`;
}

function applyUciMoveToRows(rows, uci, enPassant = "-") {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.slice(4, 5);
  const [fromRow, fromCol] = squareToIndexes(from);
  const [toRow, toCol] = squareToIndexes(to);
  const movingPiece = rows[fromRow]?.[fromCol];
  if (!movingPiece) return rows.map((row) => [...row]);

  const nextRows = rows.map((row) => [...row]);
  nextRows[fromRow][fromCol] = null;

  if (movingPiece.toLowerCase() === "k" && Math.abs(toCol - fromCol) === 2) {
    moveCastlingRook(nextRows, fromRow, fromCol, toCol);
  }

  if (movingPiece.toLowerCase() === "p" && to === enPassant && fromCol !== toCol && !rows[toRow][toCol]) {
    nextRows[fromRow][toCol] = null;
  }

  nextRows[toRow][toCol] = promotion
    ? (isWhitePiece(movingPiece) ? promotion.toUpperCase() : promotion.toLowerCase())
    : movingPiece;
  return nextRows;
}

function moveCastlingRook(rows, row, fromCol, toCol) {
  if (toCol > fromCol) {
    rows[row][5] = rows[row][7];
    rows[row][7] = null;
  } else {
    rows[row][3] = rows[row][0];
    rows[row][0] = null;
  }
}

function updateCastling(castling, uci, rows) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const [fromRow, fromCol] = squareToIndexes(from);
  const movingPiece = rows[fromRow]?.[fromCol];
  let next = castling === "-" ? "" : castling;

  if (movingPiece === "K") next = next.replace(/[KQ]/g, "");
  if (movingPiece === "k") next = next.replace(/[kq]/g, "");
  if (from === "a1" || to === "a1") next = next.replace("Q", "");
  if (from === "h1" || to === "h1") next = next.replace("K", "");
  if (from === "a8" || to === "a8") next = next.replace("q", "");
  if (from === "h8" || to === "h8") next = next.replace("k", "");
  return next || "-";
}

function nextEnPassant(rows, uci) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const [fromRow, fromCol] = squareToIndexes(from);
  const [toRow] = squareToIndexes(to);
  const movingPiece = rows[fromRow]?.[fromCol];
  if (movingPiece?.toLowerCase() !== "p" || Math.abs(fromRow - toRow) !== 2) return "-";
  const middleRow = (fromRow + toRow) / 2;
  return indexesToSquare(middleRow, fromCol);
}

export function squareToIndexes(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return [8 - rank, file];
}

export function indexesToSquare(row, col) {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

export function pieceToGlyph(piece) {
  return PIECES[piece] || "";
}

export function isWhitePiece(piece) {
  return !!piece && piece === piece.toUpperCase();
}

export function colorOf(piece) {
  if (!piece) return null;
  return isWhitePiece(piece) ? "w" : "b";
}

export function activeColorLabel(fen) {
  return parseFen(fen).activeColor === "w" ? "White" : "Black";
}

export function activeColorKorean(fen) {
  return parseFen(fen).activeColor === "w" ? "\uBC31" : "\uD751";
}

export function displaySquares(fen, orientation = "white") {
  const parsed = parseFen(fen);
  const rowOrder = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const colOrder = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const squares = [];

  for (const row of rowOrder) {
    for (const col of colOrder) {
      squares.push({
        row,
        col,
        square: indexesToSquare(row, col),
        piece: parsed.rows[row][col],
        dark: (row + col) % 2 === 1
      });
    }
  }

  return squares;
}

export function legalMovesForSquare(fen, square) {
  const parsed = parseFen(fen);
  const [row, col] = squareToIndexes(square);
  const piece = parsed.rows[row]?.[col];
  if (!piece || colorOf(piece) !== parsed.activeColor) return [];
  return legalMoves(fen).filter((move) => move.startsWith(square));
}

export function legalMoves(fen) {
  const parsed = parseFen(fen);
  const color = parsed.activeColor;
  const pseudo = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = parsed.rows[row][col];
      if (piece && colorOf(piece) === color) {
        pseudo.push(...pseudoMovesForPiece(parsed, row, col));
      }
    }
  }

  return pseudo.filter((move) => leavesKingSafe(parsed, move, color));
}

function pseudoMovesForPiece(parsed, row, col) {
  const piece = parsed.rows[row][col];
  const type = piece.toLowerCase();
  if (type === "p") return pawnMoves(parsed, row, col, piece);
  if (type === "n") return jumpMoves(parsed.rows, row, col, piece, KNIGHT_DELTAS);
  if (type === "b") return slidingMoves(parsed.rows, row, col, piece, BISHOP_DIRECTIONS);
  if (type === "r") return slidingMoves(parsed.rows, row, col, piece, ROOK_DIRECTIONS);
  if (type === "q") return slidingMoves(parsed.rows, row, col, piece, QUEEN_DIRECTIONS);
  if (type === "k") return [...jumpMoves(parsed.rows, row, col, piece, KING_DELTAS), ...castlingMoves(parsed, row, col, piece)];
  return [];
}

function pawnMoves(parsed, row, col, piece) {
  const moves = [];
  const color = colorOf(piece);
  const dir = color === "w" ? -1 : 1;
  const startRow = color === "w" ? 6 : 1;
  const promoteRow = color === "w" ? 0 : 7;
  const from = indexesToSquare(row, col);
  const oneRow = row + dir;

  if (isInside(oneRow, col) && !parsed.rows[oneRow][col]) {
    addPawnMove(moves, from, indexesToSquare(oneRow, col), oneRow === promoteRow);
    const twoRow = row + dir * 2;
    if (row === startRow && !parsed.rows[twoRow][col]) {
      moves.push(`${from}${indexesToSquare(twoRow, col)}`);
    }
  }

  for (const captureCol of [col - 1, col + 1]) {
    if (!isInside(oneRow, captureCol)) continue;
    const target = parsed.rows[oneRow][captureCol];
    const to = indexesToSquare(oneRow, captureCol);
    if ((target && colorOf(target) !== color) || to === parsed.enPassant) {
      addPawnMove(moves, from, to, oneRow === promoteRow);
    }
  }

  return moves;
}

function addPawnMove(moves, from, to, promotes) {
  if (!promotes) {
    moves.push(`${from}${to}`);
    return;
  }
  for (const promotion of ["q", "r", "b", "n"]) {
    moves.push(`${from}${to}${promotion}`);
  }
}

function jumpMoves(rows, row, col, piece, deltas) {
  const moves = [];
  const from = indexesToSquare(row, col);
  const color = colorOf(piece);
  for (const [rowDelta, colDelta] of deltas) {
    const nextRow = row + rowDelta;
    const nextCol = col + colDelta;
    if (!isInside(nextRow, nextCol)) continue;
    const target = rows[nextRow][nextCol];
    if (!target || colorOf(target) !== color) {
      moves.push(`${from}${indexesToSquare(nextRow, nextCol)}`);
    }
  }
  return moves;
}

function slidingMoves(rows, row, col, piece, directions) {
  const moves = [];
  const from = indexesToSquare(row, col);
  const color = colorOf(piece);
  for (const [rowDir, colDir] of directions) {
    let nextRow = row + rowDir;
    let nextCol = col + colDir;
    while (isInside(nextRow, nextCol)) {
      const target = rows[nextRow][nextCol];
      if (!target) {
        moves.push(`${from}${indexesToSquare(nextRow, nextCol)}`);
      } else {
        if (colorOf(target) !== color) {
          moves.push(`${from}${indexesToSquare(nextRow, nextCol)}`);
        }
        break;
      }
      nextRow += rowDir;
      nextCol += colDir;
    }
  }
  return moves;
}

function castlingMoves(parsed, row, col, piece) {
  const color = colorOf(piece);
  const enemy = color === "w" ? "b" : "w";
  const moves = [];
  const from = indexesToSquare(row, col);
  if (isSquareAttacked(parsed.rows, row, col, enemy)) return moves;

  const rights = parsed.castling || "-";
  const kingSide = color === "w" ? "K" : "k";
  const queenSide = color === "w" ? "Q" : "q";
  if (rights.includes(kingSide) && !parsed.rows[row][5] && !parsed.rows[row][6]) {
    if (!isSquareAttacked(parsed.rows, row, 5, enemy) && !isSquareAttacked(parsed.rows, row, 6, enemy)) {
      moves.push(`${from}${indexesToSquare(row, 6)}`);
    }
  }
  if (rights.includes(queenSide) && !parsed.rows[row][1] && !parsed.rows[row][2] && !parsed.rows[row][3]) {
    if (!isSquareAttacked(parsed.rows, row, 2, enemy) && !isSquareAttacked(parsed.rows, row, 3, enemy)) {
      moves.push(`${from}${indexesToSquare(row, 2)}`);
    }
  }
  return moves;
}

function leavesKingSafe(parsed, move, color) {
  const nextRows = applyUciMoveToRows(parsed.rows, move, parsed.enPassant);
  const king = findKing(nextRows, color);
  if (!king) return false;
  const enemy = color === "w" ? "b" : "w";
  return !isSquareAttacked(nextRows, king.row, king.col, enemy);
}

function findKing(rows, color) {
  const king = color === "w" ? "K" : "k";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (rows[row][col] === king) return { row, col };
    }
  }
  return null;
}

export function isKingInCheck(fen) {
  const parsed = parseFen(fen);
  const king = findKing(parsed.rows, parsed.activeColor);
  if (!king) return false;
  const enemy = parsed.activeColor === "w" ? "b" : "w";
  return isSquareAttacked(parsed.rows, king.row, king.col, enemy);
}

export function isCheckmate(fen) {
  return isKingInCheck(fen) && legalMoves(fen).length === 0;
}

function isSquareAttacked(rows, targetRow, targetCol, byColor) {
  const pawnDir = byColor === "w" ? -1 : 1;
  for (const colDelta of [-1, 1]) {
    const pawnRow = targetRow - pawnDir;
    const pawnCol = targetCol + colDelta;
    if (isInside(pawnRow, pawnCol) && rows[pawnRow][pawnCol] === (byColor === "w" ? "P" : "p")) {
      return true;
    }
  }

  for (const [rowDelta, colDelta] of KNIGHT_DELTAS) {
    const row = targetRow + rowDelta;
    const col = targetCol + colDelta;
    if (isInside(row, col) && rows[row][col] === (byColor === "w" ? "N" : "n")) {
      return true;
    }
  }

  if (attackedBySlider(rows, targetRow, targetCol, byColor, BISHOP_DIRECTIONS, ["b", "q"])) return true;
  if (attackedBySlider(rows, targetRow, targetCol, byColor, ROOK_DIRECTIONS, ["r", "q"])) return true;

  for (const [rowDelta, colDelta] of KING_DELTAS) {
    const row = targetRow + rowDelta;
    const col = targetCol + colDelta;
    if (isInside(row, col) && rows[row][col] === (byColor === "w" ? "K" : "k")) {
      return true;
    }
  }

  return false;
}

function attackedBySlider(rows, targetRow, targetCol, byColor, directions, pieceTypes) {
  for (const [rowDir, colDir] of directions) {
    let row = targetRow + rowDir;
    let col = targetCol + colDir;
    while (isInside(row, col)) {
      const piece = rows[row][col];
      if (!piece) {
        row += rowDir;
        col += colDir;
        continue;
      }
      if (colorOf(piece) === byColor && pieceTypes.includes(piece.toLowerCase())) return true;
      break;
    }
  }
  return false;
}

function isInside(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function isUciMove(value) {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value.trim());
}

export function sameMoveIgnoringPromotion(a, b) {
  return a.slice(0, 4) === b.slice(0, 4);
}

export function formatUci(value) {
  if (!value) return "";
  const promotion = value[4] ? `=${value[4].toUpperCase()}` : "";
  return `${value.slice(0, 2)}-${value.slice(2, 4)}${promotion}`;
}

export function moveToSquares(move) {
  if (!move) return { from: "", to: "" };
  return { from: move.slice(0, 2), to: move.slice(2, 4) };
}

export function materialCount(fen) {
  const placement = fen.split(" ")[0];
  return [...placement].filter((char) => /[pnbrqPNBRQ]/.test(char)).length;
}
