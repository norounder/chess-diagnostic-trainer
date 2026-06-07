import { useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardList,
  Database,
  RotateCw,
  Route,
  Target,
  Upload
} from "lucide-react";
import { SAMPLE_PUZZLES } from "./puzzles.js";
import type { Attempt, AttemptResult, MoveLogItem, Puzzle, ReviewCard, Session } from "./types/domain";
import {
  applyUci,
  formatUci,
  isCheckmateAfter,
  isLegalUci,
  isSidePiece,
  legalTargets,
  legalUciMoves,
  moveSquares,
  normalizeUci,
  sanForUci,
  sideToMoveLabel,
  tryApplyUci
} from "./lib/chess";
import {
  clearAllData,
  clearSession,
  getAttempts,
  getCustomPuzzles,
  getReviewCards,
  getSession,
  initializeStorage,
  saveAttempt,
  saveCustomPuzzles,
  saveSession,
  scheduleReview,
  updateAttemptReasons,
  updateAttemptStockfish
} from "./lib/storage";
import {
  FAMILY_LABELS,
  MISTAKE_REASONS,
  PHASE_LABELS,
  RESULT_LABELS,
  computeReport,
  estimateRating,
  labelsForPuzzle,
  percent,
  readableTag,
  scoreAttempt,
  seconds
} from "./lib/diagnostics";
import { parseLichessCsv } from "./lib/lichess";
import { evaluateMistake } from "./lib/stockfish";

type Page = "dashboard" | "trainer" | "opening" | "reports" | "review" | "library" | "status";
type SessionMode = "balanced" | "weakness" | "review" | "opening";

const seedPuzzles = SAMPLE_PUZZLES as Puzzle[];

export function App() {
  const [page, setPage] = useState<Page>("trainer");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([]);
  const [customPuzzles, setCustomPuzzles] = useState<Puzzle[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");

  useEffect(() => {
    initializeStorage();
    setAttempts(getAttempts());
    setReviewCards(getReviewCards());
    setCustomPuzzles(getCustomPuzzles());
    setSession(getSession());
  }, []);

  const puzzles = useMemo(() => [...customPuzzles, ...seedPuzzles], [customPuzzles]);
  const puzzleById = useMemo(() => new Map(puzzles.map((puzzle) => [puzzle.id, puzzle])), [puzzles]);
  const report = useMemo(() => computeReport(attempts, puzzles), [attempts, puzzles]);
  const estimatedRating = useMemo(() => estimateRating(attempts, puzzles), [attempts, puzzles]);

  useEffect(() => {
    if (!session && puzzles.length) {
      const nextSession = buildSession("balanced", puzzles, attempts, reviewCards);
      setSession(nextSession);
      saveSession(nextSession);
    }
  }, [attempts, puzzles, reviewCards, session]);

  const sessionPuzzles = useMemo(
    () => (session?.puzzleIds ?? []).map((id) => puzzleById.get(id)).filter((puzzle): puzzle is Puzzle => Boolean(puzzle)),
    [puzzleById, session]
  );
  const currentPuzzle = sessionPuzzles[currentIndex] ?? sessionPuzzles[0] ?? puzzles[0];

  function refreshState() {
    setAttempts(getAttempts());
    setReviewCards(getReviewCards());
    setCustomPuzzles(getCustomPuzzles());
  }

  function startSession(mode: SessionMode) {
    if (mode === "opening" && !puzzles.some(isOpeningPuzzle)) {
      setPage("opening");
      return;
    }
    const nextSession = buildSession(mode, puzzles, attempts, reviewCards);
    setSession(nextSession);
    saveSession(nextSession);
    setCurrentIndex(0);
    setPage("trainer");
  }

  function hardReset() {
    clearAllData();
    clearSession();
    setAttempts([]);
    setReviewCards([]);
    setCustomPuzzles([]);
    const nextSession = buildSession("balanced", seedPuzzles, [], []);
    setSession(nextSession);
    saveSession(nextSession);
    setCurrentIndex(0);
  }

  return (
    <div className="platform">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CDT</div>
          <div>
            <h1>Chess Diagnostic Trainer</h1>
            <p>정답률보다 약점 구조를 추적하는 개인 훈련 플랫폼</p>
          </div>
        </div>
        <nav className="side-nav">
          <NavButton icon={<Activity size={17} />} active={page === "dashboard"} onClick={() => setPage("dashboard")}>대시보드</NavButton>
          <NavButton icon={<Target size={17} />} active={page === "trainer"} onClick={() => setPage("trainer")}>훈련</NavButton>
          <NavButton icon={<Route size={17} />} active={page === "opening"} onClick={() => setPage("opening")}>오프닝</NavButton>
          <NavButton icon={<BarChart3 size={17} />} active={page === "reports"} onClick={() => setPage("reports")}>리포트</NavButton>
          <NavButton icon={<ClipboardList size={17} />} active={page === "review"} onClick={() => setPage("review")}>복습</NavButton>
          <NavButton icon={<Database size={17} />} active={page === "library"} onClick={() => setPage("library")}>문제/데이터</NavButton>
          <NavButton icon={<BookOpen size={17} />} active={page === "status"} onClick={() => setPage("status")}>구현 상태</NavButton>
        </nav>
        <div className="side-status">
          <span>추정 레이팅 {estimatedRating}</span>
          <span>기록 {attempts.length}회</span>
          <span>문제 {puzzles.length}개</span>
        </div>
      </aside>

      <main className="workspace">
        {page === "dashboard" && (
          <DashboardPage report={report} attempts={attempts} startSession={startSession} />
        )}
        {page === "trainer" && currentPuzzle && (
          <TrainerPage
            puzzle={currentPuzzle}
            puzzleNumber={Math.min(currentIndex + 1, sessionPuzzles.length || 1)}
            puzzleTotal={sessionPuzzles.length || 1}
            estimatedRating={estimatedRating}
            boardOrientation={boardOrientation}
            setBoardOrientation={setBoardOrientation}
            activeAttempt={attempts.find((attempt) => attempt.puzzleId === currentPuzzle.id)}
            onAttempt={(attempt, stockfishInput) => {
              saveAttempt(attempt);
              scheduleReview(attempt);
              refreshState();
              if (stockfishInput) {
                void evaluateMistake(stockfishInput.beforeFen, stockfishInput.userMove).then((evaluation) => {
                  updateAttemptStockfish(attempt.id, evaluation);
                  refreshState();
                });
              }
            }}
            onReasonChange={(attemptId, reasons) => {
              updateAttemptReasons(attemptId, reasons);
              refreshState();
            }}
            onNext={() => setCurrentIndex((index) => Math.min(index + 1, Math.max(0, sessionPuzzles.length - 1)))}
            onRestartSession={() => startSession("balanced")}
            canAdvance={currentIndex < sessionPuzzles.length - 1}
          />
        )}
        {page === "opening" && (
          <OpeningPage puzzles={puzzles} attempts={attempts} startSession={startSession} setPage={setPage} />
        )}
        {page === "reports" && (
          <ReportsPage report={report} />
        )}
        {page === "review" && (
          <ReviewPage cards={reviewCards} puzzleById={puzzleById} startSession={startSession} />
        )}
        {page === "library" && (
          <LibraryPage
            puzzles={puzzles}
            importedCount={customPuzzles.length}
            onImport={(nextPuzzles) => {
              saveCustomPuzzles(nextPuzzles);
              refreshState();
              const nextSession = buildSession("balanced", [...nextPuzzles, ...seedPuzzles], attempts, reviewCards);
              setSession(nextSession);
              saveSession(nextSession);
              setCurrentIndex(0);
            }}
          />
        )}
        {page === "status" && (
          <StatusPage hardReset={hardReset} />
        )}
      </main>
    </div>
  );
}

function TrainerPage({
  puzzle,
  puzzleNumber,
  puzzleTotal,
  estimatedRating,
  boardOrientation,
  setBoardOrientation,
  activeAttempt,
  onAttempt,
  onReasonChange,
  onNext,
  onRestartSession,
  canAdvance
}: {
  puzzle: Puzzle;
  puzzleNumber: number;
  puzzleTotal: number;
  estimatedRating: number;
  boardOrientation: "white" | "black";
  setBoardOrientation: (orientation: "white" | "black") => void;
  activeAttempt?: Attempt;
  onAttempt: (attempt: Attempt, stockfishInput?: { beforeFen: string; userMove: string }) => void;
  onReasonChange: (attemptId: string, reasons: string[]) => void;
  onNext: () => void;
  onRestartSession: () => void;
  canAdvance: boolean;
}) {
  const [currentFen, setCurrentFen] = useState(puzzle.fenPresented);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastUserMove, setLastUserMove] = useState("");
  const [lastOpponentMove, setLastOpponentMove] = useState(puzzle.initialOpponentMoveUci);
  const [moveLog, setMoveLog] = useState<MoveLogItem[]>([]);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [hintCount, setHintCount] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [uciInput, setUciInput] = useState("");
  const [latestAttemptId, setLatestAttemptId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentFen(puzzle.fenPresented);
    setSolutionIndex(0);
    setSelectedSquare(null);
    setLastUserMove("");
    setLastOpponentMove(puzzle.initialOpponentMoveUci);
    setMoveLog([]);
    setStartedAt(Date.now());
    setHintCount(0);
    setHintVisible(false);
    setUciInput("");
    setLatestAttemptId(null);
  }, [puzzle.id, puzzle.fenPresented, puzzle.initialOpponentMoveUci]);

  const attempt = latestAttemptId ? activeAttempt : undefined;
  const resultLocked = Boolean(attempt);
  const targetSquares = selectedSquare && !resultLocked ? legalTargets(currentFen, selectedSquare) : [];
  const squareStyles = buildSquareStyles({ selectedSquare, targetSquares, lastUserMove, lastOpponentMove });
  const expectedPly = puzzle.solutionMovesUci.length - solutionIndex;
  const score = attempt ? scoreAttempt({
    resultType: attempt.resultType,
    hintCount: attempt.hintCount,
    timeMs: attempt.timeMs,
    puzzleRating: attempt.puzzleRating,
    estimatedRating
  }) : null;

  function submitUci(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeUci(uciInput);
    if (normalized.length < 4) return;
    playMove(normalized.slice(0, 2), normalized.slice(2, 4), normalized[4]);
    setUciInput("");
  }

  function playMove(from: string, to: string, promotion?: string) {
    if (resultLocked) return false;
    const uci = resolveLegalMove(currentFen, from, to, promotion);
    if (!uci) {
      recordFinalAttempt("ILLEGAL_MOVE", false, false, [], undefined, undefined);
      return false;
    }

    const beforeFen = currentFen;
    const applied = tryApplyUci(beforeFen, uci);
    if (!applied) {
      recordFinalAttempt("ILLEGAL_MOVE", false, false, [], undefined, undefined);
      return false;
    }

    const expected = puzzle.solutionMovesUci[solutionIndex];
    const lineMatch = isExpectedMove(uci, expected);
    const objectiveMatch = isObjectiveSolution(puzzle, beforeFen, uci, solutionIndex);
    const accepted = lineMatch || objectiveMatch;

    if (!accepted) {
      setCurrentFen(applied.fen);
      setLastUserMove(uci);
      const userSan = sanForUci(beforeFen, uci);
      setMoveLog([{ actor: "user", move: uci, san: userSan, note: "사용자 입력" }]);
      const firstMoveCorrect = solutionIndex > 0;
      recordFinalAttempt(
        solutionIndex === 0 ? "FIRST_MOVE_WRONG" : "LINE_FAILED",
        firstMoveCorrect,
        false,
        [uci],
        "line",
        { beforeFen, userMove: uci }
      );
      return true;
    }

    const userSan = sanForUci(beforeFen, uci);
    const nextLog: MoveLogItem[] = [...moveLog, { actor: "user", move: uci, san: userSan, note: "사용자 입력" }];
    setLastUserMove(uci);
    setSelectedSquare(null);

    if (objectiveMatch || solutionIndex + 1 >= puzzle.solutionMovesUci.length) {
      setCurrentFen(applied.fen);
      setMoveLog(nextLog);
      recordFinalAttempt(
        buildSolvedResult(Date.now() - startedAt, hintCount),
        true,
        true,
        [...nextLog.filter((item) => item.actor === "user").map((item) => item.move)],
        objectiveMatch && !lineMatch ? "objective" : "line"
      );
      return true;
    }

    const opponentMove = puzzle.solutionMovesUci[solutionIndex + 1];
    try {
      const opponentSan = sanForUci(applied.fen, opponentMove);
      const afterOpponent = applyUci(applied.fen, opponentMove);
      const revealedLog = [...nextLog, { actor: "opponent" as const, move: opponentMove, san: opponentSan, note: "상대 응수" }];
      setCurrentFen(afterOpponent);
      setLastOpponentMove(opponentMove);
      setMoveLog(revealedLog);
      const nextIndex = solutionIndex + 2;
      setSolutionIndex(nextIndex);
      if (nextIndex >= puzzle.solutionMovesUci.length) {
        recordFinalAttempt(
          buildSolvedResult(Date.now() - startedAt, hintCount),
          true,
          true,
          revealedLog.filter((item) => item.actor === "user").map((item) => item.move),
          "line"
        );
      }
    } catch {
      recordFinalAttempt("LINE_FAILED", true, false, [uci], "line", { beforeFen, userMove: uci });
    }
    return true;
  }

  function recordFinalAttempt(
    resultType: AttemptResult,
    firstMoveCorrect: boolean,
    fullLineCorrect: boolean,
    userMovesUci: string[],
    acceptedBy?: "line" | "objective",
    stockfishInput?: { beforeFen: string; userMove: string }
  ) {
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      puzzleId: puzzle.id,
      resultType,
      firstMoveCorrect,
      fullLineCorrect,
      timeMs: Date.now() - startedAt,
      hintCount,
      userMovesUci,
      mistakeReason: [],
      puzzleRating: puzzle.rating,
      acceptedBy,
      stockfish: stockfishInput ? { status: "pending", message: "Stockfish가 오답을 평가하는 중입니다." } : undefined,
      createdAt: new Date().toISOString()
    };
    setLatestAttemptId(attempt.id);
    onAttempt(attempt, stockfishInput);
  }

  function toggleReason(reasonId: string) {
    if (!attempt) return;
    const nextReasons = attempt.mistakeReason.includes(reasonId)
      ? attempt.mistakeReason.filter((item) => item !== reasonId)
      : [...attempt.mistakeReason, reasonId];
    onReasonChange(attempt.id, nextReasons);
  }

  return (
    <div className="trainer-layout">
      <section className="board-panel">
        <div className="board-toolbar">
          <div>
            <p className="eyebrow">Training Board</p>
            <h2>{sideToMoveLabel(currentFen)} 차례</h2>
          </div>
          <button
            type="button"
            onClick={() => setBoardOrientation(boardOrientation === "white" ? "black" : "white")}
            title="보드 방향 전환"
          >
            <RotateCw size={16} /> {boardOrientation === "white" ? "백 기준" : "흑 기준"}
          </button>
        </div>
        <div className="board-shell">
          <Chessboard
            options={{
              position: currentFen,
              boardOrientation,
              allowDragging: !resultLocked,
              showNotation: true,
              animationDurationInMs: 140,
              boardStyle: {
                width: "100%",
                aspectRatio: "1",
                border: "3px solid #27362f",
                borderRadius: "7px",
                overflow: "hidden"
              },
              lightSquareStyle: { backgroundColor: "var(--light-square)" },
              darkSquareStyle: { backgroundColor: "var(--dark-square)" },
              squareStyles,
              canDragPiece: ({ piece }) => isSidePiece(currentFen, piece?.pieceType),
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                if (!targetSquare) return false;
                return playMove(sourceSquare, targetSquare);
              },
              onSquareClick: ({ piece, square }) => {
                if (resultLocked) return;
                if (selectedSquare && targetSquares.includes(square)) {
                  playMove(selectedSquare, square);
                  return;
                }
                if (piece && isSidePiece(currentFen, piece.pieceType)) {
                  setSelectedSquare(square);
                } else {
                  setSelectedSquare(null);
                }
              }
            }}
          />
        </div>
        <div className="move-legend">
          <span className="legend-opponent">상대가 실제로 둔 직전 수</span>
          <span className="legend-user">내가 방금 둔 수</span>
          <span className="legend-legal">선택한 말의 이동 가능 칸</span>
        </div>
      </section>

      <section className="trainer-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">문제 {puzzleNumber} / {puzzleTotal}</p>
            <h2>{puzzle.title}</h2>
          </div>
          <div className="rating">{puzzle.rating}</div>
        </div>

        <div className="meta-grid">
          <div><span>국면</span><strong>{PHASE_LABELS[puzzle.phase]}</strong></div>
          <div><span>계열</span><strong>{FAMILY_LABELS[puzzle.family]}</strong></div>
          <div><span>해결 분량</span><strong>{humanPly(puzzle)}</strong></div>
          <div><span>출처</span><strong>{puzzle.source === "lichess" ? `Lichess RD ${puzzle.ratingDeviation}` : "검증 seed"}</strong></div>
        </div>
        <div className="tag-list">
          {labelsForPuzzle(puzzle).slice(0, 8).map((label) => <span key={label}>{label}</span>)}
        </div>

        {!attempt && (
          <div className="move-tools">
            <div className="tool-header">
              <h3>목표</h3>
              <span>최선의 수를 입력하세요. 남은 수순 {Math.max(1, expectedPly)} ply</span>
            </div>
            <form className="uci-form" onSubmit={submitUci}>
              <input
                value={uciInput}
                onChange={(event) => setUciInput(event.target.value)}
                placeholder="예: e2e4"
                aria-label="UCI move"
              />
              <button className="primary" type="submit">입력</button>
            </form>
            <div className="button-row">
              <button type="button" onClick={() => {
                setHintCount((count) => count + 1);
                setHintVisible(true);
              }}>힌트</button>
              <button type="button" onClick={() => {
                setCurrentFen(puzzle.fenPresented);
                setSolutionIndex(0);
                setSelectedSquare(null);
                setLastUserMove("");
                setLastOpponentMove(puzzle.initialOpponentMoveUci);
                setMoveLog([]);
                setStartedAt(Date.now());
                setHintVisible(false);
              }}>초기화</button>
              <button type="button" onClick={() => recordFinalAttempt("GAVE_UP", false, false, [], "line")}>포기</button>
            </div>
            {hintVisible && (
              <div className="hint">체크, 잡는 수, 직접 위협을 먼저 훑고 상대의 강제 응수를 한 번 더 확인하세요.</div>
            )}
          </div>
        )}

        {attempt && (
          <ResultPanel
            puzzle={puzzle}
            attempt={attempt}
            score={score ?? 0}
            onReasonToggle={toggleReason}
            onNext={canAdvance ? onNext : onRestartSession}
            nextLabel={canAdvance ? "다음 문제" : "새 균형 세션"}
          />
        )}

        <div className="session-mix">
          <h3>오늘의 구성</h3>
          <div className="mix-row"><span>약점 기반</span><strong>5</strong></div>
          <div className="mix-row"><span>복습 예정</span><strong>3</strong></div>
          <div className="mix-row"><span>균형 유지</span><strong>2</strong></div>
          <div className="mix-row"><span>새 난이도 도전</span><strong>2</strong></div>
        </div>
      </section>
    </div>
  );
}

function ResultPanel({
  puzzle,
  attempt,
  score,
  onReasonToggle,
  onNext,
  nextLabel
}: {
  puzzle: Puzzle;
  attempt: Attempt;
  score: number;
  onReasonToggle: (reasonId: string) => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const solved = attempt.fullLineCorrect;
  return (
    <div className={`result-panel ${solved ? "solved" : "failed"}`}>
      <div className="result-head">
        <div>
          <h3>{RESULT_LABELS[attempt.resultType]}</h3>
          <span>{seconds(attempt.timeMs)} · 점수 {score.toFixed(2)}</span>
        </div>
        {attempt.acceptedBy === "objective" && <strong>동일 메이트 인정</strong>}
      </div>

      <div className="line-compare">
        <div>
          <span>내가 둔 수</span>
          <strong>{attempt.userMovesUci.length ? attempt.userMovesUci.map(formatUci).join(" ") : "-"}</strong>
        </div>
        <div>
          <span>기준 해답</span>
          <strong>{puzzle.solutionMovesUci.map(formatUci).join(" ")}</strong>
        </div>
      </div>

      {attempt.acceptedBy === "objective" && (
        <p className="hint">기준 해답과 달라도 현재 포지션의 목적이 체크메이트라면 정답으로 처리합니다.</p>
      )}

      {!solved && (
        <>
          <StockfishPanel attempt={attempt} />
          <fieldset className="reason-list">
            <legend>내가 느낀 오답 이유</legend>
            {MISTAKE_REASONS.map((reason) => (
              <label key={reason.id}>
                <input
                  type="checkbox"
                  checked={attempt.mistakeReason.includes(reason.id)}
                  onChange={() => onReasonToggle(reason.id)}
                />
                {reason.label}
              </label>
            ))}
          </fieldset>
        </>
      )}

      <button className="primary wide" type="button" onClick={onNext}>{nextLabel}</button>
    </div>
  );
}

function StockfishPanel({ attempt }: { attempt: Attempt }) {
  const stockfish = attempt.stockfish;
  if (!stockfish) return null;
  if (stockfish.status === "pending") return <div className="engine-card">Stockfish 평가 중입니다.</div>;
  if (stockfish.status === "unavailable") return <div className="engine-card muted">{stockfish.message}</div>;
  return (
    <div className="engine-card">
      <strong>Stockfish 오답 평가</strong>
      <p>{stockfish.message}</p>
      <div className="engine-metrics">
        <span>최선수 {formatUci(stockfish.best?.bestMove)}</span>
        <span>손실 {stockfish.evalLossCp ?? "-"} cp</span>
        <span>Depth {stockfish.best?.depth ?? "-"}</span>
      </div>
    </div>
  );
}

function DashboardPage({
  report,
  attempts,
  startSession
}: {
  report: ReturnType<typeof computeReport>;
  attempts: Attempt[];
  startSession: (mode: SessionMode) => void;
}) {
  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>진단 대시보드</h2>
        </div>
        <div className="button-row no-margin">
          <button className="primary" onClick={() => startSession("weakness")}>약점 세션</button>
          <button onClick={() => startSession("opening")}>오프닝 세션</button>
          <button onClick={() => startSession("review")}>복습 세션</button>
        </div>
      </div>
      <div className="metric-grid">
        <div><span>전체 풀이</span><strong>{attempts.length}</strong></div>
        <div><span>최근 정답률</span><strong>{percent(report.totals.accuracy)}</strong></div>
        <div><span>첫 수 정답률</span><strong>{percent(report.totals.firstMoveRate)}</strong></div>
        <div><span>라인 완성률</span><strong>{percent(report.totals.lineRate)}</strong></div>
      </div>
      <div className="dashboard-grid">
        <CoachPanel report={report} />
        <StatsPanel title="국면별" stats={report.phases} />
        <StatsPanel title="사고 과정" stats={report.thinkingSkills} />
      </div>
    </div>
  );
}

function OpeningPage({
  puzzles,
  attempts,
  startSession,
  setPage
}: {
  puzzles: Puzzle[];
  attempts: Attempt[];
  startSession: (mode: SessionMode) => void;
  setPage: (page: Page) => void;
}) {
  const openingPuzzles = puzzles.filter(isOpeningPuzzle);
  const openingIds = new Set(openingPuzzles.map((puzzle) => puzzle.id));
  const openingAttempts = attempts.filter((attempt) => openingIds.has(attempt.puzzleId));
  const openingTags = buildOpeningTagStats(openingPuzzles, attempts);
  const importedOpeningCount = openingPuzzles.filter((puzzle) => puzzle.source === "lichess").length;
  const accuracy = openingAttempts.length
    ? openingAttempts.filter((attempt) => attempt.fullLineCorrect).length / openingAttempts.length
    : 0;
  const firstMoveRate = openingAttempts.length
    ? openingAttempts.filter((attempt) => attempt.firstMoveCorrect).length / openingAttempts.length
    : 0;

  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">Opening Lab</p>
          <h2>오프닝 진단 훈련</h2>
        </div>
        <div className="button-row no-margin">
          <button className="primary" disabled={!openingPuzzles.length} onClick={() => startSession("opening")}>오프닝 세션 시작</button>
          <button onClick={() => setPage("library")}>Lichess CSV import</button>
        </div>
      </div>

      <div className="metric-grid">
        <div><span>오프닝 문제</span><strong>{openingPuzzles.length}</strong></div>
        <div><span>Lichess 기반</span><strong>{importedOpeningCount}</strong></div>
        <div><span>오프닝 정답률</span><strong>{percent(accuracy)}</strong></div>
        <div><span>첫 수 감각</span><strong>{percent(firstMoveRate)}</strong></div>
      </div>

      {!openingPuzzles.length && (
        <section className="panel coach-panel">
          <h3>오프닝 데이터가 아직 없습니다</h3>
          <div className="coach-lines">
            <p>오프닝 훈련은 검증되지 않은 더미 문제로 채우지 않습니다.</p>
            <p>Lichess Puzzle CSV를 import하면 `OpeningTags`가 있거나 초반으로 분류된 문제를 오프닝 세션에 자동 배치합니다.</p>
            <p>이 모드는 정석 암기보다 초반 전환, 개발 실수, 초반 전술 실패를 진단하는 데 초점을 둡니다.</p>
          </div>
        </section>
      )}

      <div className="dashboard-grid">
        <section className="panel">
          <h3>오프닝 태그별 성과</h3>
          {openingTags.length ? openingTags.slice(0, 10).map((item) => (
            <div className="stat-row" key={item.key}>
              <div className="stat-label">
                <strong>{item.label}</strong>
                <span>{item.attemptsCount}회 · 문제 {item.puzzleCount}개</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.round(item.accuracy * 100)}%` }} />
              </div>
              <div className="bar-value">{percent(item.accuracy)}</div>
            </div>
          )) : <p className="empty">오프닝 태그가 있는 풀이 기록이 아직 없습니다.</p>}
        </section>

        <section className="panel">
          <h3>오프닝 훈련 구성</h3>
          <div className="mix-row"><span>OpeningTags 기반 퍼즐</span><strong>{openingPuzzles.filter((puzzle) => puzzle.openingTagsRaw.length).length}</strong></div>
          <div className="mix-row"><span>초반 전환 전술</span><strong>{openingPuzzles.filter((puzzle) => puzzle.family === "opening-transition").length}</strong></div>
          <div className="mix-row"><span>초반 강제수/후보수</span><strong>{openingPuzzles.filter((puzzle) => puzzle.thinkingSkills.includes("forcing_moves") || puzzle.thinkingSkills.includes("candidate_moves")).length}</strong></div>
          <p className="empty">세션은 오프닝 문제만 사용합니다. 오프닝 데이터가 없으면 일반 전술 문제로 대체하지 않습니다.</p>
        </section>
      </div>

      <section className="panel">
        <h3>최근 오프닝 문제</h3>
        <div className="library-grid">
          {openingPuzzles.slice(0, 12).map((puzzle) => (
            <div className="puzzle-row" key={puzzle.id}>
              <div>
                <strong>{openingName(puzzle)}</strong>
                <span>{puzzle.title} · {puzzle.rating} · {puzzle.source}</span>
              </div>
              <span>{puzzle.openingTagsRaw.length ? "태그 있음" : "초반 분류"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportsPage({ report }: { report: ReturnType<typeof computeReport> }) {
  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>약점 리포트</h2>
        </div>
      </div>
      <div className="report-grid">
        <StatsPanel title="국면별 리포트" stats={report.phases} />
        <StatsPanel title="오프닝별 리포트" stats={report.openings} />
        <StatsPanel title="테마별 리포트" stats={report.themes} />
        <StatsPanel title="사고 과정 리포트" stats={report.thinkingSkills} />
        <StatsPanel title="계열별 리포트" stats={report.families} />
      </div>
      <CoachPanel report={report} />
    </div>
  );
}

function ReviewPage({
  cards,
  puzzleById,
  startSession
}: {
  cards: ReviewCard[];
  puzzleById: Map<string, Puzzle>;
  startSession: (mode: SessionMode) => void;
}) {
  const due = cards.filter((card) => card.dueAt <= Date.now());
  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">Review Queue</p>
          <h2>복습 예정 문제</h2>
        </div>
        <button className="primary" onClick={() => startSession("review")}>복습 세션 시작</button>
      </div>
      <section className="panel review-list">
        {due.length ? due.map((card) => {
          const puzzle = puzzleById.get(card.puzzleId);
          return (
            <div className="review-item" key={card.id}>
              <div>
                <strong>{puzzle?.title ?? card.puzzleId}</strong>
                <span>실패 {card.failureCount}회 · 마지막 결과 {RESULT_LABELS[card.lastResult]}</span>
              </div>
              <span>{puzzle ? readableTag("phase", puzzle.phase) : "-"}</span>
            </div>
          );
        }) : <p>현재 바로 복습할 문제가 없습니다. 틀린 문제가 생기면 이 큐에 들어옵니다.</p>}
      </section>
    </div>
  );
}

function LibraryPage({
  puzzles,
  importedCount,
  onImport
}: {
  puzzles: Puzzle[];
  importedCount: number;
  onImport: (puzzles: Puzzle[]) => void;
}) {
  const [csv, setCsv] = useState("");
  const [qualityFilter, setQualityFilter] = useState(true);
  const [message, setMessage] = useState("실제 Lichess Puzzle CSV를 붙여넣거나 파일로 불러오세요.");

  function runImport(text = csv) {
    const result = parseLichessCsv(text, { qualityFilter, maxRows: 5000 });
    if (result.puzzles.length) onImport(result.puzzles);
    setMessage(`가져옴 ${result.imported}개 · 제외 ${result.skipped}개${result.errors.length ? ` · 오류 ${result.errors.join(" / ")}` : ""}`);
  }

  async function readFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    runImport(text);
  }

  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">Puzzle Library</p>
          <h2>문제 데이터</h2>
        </div>
        <div className="summary-stats"><span>Imported {importedCount}</span><span>Total {puzzles.length}</span></div>
      </div>
      <div className="data-grid">
        <section className="panel import-panel">
          <div className="tool-header">
            <h3>Lichess Puzzle DB import</h3>
            <span>브라우저 MVP는 1회 최대 5,000행</span>
          </div>
          <p>{message}</p>
          <label className="file-button">
            <Upload size={16} /> CSV 파일 선택
            <input type="file" accept=".csv,text/csv" onChange={(event) => void readFile(event.target.files?.[0] ?? null)} />
          </label>
          <textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder="PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags"
          />
          <label className="inline-check">
            <input type="checkbox" checked={qualityFilter} onChange={(event) => setQualityFilter(event.target.checked)} />
            품질 필터 적용: 800-2200, RD 120 이하, 인기도 70 이상, 플레이 50 이상
          </label>
          <button className="primary wide" onClick={() => runImport()}>CSV import</button>
        </section>
        <section className="panel">
          <h3>문제 목록</h3>
          <div className="library-grid">
            {puzzles.slice(0, 14).map((puzzle) => (
              <div className="puzzle-row" key={puzzle.id}>
                <div>
                  <strong>{puzzle.title}</strong>
                  <span>{puzzle.source} · {readableTag("phase", puzzle.phase)} · {puzzle.rating}</span>
                </div>
                <span>{puzzle.solutionMovesUci.length} ply</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusPage({ hardReset }: { hardReset: () => void }) {
  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">Build Status</p>
          <h2>현재 반영 범위</h2>
        </div>
        <button onClick={hardReset}>로컬 기록 초기화</button>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h3>반영됨</h3>
          <ul className="status-list done">
            <li>React + TypeScript 진입점 전환</li>
            <li>react-chessboard + chess.js 기반 보드 입력/합법수 표시</li>
            <li>미래 수순 노출 제거: 실제 둔 수만 보드 하이라이트</li>
            <li>동일 목적 메이트 허용: Qb1# 기준이어도 Qb2# 같은 합법 메이트 인정</li>
            <li>실제 Lichess Puzzle CSV import: 첫 Moves를 FEN에 적용한 뒤 출제</li>
            <li>오프닝 진단 페이지와 OpeningTags 기반 오프닝 세션</li>
            <li>브라우저 Stockfish Worker 기반 오답 평가</li>
          </ul>
        </section>
        <section className="panel">
          <h3>아직 제한 있음</h3>
          <ul className="status-list pending">
            <li>FastAPI + SQLite는 백엔드 골격 단계이며, 현재 화면은 localStorage 우선입니다.</li>
            <li>대량 CSV 파이프라인은 브라우저 5,000행 제한으로 시작합니다.</li>
            <li>PGN/Lichess 실제 대국 가져오기와 개인 퍼즐 생성은 다음 단계입니다.</li>
            <li>Python 실행기는 현재 샌드박스/PATH에서 잡히지 않아 백엔드 실행 검증이 남아 있습니다.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function CoachPanel({ report }: { report: ReturnType<typeof computeReport> }) {
  return (
    <section className="panel coach-panel">
      <h3>코치형 요약</h3>
      <div className="coach-lines">
        {report.coachSummary.map((line) => <p key={line}>{line}</p>)}
      </div>
      <div className="recommendations">
        {report.recommendations.map((item) => (
          <div key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.count}문제 · {item.reason}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsPanel({
  title,
  stats
}: {
  title: string;
  stats: Array<{ key: string; label: string; attemptsCount: number; accuracy: number; confidence: string }>;
}) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {stats.length ? stats.slice(0, 8).map((item) => (
        <div className="stat-row" key={item.key}>
          <div className="stat-label">
            <strong>{item.label}</strong>
            <span>{item.attemptsCount}회 · {item.confidence}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.round(item.accuracy * 100)}%` }} />
          </div>
          <div className="bar-value">{percent(item.accuracy)}</div>
        </div>
      )) : <p className="empty">아직 표시할 기록이 없습니다.</p>}
    </section>
  );
}

function NavButton({
  children,
  icon,
  active,
  onClick
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}{children}</button>;
}

function isOpeningPuzzle(puzzle: Puzzle) {
  return puzzle.phase === "opening" || puzzle.openingTagsRaw.length > 0 || puzzle.family === "opening-transition";
}

function openingName(puzzle: Puzzle) {
  if (!puzzle.openingTagsRaw.length) return "초반 전환";
  return puzzle.openingTagsRaw
    .slice(0, 2)
    .map((tag) => tag.replaceAll("_", " "))
    .join(" / ");
}

function buildOpeningTagStats(puzzles: Puzzle[], attempts: Attempt[]) {
  const puzzleById = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]));
  const groups = new Map<string, {
    key: string;
    label: string;
    puzzleCount: number;
    attemptsCount: number;
    solvedCount: number;
    accuracy: number;
  }>();

  for (const puzzle of puzzles) {
    const tags = puzzle.openingTagsRaw.length ? puzzle.openingTagsRaw : ["opening-transition"];
    for (const tag of tags) {
      if (!groups.has(tag)) {
        groups.set(tag, {
          key: tag,
          label: tag === "opening-transition" ? "초반 전환" : tag.replaceAll("_", " "),
          puzzleCount: 0,
          attemptsCount: 0,
          solvedCount: 0,
          accuracy: 0
        });
      }
      groups.get(tag)!.puzzleCount += 1;
    }
  }

  for (const attempt of attempts) {
    const puzzle = puzzleById.get(attempt.puzzleId);
    if (!puzzle) continue;
    const tags = puzzle.openingTagsRaw.length ? puzzle.openingTagsRaw : ["opening-transition"];
    for (const tag of tags) {
      const group = groups.get(tag);
      if (!group) continue;
      group.attemptsCount += 1;
      group.solvedCount += attempt.fullLineCorrect ? 1 : 0;
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      accuracy: group.attemptsCount ? group.solvedCount / group.attemptsCount : 0
    }))
    .sort((a, b) => b.attemptsCount - a.attemptsCount || b.puzzleCount - a.puzzleCount);
}

function buildSession(mode: SessionMode, puzzles: Puzzle[], attempts: Attempt[], cards: ReviewCard[]): Session {
  const dueIds = new Set(cards.filter((card) => card.dueAt <= Date.now()).map((card) => card.puzzleId));
  const attempted = new Map<string, number>();
  for (const attempt of attempts) attempted.set(attempt.puzzleId, (attempted.get(attempt.puzzleId) ?? 0) + 1);

  const due = puzzles.filter((puzzle) => dueIds.has(puzzle.id));
  const weakTags = new Set(computeReport(attempts, puzzles).weaknesses.slice(0, 4).map((item) => item.value));
  const weakness = puzzles.filter((puzzle) => [
    puzzle.phase,
    puzzle.family,
    ...puzzle.themesRaw,
    ...puzzle.thinkingSkills
  ].some((tag) => weakTags.has(tag)));
  const fresh = [...puzzles].sort((a, b) => (attempted.get(a.id) ?? 0) - (attempted.get(b.id) ?? 0) || a.rating - b.rating);
  const opening = fresh.filter(isOpeningPuzzle);

  const buckets = mode === "review"
    ? [due, fresh]
    : mode === "weakness"
      ? [weakness, due, fresh]
      : mode === "opening"
        ? [opening]
      : [weakness.slice(0, 5), due.slice(0, 3), fresh];
  const ids = unique(buckets.flat().map((puzzle) => puzzle.id)).slice(0, 12);
  const fallback = mode === "opening"
    ? ids
    : unique([...ids, ...fresh.map((puzzle) => puzzle.id)]).slice(0, 12);

  return {
    id: crypto.randomUUID(),
    mode,
    puzzleIds: fallback,
    startedAt: new Date().toISOString(),
    endedAt: null
  };
}

function buildSquareStyles({
  selectedSquare,
  targetSquares,
  lastUserMove,
  lastOpponentMove
}: {
  selectedSquare: string | null;
  targetSquares: string[];
  lastUserMove: string;
  lastOpponentMove: string;
}) {
  const styles: Record<string, React.CSSProperties> = {};
  for (const square of targetSquares) {
    styles[square] = {
      backgroundImage: "radial-gradient(circle, rgba(31, 95, 77, 0.46) 0 18%, transparent 20%)",
      boxShadow: "inset 0 0 0 3px rgba(31, 95, 77, 0.18)"
    };
  }
  const opponent = moveSquares(lastOpponentMove);
  for (const square of [opponent.from, opponent.to].filter(Boolean)) {
    styles[square] = {
      ...styles[square],
      backgroundImage: mergeBackground(styles[square]?.backgroundImage, "linear-gradient(rgba(201,130,45,.44), rgba(201,130,45,.44))")
    };
  }
  const user = moveSquares(lastUserMove);
  for (const square of [user.from, user.to].filter(Boolean)) {
    styles[square] = {
      ...styles[square],
      backgroundImage: mergeBackground(styles[square]?.backgroundImage, "linear-gradient(rgba(53,107,145,.45), rgba(53,107,145,.45))")
    };
  }
  if (selectedSquare) {
    styles[selectedSquare] = {
      ...styles[selectedSquare],
      boxShadow: `${styles[selectedSquare]?.boxShadow ?? ""}, inset 0 0 0 4px #f2bd42`
    };
  }
  return styles;
}

function mergeBackground(existing: React.CSSProperties["backgroundImage"], next: string) {
  return existing ? `${existing}, ${next}` : next;
}

function resolveLegalMove(fen: string, from: string, to: string, promotion?: string) {
  const base = `${from}${to}`;
  const legal = legalUciMoves(fen).filter((move) => move.slice(0, 4) === base);
  if (!legal.length) return null;
  if (promotion) return legal.find((move) => move[4] === promotion) ?? null;
  return legal.find((move) => move[4] === "q") ?? legal[0];
}

function isExpectedMove(uci: string, expected?: string) {
  if (!expected) return false;
  if (uci === expected) return true;
  return expected.length === 4 && uci.slice(0, 4) === expected;
}

function isObjectiveSolution(puzzle: Puzzle, fen: string, uci: string, solutionIndex: number) {
  return puzzle.objective?.type === "checkmate" &&
    puzzle.objective.plies === 1 &&
    puzzle.objective.acceptEquivalent &&
    solutionIndex === 0 &&
    isLegalUci(fen, uci) &&
    isCheckmateAfter(fen, uci);
}

function buildSolvedResult(timeMs: number, hintCount: number): AttemptResult {
  if (hintCount > 0 || timeMs > 45_000) return "SOLVED_SLOW";
  return "SOLVED_CLEAN";
}

function humanPly(puzzle: Puzzle) {
  if (puzzle.objective?.type === "checkmate") return `내 ${puzzle.objective.plies}수 · ${puzzle.solutionMovesUci.length} ply`;
  return `${puzzle.solutionMovesUci.length} ply`;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}
