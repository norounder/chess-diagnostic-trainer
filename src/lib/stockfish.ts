import type { MistakeEvaluation, StockfishEvaluation } from "../types/domain";
import { applyUci, formatUci } from "./chess";

const STOCKFISH_WORKER_URL = "/stockfish/stockfish-18-lite-single.js";
const DEFAULT_DEPTH = 10;

export async function evaluateMistake(beforeFen: string, userMove: string, depth = DEFAULT_DEPTH): Promise<MistakeEvaluation> {
  if (typeof Worker === "undefined") {
    return { status: "unavailable", message: "이 브라우저에서는 Stockfish Worker를 사용할 수 없습니다." };
  }

  try {
    const afterFen = applyUci(beforeFen, userMove);
    const before = await evaluateFen(beforeFen, depth);
    const after = await evaluateFen(afterFen, depth);
    const beforeForMover = scoreForSideToMove(before);
    const afterForMover = -scoreForSideToMove(after);
    const evalLossCp = Number.isFinite(beforeForMover) && Number.isFinite(afterForMover)
      ? Math.max(0, Math.round(beforeForMover - afterForMover))
      : undefined;

    return {
      status: "ready",
      best: before,
      after,
      evalLossCp,
      message: describeMistake(before, evalLossCp)
    };
  } catch (error) {
    return {
      status: "unavailable",
      message: `Stockfish 평가를 완료하지 못했습니다: ${(error as Error).message}`
    };
  }
}

export function evaluateFen(fen: string, depth = DEFAULT_DEPTH): Promise<StockfishEvaluation> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(STOCKFISH_WORKER_URL);
    const lines: string[] = [];
    let latest: StockfishEvaluation = {};
    let ready = false;
    let completed = false;
    const timeout = window.setTimeout(() => finish(null, new Error("Stockfish timeout")), 12_000);

    const send = (command: string) => worker.postMessage(command);
    const finish = (evaluation: StockfishEvaluation | null, error?: Error) => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeout);
      worker.terminate();
      if (error) reject(error);
      else resolve(evaluation ?? latest);
    };

    worker.onmessage = (event: MessageEvent<string>) => {
      const line = String(event.data);
      lines.push(line);
      if (line === "uciok") {
        send("isready");
        return;
      }
      if (line === "readyok" && !ready) {
        ready = true;
        send("ucinewgame");
        send(`position fen ${fen}`);
        send(`go depth ${depth}`);
        return;
      }
      if (line.startsWith("info ")) {
        latest = parseInfo(line, latest);
        return;
      }
      if (line.startsWith("bestmove ")) {
        const [, bestMove] = line.split(/\s+/);
        finish({ ...latest, bestMove });
      }
    };

    worker.onerror = () => finish(null, new Error("Stockfish worker failed to load."));
    send("uci");
  });
}

function parseInfo(line: string, previous: StockfishEvaluation): StockfishEvaluation {
  const tokens = line.split(/\s+/);
  const depthIndex = tokens.indexOf("depth");
  const scoreIndex = tokens.indexOf("score");
  const pvIndex = tokens.indexOf("pv");
  const next = { ...previous };

  if (depthIndex >= 0) next.depth = Number(tokens[depthIndex + 1]);
  if (scoreIndex >= 0) {
    const scoreType = tokens[scoreIndex + 1];
    const scoreValue = Number(tokens[scoreIndex + 2]);
    if (scoreType === "cp") {
      next.scoreCp = scoreValue;
      next.mate = undefined;
    }
    if (scoreType === "mate") {
      next.mate = scoreValue;
      next.scoreCp = undefined;
    }
  }
  if (pvIndex >= 0) next.pv = tokens.slice(pvIndex + 1);
  return next;
}

function scoreForSideToMove(evaluation: StockfishEvaluation) {
  if (typeof evaluation.scoreCp === "number") return evaluation.scoreCp;
  if (typeof evaluation.mate === "number") {
    return evaluation.mate > 0 ? 100_000 - evaluation.mate * 1000 : -100_000 - evaluation.mate * 1000;
  }
  return Number.NaN;
}

function describeMistake(best: StockfishEvaluation, evalLossCp?: number) {
  const bestMove = best.bestMove ? ` 기준 최선수는 ${formatUci(best.bestMove)}입니다.` : "";
  if (evalLossCp === undefined) return `엔진 평가를 읽었지만 손실 크기를 안정적으로 계산하지 못했습니다.${bestMove}`;
  if (evalLossCp >= 500) return `큰 평가 하락입니다. 먼저 상대의 강제 응수와 체크 후보를 다시 확인해야 합니다.${bestMove}`;
  if (evalLossCp >= 220) return `의미 있는 손실입니다. 후보수를 충분히 비교하지 못했을 가능성이 큽니다.${bestMove}`;
  if (evalLossCp >= 80) return `작은 손실입니다. 더 좋은 수가 있지만 포지션을 즉시 망치지는 않습니다.${bestMove}`;
  return `엔진 기준 손실은 작습니다. 기준 라인과 달라도 목적을 달성했는지 확인해야 합니다.${bestMove}`;
}
