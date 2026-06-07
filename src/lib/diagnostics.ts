import type { Attempt, AttemptResult, Puzzle } from "../types/domain";

export const RESULT_LABELS: Record<AttemptResult, string> = {
  SOLVED_CLEAN: "정확히 해결",
  SOLVED_SLOW: "해결했지만 느림",
  FIRST_MOVE_WRONG: "첫 후보수 실패",
  LINE_FAILED: "후속 계산 실패",
  GAVE_UP: "포기",
  ILLEGAL_MOVE: "입력 오류"
};

export const MISTAKE_REASONS = [
  { id: "missed_opponent_threat", label: "상대 위협을 못 봄" },
  { id: "too_few_candidates", label: "후보수를 너무 적게 봄" },
  { id: "line_failed", label: "첫 수 이후 후속 계산 실패" },
  { id: "pattern_unknown", label: "전술 패턴을 몰랐음" },
  { id: "endgame_rule_gap", label: "엔드게임 원칙을 몰랐음" },
  { id: "moved_too_fast", label: "너무 빨리 둠" }
];

export const PHASE_LABELS = {
  opening: "초반",
  middlegame: "중반",
  endgame: "엔드게임"
} as const;

export const FAMILY_LABELS = {
  tactics: "전술",
  defense: "수비",
  calculation: "계산",
  endgame: "엔드게임",
  "opening-transition": "초반 전환"
} as const;

export const THINKING_LABELS: Record<string, string> = {
  forcing_moves: "강제수 확인",
  threat_awareness: "상대 위협 인식",
  candidate_moves: "후보수 탐색",
  calculation_depth: "계산 지속력",
  defensive_resource: "수비 자원 발견",
  conversion_technique: "우세 전환",
  endgame_counting: "엔드게임 계산"
};

export const THEME_LABELS: Record<string, string> = {
  advantage: "우세 전환",
  backRankMate: "백랭크 메이트",
  defensiveMove: "수비 전술",
  discoveredAttack: "디스커버드 어택",
  endgame: "엔드게임",
  fork: "포크",
  mate: "메이트",
  mateIn1: "메이트 1수",
  mateIn2: "메이트 2수",
  mateIn3: "메이트 3수",
  middlegame: "중반",
  opening: "초반",
  pawnEndgame: "폰 엔드게임",
  pin: "핀",
  queenEndgame: "퀸 엔드게임",
  rookEndgame: "룩 엔드게임",
  sacrifice: "희생",
  skewer: "스큐어"
};

export function readableTag(type: string, value: string) {
  if (type === "phase") return PHASE_LABELS[value as keyof typeof PHASE_LABELS] ?? value;
  if (type === "family") return FAMILY_LABELS[value as keyof typeof FAMILY_LABELS] ?? value;
  if (type === "thinking_skill") return THINKING_LABELS[value] ?? value;
  if (type === "theme") return THEME_LABELS[value] ?? value;
  if (type === "opening") return value.replaceAll("_", " ");
  return value;
}

export function labelsForPuzzle(puzzle: Puzzle) {
  return [
    readableTag("phase", puzzle.phase),
    readableTag("family", puzzle.family),
    ...puzzle.themesRaw.map((theme) => readableTag("theme", theme)),
    ...puzzle.thinkingSkills.map((skill) => readableTag("thinking_skill", skill))
  ];
}

export function scoreAttempt({
  resultType,
  hintCount,
  timeMs,
  puzzleRating,
  estimatedRating
}: {
  resultType: AttemptResult;
  hintCount: number;
  timeMs: number;
  puzzleRating: number;
  estimatedRating: number;
}) {
  const resultScore: Record<AttemptResult, number> = {
    SOLVED_CLEAN: 1,
    SOLVED_SLOW: 0.82,
    FIRST_MOVE_WRONG: 0,
    LINE_FAILED: 0.45,
    GAVE_UP: 0,
    ILLEGAL_MOVE: 0
  };
  const hintPenalty = Math.min(0.4, hintCount * 0.2);
  const slowPenalty = timeMs > 90_000 && resultScore[resultType] > 0 ? 0.1 : 0;
  const difficultyDelta = puzzleRating - estimatedRating;
  const difficultyWeight = Math.max(0.75, Math.min(1.25, 1 + difficultyDelta / 1200));
  return Math.max(0, Math.min(1.25, (resultScore[resultType] - hintPenalty - slowPenalty) * difficultyWeight));
}

export function estimateRating(attempts: Attempt[], puzzles: Puzzle[]) {
  if (!attempts.length) return 1400;
  const puzzleById = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]));
  const relevant = attempts
    .slice(0, 80)
    .map((attempt) => ({ attempt, puzzle: puzzleById.get(attempt.puzzleId) }))
    .filter((item): item is { attempt: Attempt; puzzle: Puzzle } => Boolean(item.puzzle));

  if (!relevant.length) return 1400;
  const solved = relevant.filter(({ attempt }) => attempt.fullLineCorrect).map(({ puzzle }) => puzzle.rating);
  const failed = relevant.filter(({ attempt }) => !attempt.fullLineCorrect).map(({ puzzle }) => puzzle.rating);
  const solvedAvg = average(solved) || 1400;
  const failedAvg = average(failed) || solvedAvg;
  return Math.round(Math.max(800, Math.min(2400, solvedAvg * 0.65 + failedAvg * 0.35)));
}

export function computeReport(attempts: Attempt[], puzzles: Puzzle[]) {
  const puzzleById = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]));
  const groups = new Map<string, ReturnType<typeof emptyGroup>>();
  const recent = attempts.slice(0, 120);

  for (const attempt of recent) {
    const puzzle = puzzleById.get(attempt.puzzleId);
    if (!puzzle) continue;
    for (const tag of tagsForPuzzle(puzzle)) {
      const key = `${tag.type}:${tag.value}`;
      if (!groups.has(key)) groups.set(key, emptyGroup(tag.type, tag.value));
      const group = groups.get(key)!;
      group.attemptsCount += 1;
      group.correctCount += attempt.fullLineCorrect ? 1 : 0;
      group.firstMoveCorrectCount += attempt.firstMoveCorrect ? 1 : 0;
      group.fullLineCorrectCount += attempt.fullLineCorrect ? 1 : 0;
      group.slowCount += attempt.timeMs > 45_000 ? 1 : 0;
      group.hintCount += attempt.hintCount || 0;
      group.timeTotal += attempt.timeMs || 0;
    }
  }

  const stats = [...groups.values()].map((group) => {
    const count = group.attemptsCount || 1;
    const accuracy = group.correctCount / count;
    const firstFailRate = 1 - group.firstMoveCorrectCount / count;
    const lineFailRate = 1 - group.fullLineCorrectCount / count;
    const slowRate = group.slowCount / count;
    const sampleReliability = Math.min(1, group.attemptsCount / 20);
    const weaknessRaw = (1 - accuracy) * 0.36 + firstFailRate * 0.22 + lineFailRate * 0.24 + slowRate * 0.1;
    const weaknessScore = weaknessRaw * (0.35 + 0.65 * sampleReliability);
    return {
      ...group,
      accuracy,
      firstMoveRate: group.firstMoveCorrectCount / count,
      fullLineRate: group.fullLineCorrectCount / count,
      avgTimeMs: group.timeTotal / count,
      sampleReliability,
      confidence: confidenceLabel(group.attemptsCount),
      weaknessScore
    };
  });

  const recentAttempts = attempts.slice(0, 80);
  const totals = summarizeAttempts(recentAttempts);
  const weaknesses = stats
    .filter((item) => item.attemptsCount >= 3)
    .sort((a, b) => b.weaknessScore - a.weaknessScore)
    .slice(0, 8);

  return {
    totalAttempts: attempts.length,
    recentCount: recentAttempts.length,
    totals,
    stats,
    phases: byType(stats, "phase"),
    themes: byType(stats, "theme"),
    thinkingSkills: byType(stats, "thinking_skill"),
    families: byType(stats, "family"),
    openings: byType(stats, "opening"),
    weaknesses,
    coachSummary: buildCoachSummary({ totals, weaknesses, recentCount: recentAttempts.length }),
    recommendations: buildRecommendations(weaknesses, stats)
  };
}

export function tagsForPuzzle(puzzle: Puzzle) {
  return [
    { type: "phase", value: puzzle.phase },
    { type: "family", value: puzzle.family },
    ...puzzle.openingTagsRaw.map((tag) => ({ type: "opening", value: tag })),
    ...puzzle.themesRaw.map((theme) => ({ type: "theme", value: theme })),
    ...puzzle.thinkingSkills.map((skill) => ({ type: "thinking_skill", value: skill }))
  ];
}

export function percent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export function seconds(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  return `${Math.round(ms / 1000)}s`;
}

function emptyGroup(type: string, value: string) {
  return {
    key: `${type}:${value}`,
    type,
    value,
    label: readableTag(type, value),
    attemptsCount: 0,
    correctCount: 0,
    firstMoveCorrectCount: 0,
    fullLineCorrectCount: 0,
    slowCount: 0,
    hintCount: 0,
    timeTotal: 0
  };
}

function byType<T extends { type: string; attemptsCount: number; accuracy: number }>(stats: T[], type: string) {
  return stats
    .filter((item) => item.type === type)
    .sort((a, b) => b.attemptsCount - a.attemptsCount || a.accuracy - b.accuracy);
}

function summarizeAttempts(attempts: Attempt[]) {
  const count = attempts.length || 1;
  return {
    attempts: attempts.length,
    solved: attempts.filter((attempt) => attempt.fullLineCorrect).length,
    firstMove: attempts.filter((attempt) => attempt.firstMoveCorrect).length,
    line: attempts.filter((attempt) => attempt.fullLineCorrect).length,
    avgTimeMs: average(attempts.map((attempt) => attempt.timeMs || 0)),
    accuracy: attempts.filter((attempt) => attempt.fullLineCorrect).length / count,
    firstMoveRate: attempts.filter((attempt) => attempt.firstMoveCorrect).length / count,
    lineRate: attempts.filter((attempt) => attempt.fullLineCorrect).length / count
  };
}

function buildCoachSummary({
  totals,
  weaknesses,
  recentCount
}: {
  totals: ReturnType<typeof summarizeAttempts>;
  weaknesses: Array<{ label: string; accuracy: number }>;
  recentCount: number;
}) {
  if (!recentCount) {
    return [
      "아직 풀이 기록이 없습니다.",
      "먼저 10문제 이상 풀면 국면, 테마, 사고 과정 기준으로 약점 후보를 분리합니다.",
      "샘플이 20개 미만일 때는 진단을 임시 추정으로 표시합니다."
    ];
  }

  const lines = [];
  const samplePrefix = recentCount < 20 ? `최근 ${recentCount}문제 기준의 임시 진단입니다.` : `최근 ${recentCount}문제 기준입니다.`;
  const main = weaknesses[0];
  const second = weaknesses[1];

  if (main) {
    lines.push(`${samplePrefix} 가장 약한 축은 ${main.label}이고, 정답률은 ${percent(main.accuracy)}입니다.`);
  } else {
    lines.push(`${samplePrefix} 아직 특정 약점을 단정하기에는 샘플이 부족합니다.`);
  }

  if (totals.firstMoveRate - totals.lineRate > 0.18) {
    lines.push("첫 수 감각보다 전체 라인 완성률이 낮아, 2-3수 뒤 상대 응수를 끝까지 확인하는 훈련이 우선입니다.");
  } else if (totals.firstMoveRate < 0.55) {
    lines.push("첫 후보수 선택에서 손실이 커서, 체크와 강제수를 먼저 훑는 루틴이 필요합니다.");
  } else {
    lines.push("현재는 특정 테마 반복과 시간 관리 보정이 더 중요합니다.");
  }

  if (main && second) {
    lines.push(`다음 세션은 ${main.label}, ${second.label} 문제를 우선하고, 틀린 문제 복습을 섞습니다.`);
  } else {
    lines.push("다음 세션은 초반, 중반, 엔드게임을 균형 있게 풀면서 실패 유형을 더 모읍니다.");
  }

  return lines;
}

function buildRecommendations<T extends { type: string; label: string; attemptsCount: number; fullLineRate: number }>(
  weaknesses: T[],
  stats: T[]
) {
  const recs = [];
  const weakLabels = weaknesses.slice(0, 4).map((item) => item.label);
  if (weakLabels.length) {
    recs.push({ label: `${weakLabels.join(", ")} 집중`, count: 6, reason: "최근 약점 점수가 높음" });
  }

  const lowLine = stats
    .filter((item) => item.type === "thinking_skill" && item.attemptsCount >= 3)
    .sort((a, b) => a.fullLineRate - b.fullLineRate)[0];
  if (lowLine) {
    recs.push({ label: `${lowLine.label} 계산`, count: 4, reason: "전체 라인 완성률 보강" });
  }

  recs.push({ label: "틀린 문제 복습", count: 3, reason: "재오답률 확인" });
  recs.push({ label: "새 난이도 검증", count: 2, reason: "실력 추정 보정" });
  return recs.slice(0, 4);
}

function confidenceLabel(count: number) {
  if (count < 5) return "샘플 부족";
  if (count < 20) return "임시 추정";
  if (count < 50) return "보통";
  return "높음";
}

function average(values: number[]) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}
