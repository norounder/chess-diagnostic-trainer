import type { Attempt, Puzzle, ReviewCard, Session } from "../types/domain";

const STORAGE_VERSION = "5-react-stockfish";
const VERSION_KEY = "cdt.storageVersion";
const ATTEMPTS_KEY = "cdt.attempts.v2";
const REVIEW_KEY = "cdt.reviewCards.v2";
const CUSTOM_PUZZLES_KEY = "cdt.customPuzzles.v2";
const SESSION_KEY = "cdt.session.v2";

export function initializeStorage() {
  if (localStorage.getItem(VERSION_KEY) === STORAGE_VERSION) return;
  clearAllData();
  localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
}

export function getAttempts(): Attempt[] {
  return readJson(ATTEMPTS_KEY, []);
}

export function saveAttempt(attempt: Attempt) {
  writeJson(ATTEMPTS_KEY, [attempt, ...getAttempts()]);
}

export function updateAttemptStockfish(attemptId: string, stockfish: Attempt["stockfish"]) {
  writeJson(ATTEMPTS_KEY, getAttempts().map((attempt) => (
    attempt.id === attemptId ? { ...attempt, stockfish } : attempt
  )));
}

export function updateAttemptReasons(attemptId: string, mistakeReason: string[]) {
  writeJson(ATTEMPTS_KEY, getAttempts().map((attempt) => (
    attempt.id === attemptId ? { ...attempt, mistakeReason } : attempt
  )));
}

export function getReviewCards(): ReviewCard[] {
  return readJson(REVIEW_KEY, []);
}

export function scheduleReview(attempt: Attempt) {
  const cards = getReviewCards();
  const existing = cards.find((card) => card.puzzleId === attempt.puzzleId);
  const failed = !attempt.fullLineCorrect || attempt.resultType === "GAVE_UP";
  const nextCard: ReviewCard = {
    id: existing?.id ?? crypto.randomUUID(),
    puzzleId: attempt.puzzleId,
    dueAt: failed ? Date.now() : Date.now() + 24 * 60 * 60 * 1000,
    intervalDays: failed ? 0 : Math.max(1, existing?.intervalDays ?? 1),
    ease: failed ? Math.max(1.3, (existing?.ease ?? 2.2) - 0.2) : Math.min(2.8, (existing?.ease ?? 2.2) + 0.08),
    failureCount: failed ? (existing?.failureCount ?? 0) + 1 : Math.max(0, (existing?.failureCount ?? 0) - 1),
    lastResult: attempt.resultType
  };
  writeJson(REVIEW_KEY, existing ? cards.map((card) => card.puzzleId === attempt.puzzleId ? nextCard : card) : [...cards, nextCard]);
}

export function getCustomPuzzles(): Puzzle[] {
  return readJson<Puzzle[]>(CUSTOM_PUZZLES_KEY, []).filter((puzzle) => puzzle.source !== "curated");
}

export function saveCustomPuzzles(puzzles: Puzzle[]) {
  const byId = new Map(getCustomPuzzles().map((puzzle) => [puzzle.id, puzzle]));
  for (const puzzle of puzzles) byId.set(puzzle.id, puzzle);
  writeJson(CUSTOM_PUZZLES_KEY, [...byId.values()]);
}

export function getSession(): Session | null {
  return readJson<Session | null>(SESSION_KEY, null);
}

export function saveSession(session: Session) {
  writeJson(SESSION_KEY, session);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function clearAllData() {
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(REVIEW_KEY);
  localStorage.removeItem(CUSTOM_PUZZLES_KEY);
  localStorage.removeItem(SESSION_KEY);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}
