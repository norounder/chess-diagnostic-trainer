import type { Phase, Puzzle, PuzzleFamily, PuzzleObjective } from "../types/domain";
import { applyUci, countMaterial, moveNumber } from "./chess";

export type LichessImportOptions = {
  qualityFilter?: boolean;
  maxRows?: number;
};

export type LichessImportResult = {
  puzzles: Puzzle[];
  imported: number;
  skipped: number;
  errors: string[];
};

const REQUIRED_COLUMNS = [
  "PuzzleId",
  "FEN",
  "Moves",
  "Rating",
  "RatingDeviation",
  "Popularity",
  "NbPlays",
  "Themes",
  "GameUrl",
  "OpeningTags"
];

const TACTIC_THEMES = new Set([
  "fork",
  "pin",
  "skewer",
  "discoveredAttack",
  "backRankMate",
  "sacrifice",
  "mate",
  "mateIn1",
  "mateIn2",
  "mateIn3"
]);

export function parseLichessCsv(text: string, options: LichessImportOptions = {}): LichessImportResult {
  const rows = parseCsv(text.trim());
  const errors: string[] = [];
  const puzzles: Puzzle[] = [];
  if (rows.length < 2) return { puzzles, imported: 0, skipped: 0, errors: ["CSV header and at least one puzzle row are required."] };

  const header = rows[0].map((item) => item.trim());
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length) {
    return {
      puzzles,
      imported: 0,
      skipped: Math.max(0, rows.length - 1),
      errors: [`Missing required Lichess columns: ${missing.join(", ")}`]
    };
  }

  const index = new Map(header.map((name, idx) => [name, idx]));
  let skipped = 0;
  const maxRows = options.maxRows ?? 5000;

  for (const row of rows.slice(1, maxRows + 1)) {
    if (!row.some(Boolean)) continue;
    const value = (key: string) => row[index.get(key) ?? -1]?.trim() ?? "";
    const puzzleId = value("PuzzleId");
    const fenBefore = value("FEN");
    const moves = value("Moves").split(/\s+/).filter(Boolean);
    const rating = Number(value("Rating"));
    const ratingDeviation = Number(value("RatingDeviation"));
    const popularity = Number(value("Popularity"));
    const nbPlays = Number(value("NbPlays"));
    const themesRaw = value("Themes").split(/\s+/).filter(Boolean);
    const openingTagsRaw = value("OpeningTags").split(/\s+/).filter(Boolean);

    try {
      if (!puzzleId || !fenBefore || moves.length < 2) {
        skipped += 1;
        continue;
      }
      if (options.qualityFilter !== false && !passesQualityFilter({ rating, ratingDeviation, popularity, nbPlays, themesRaw })) {
        skipped += 1;
        continue;
      }

      const fenPresented = applyUci(fenBefore, moves[0]);
      const classification = classifyLichessPuzzle({
        fenBefore,
        fenPresented,
        moves,
        themesRaw,
        openingTagsRaw
      });

      puzzles.push({
        id: `lichess-${puzzleId}`,
        source: "lichess",
        sourcePuzzleId: puzzleId,
        title: titleForThemes(themesRaw, classification.phase, openingTagsRaw),
        fenBefore,
        initialOpponentMoveUci: moves[0],
        fenPresented,
        solutionMovesUci: moves.slice(1),
        rating,
        ratingDeviation,
        popularity,
        nbPlays,
        themesRaw,
        openingTagsRaw,
        phase: classification.phase,
        moveNumber: moveNumber(fenBefore),
        materialCount: countMaterial(fenPresented),
        family: classification.family,
        thinkingSkills: classification.thinkingSkills,
        explanation: "Lichess Puzzle DB에서 가져온 검증 퍼즐입니다. 해설은 풀이 후 기준 수순과 Stockfish 평가로 보강됩니다.",
        sourceGameUrl: value("GameUrl"),
        objective: objectiveFor(themesRaw, moves.slice(1))
      });
    } catch (error) {
      skipped += 1;
      if (errors.length < 8) errors.push(`${puzzleId || "unknown"}: ${(error as Error).message}`);
    }
  }

  return { puzzles, imported: puzzles.length, skipped, errors };
}

function passesQualityFilter({
  rating,
  ratingDeviation,
  popularity,
  nbPlays,
  themesRaw
}: {
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  themesRaw: string[];
}) {
  if (!Number.isFinite(rating) || rating < 800 || rating > 2200) return false;
  if (!Number.isFinite(ratingDeviation) || ratingDeviation > 120) return false;
  if (!Number.isFinite(popularity) || popularity < 70) return false;
  if (!Number.isFinite(nbPlays) || nbPlays < 50) return false;
  const themeSet = new Set(themesRaw);
  return !["oneMove", "veryLong", "quietMove"].some((theme) => themeSet.has(theme));
}

function classifyLichessPuzzle({
  fenBefore,
  fenPresented,
  moves,
  themesRaw,
  openingTagsRaw
}: {
  fenBefore: string;
  fenPresented: string;
  moves: string[];
  themesRaw: string[];
  openingTagsRaw: string[];
}) {
  const themeSet = new Set(themesRaw);
  const material = countMaterial(fenPresented);
  const hasQueen = /q|Q/.test(fenPresented.split(" ")[0]);
  const plyMoveNumber = moveNumber(fenBefore);

  let phase: Phase = "middlegame";
  if (
    themeSet.has("endgame") ||
    themeSet.has("pawnEndgame") ||
    themeSet.has("rookEndgame") ||
    themeSet.has("queenEndgame") ||
    material <= 8 ||
    (!hasQueen && material <= 12)
  ) {
    phase = "endgame";
  } else if (openingTagsRaw.length > 0 || plyMoveNumber <= 12 || themeSet.has("opening")) {
    phase = "opening";
  }

  let family: PuzzleFamily = "calculation";
  if (phase === "endgame" || themeSet.has("pawnEndgame") || themeSet.has("rookEndgame") || themeSet.has("queenEndgame")) {
    family = "endgame";
  } else if (themeSet.has("defensiveMove")) {
    family = "defense";
  } else if (themesRaw.some((theme) => TACTIC_THEMES.has(theme))) {
    family = "tactics";
  } else if (phase === "opening") {
    family = "opening-transition";
  }

  const thinkingSkills = new Set<string>();
  if (themesRaw.some((theme) => ["mate", "mateIn1", "mateIn2", "mateIn3", "fork", "pin", "skewer"].includes(theme))) {
    thinkingSkills.add("forcing_moves");
    thinkingSkills.add("candidate_moves");
  }
  if (themeSet.has("defensiveMove")) {
    thinkingSkills.add("threat_awareness");
    thinkingSkills.add("defensive_resource");
  }
  if (phase === "endgame" || themeSet.has("pawnEndgame") || themeSet.has("rookEndgame")) {
    thinkingSkills.add("endgame_counting");
    thinkingSkills.add("conversion_technique");
  }
  if (moves.length >= 4 || themeSet.has("advantage")) {
    thinkingSkills.add("calculation_depth");
  }
  if (!thinkingSkills.size) thinkingSkills.add("candidate_moves");

  return { phase, family, thinkingSkills: [...thinkingSkills] };
}

function objectiveFor(themesRaw: string[], solutionMoves: string[]): PuzzleObjective {
  if (themesRaw.includes("mateIn1") && solutionMoves.length === 1) {
    return { type: "checkmate", plies: 1, acceptEquivalent: true };
  }
  return { type: "line" };
}

function titleForThemes(themesRaw: string[], phase: Phase, openingTagsRaw: string[] = []) {
  if (phase === "opening" && openingTagsRaw.length) return `${formatOpeningTag(openingTagsRaw[0])} 전환`;
  if (themesRaw.includes("defensiveMove")) return "수비 자원 발견";
  if (themesRaw.includes("mateIn1")) return "메이트 1수";
  if (themesRaw.includes("mateIn2")) return "메이트 2수";
  if (themesRaw.includes("backRankMate")) return "백랭크 메이트";
  if (themesRaw.includes("pin")) return "핀 활용";
  if (themesRaw.includes("fork")) return "포크 전술";
  if (phase === "endgame") return "엔드게임 계산";
  return "최선의 수 찾기";
}

function formatOpeningTag(tag: string) {
  return tag.replaceAll("_", " ");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  rows.push(row);
  return rows.filter((items) => items.some((item) => item.trim()));
}
