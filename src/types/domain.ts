export type PuzzleSource = "curated" | "lichess";
export type Phase = "opening" | "middlegame" | "endgame";
export type PuzzleFamily = "tactics" | "defense" | "calculation" | "endgame" | "opening-transition";

export type PuzzleObjective =
  | { type: "checkmate"; plies: number; acceptEquivalent: boolean }
  | { type: "line"; acceptEquivalent?: false };

export type Puzzle = {
  id: string;
  source: PuzzleSource;
  sourcePuzzleId: string;
  title: string;
  fenBefore: string;
  initialOpponentMoveUci: string;
  fenPresented: string;
  solutionMovesUci: string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  themesRaw: string[];
  openingTagsRaw: string[];
  phase: Phase;
  moveNumber: number;
  materialCount: number;
  family: PuzzleFamily;
  thinkingSkills: string[];
  explanation: string;
  sourceGameUrl: string;
  objective?: PuzzleObjective;
};

export type AttemptResult =
  | "SOLVED_CLEAN"
  | "SOLVED_SLOW"
  | "FIRST_MOVE_WRONG"
  | "LINE_FAILED"
  | "GAVE_UP"
  | "ILLEGAL_MOVE";

export type StockfishEvaluation = {
  bestMove?: string;
  scoreCp?: number;
  mate?: number;
  depth?: number;
  pv?: string[];
};

export type MistakeEvaluation = {
  status: "idle" | "pending" | "ready" | "unavailable";
  best?: StockfishEvaluation;
  after?: StockfishEvaluation;
  evalLossCp?: number;
  message?: string;
};

export type Attempt = {
  id: string;
  puzzleId: string;
  resultType: AttemptResult;
  firstMoveCorrect: boolean;
  fullLineCorrect: boolean;
  timeMs: number;
  hintCount: number;
  userMovesUci: string[];
  mistakeReason: string[];
  puzzleRating: number;
  acceptedBy?: "line" | "objective";
  stockfish?: MistakeEvaluation;
  createdAt: string;
};

export type ReviewCard = {
  id: string;
  puzzleId: string;
  dueAt: number;
  intervalDays: number;
  ease: number;
  failureCount: number;
  lastResult: AttemptResult;
};

export type Session = {
  id: string;
  mode: string;
  puzzleIds: string[];
  startedAt: string;
  endedAt?: string | null;
};

export type MoveLogItem = {
  actor: "context" | "user" | "opponent";
  move: string;
  san?: string;
  note: string;
};
