export const SAMPLE_PUZZLES = [
  mateSeed({
    id: "seed-mate-001",
    title: "킹 보호 퀸 메이트",
    fen: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1",
    solution: ["g6g7"],
    rating: 900,
    themes: ["mateIn1", "endgame"],
    phase: "endgame",
    family: "endgame",
    skills: ["forcing_moves", "endgame_counting"],
    explanation: "퀸이 g7에서 체크하고 백킹이 퀸을 보호합니다. 흑킹은 h8에서 도망갈 칸이 없습니다."
  }),
  mateSeed({
    id: "seed-mate-002",
    title: "코너 퀸 메이트",
    fen: "k7/8/1QK5/8/8/8/8/8 w - - 0 1",
    solution: ["b6b7"],
    rating: 920,
    themes: ["mateIn1", "endgame"],
    phase: "endgame",
    family: "endgame",
    skills: ["forcing_moves", "endgame_counting"],
    explanation: "Qb7#은 퀸이 a8을 공격하고 백킹이 퀸을 보호하는 기본 코너 메이트 패턴입니다."
  }),
  mateSeed({
    id: "seed-mate-003",
    title: "하단 코너 메이트",
    fen: "8/8/8/8/8/1Q6/2K5/k7 w - - 0 1",
    solution: ["b3b1"],
    rating: 940,
    themes: ["mateIn1", "endgame"],
    phase: "endgame",
    family: "endgame",
    skills: ["forcing_moves", "endgame_counting"],
    explanation: "기준 해답은 Qb1#이지만 같은 목적을 달성하는 Qb2#도 정답으로 인정합니다."
  }),
  mateSeed({
    id: "seed-mate-004",
    title: "킹 보호 퀸 메이트",
    fen: "8/8/8/8/8/6Q1/5K2/7k w - - 0 1",
    solution: ["g3g1"],
    rating: 960,
    themes: ["mateIn1", "endgame"],
    phase: "endgame",
    family: "endgame",
    skills: ["forcing_moves", "endgame_counting"],
    explanation: "Qg1#은 퀸이 직접 체크하고 백킹이 g1을 보호해 흑킹이 퀸을 잡을 수 없게 합니다."
  }),
  mateSeed({
    id: "seed-mate-005",
    title: "백랭크 룩 메이트",
    fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1",
    solution: ["e1e8"],
    rating: 980,
    themes: ["mateIn1", "backRankMate", "middlegame"],
    phase: "middlegame",
    family: "tactics",
    skills: ["forcing_moves", "threat_awareness"],
    explanation: "Re8#은 f7, g7, h7 폰이 흑킹의 탈출 칸을 막는 전형적인 백랭크 메이트입니다."
  }),
  mateSeed({
    id: "seed-mate-006",
    title: "룩 리프트 메이트",
    fen: "7k/5K1p/8/8/8/8/8/R7 w - - 0 1",
    solution: ["a1a8"],
    rating: 1020,
    themes: ["mateIn1", "endgame"],
    phase: "endgame",
    family: "endgame",
    skills: ["forcing_moves", "endgame_counting"],
    explanation: "Ra8#은 룩이 8랭크를 장악하고 백킹이 g8, g7 탈출을 통제하는 룩 메이트입니다."
  }),
  mateSeed({
    id: "seed-mate-007",
    title: "반대편 룩 메이트",
    fen: "k7/p7/2K5/8/8/8/8/7R w - - 0 1",
    solution: ["h1h8"],
    rating: 1040,
    themes: ["mateIn1", "endgame"],
    phase: "endgame",
    family: "endgame",
    skills: ["forcing_moves", "endgame_counting"],
    explanation: "Rh8#은 흑킹을 a8에 고정하고 a7 폰과 백킹 통제로 탈출 칸을 없앱니다."
  }),
  mateSeed({
    id: "seed-mate-008",
    title: "중앙 파일 룩 메이트",
    fen: "1k6/ppp5/8/8/8/8/8/3R2K1 w - - 0 1",
    solution: ["d1d8"],
    rating: 1080,
    themes: ["mateIn1", "backRankMate"],
    phase: "middlegame",
    family: "tactics",
    skills: ["forcing_moves", "threat_awareness"],
    explanation: "Rd8#은 d파일 침투로 8랭크 전체를 통제합니다. 흑의 a, b, c 폰이 킹의 도주를 막습니다."
  }),
  mateSeed({
    id: "seed-mate-009",
    title: "긴 파일 퀸 메이트",
    fen: "6k1/5ppp/8/8/8/8/Q7/6K1 w - - 0 1",
    solution: ["a2a8"],
    rating: 1120,
    themes: ["mateIn1", "backRankMate"],
    phase: "middlegame",
    family: "tactics",
    skills: ["forcing_moves", "candidate_moves"],
    explanation: "Qa8#은 퀸이 8랭크를 장악하고 폰 구조가 흑킹의 모든 탈출 칸을 봉쇄합니다."
  }),
  mateSeed({
    id: "seed-mate-010",
    title: "측면 퀸 침투",
    fen: "1k6/ppp5/8/8/8/8/7Q/6K1 w - - 0 1",
    solution: ["h2h8"],
    rating: 1160,
    themes: ["mateIn1", "backRankMate"],
    phase: "middlegame",
    family: "tactics",
    skills: ["forcing_moves", "candidate_moves"],
    explanation: "Qh8#은 긴 랭크 침투로 8랭크를 장악합니다. 흑킹은 자기 폰에 막혀 움직일 수 없습니다."
  }),
  mateSeed({
    id: "seed-mate-011",
    title: "c파일 퀸 메이트",
    fen: "7k/6pp/8/8/8/2Q5/8/6K1 w - - 0 1",
    solution: ["c3c8"],
    rating: 1200,
    themes: ["mateIn1", "backRankMate"],
    phase: "middlegame",
    family: "tactics",
    skills: ["forcing_moves", "candidate_moves"],
    explanation: "Qc8#은 퀸이 c파일로 침투해 8랭크를 통제합니다. 흑의 g, h 폰이 탈출 칸을 막습니다."
  }),
  mateSeed({
    id: "seed-mate-012",
    title: "대각선 진입 퀸 메이트",
    fen: "k7/pp6/8/5Q2/8/8/8/6K1 w - - 0 1",
    solution: ["f5c8"],
    rating: 1240,
    themes: ["mateIn1", "backRankMate"],
    phase: "middlegame",
    family: "tactics",
    skills: ["forcing_moves", "candidate_moves"],
    explanation: "Qc8#은 대각선으로 진입해 a8 흑킹을 공격합니다. a7, b7 폰 때문에 도주 칸이 없습니다."
  })
];

function mateSeed({ id, title, fen, solution, rating, themes, phase, family, skills, explanation }) {
  return {
    id,
    source: "curated",
    sourcePuzzleId: id,
    title,
    fenBefore: fen,
    initialOpponentMoveUci: "",
    fenPresented: fen,
    solutionMovesUci: solution,
    rating,
    ratingDeviation: 0,
    popularity: 100,
    nbPlays: 0,
    themesRaw: themes,
    openingTagsRaw: [],
    phase,
    moveNumber: Number(fen.split(" ")[5] || 1),
    materialCount: countMaterial(fen),
    family,
    thinkingSkills: skills,
    explanation,
    sourceGameUrl: "",
    objective: {
      type: "checkmate",
      plies: 1,
      acceptEquivalent: true
    },
    verification: {
      outcome: "checkmate",
      method: "local-legal-move-and-checkmate-validation"
    }
  };
}

function countMaterial(fen) {
  return [...fen.split(" ")[0]].filter((char) => /[pnbrqPNBRQ]/.test(char)).length;
}
