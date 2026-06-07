# Diagnosis Engine Rules

This MVP keeps diagnosis rule-based. The first backend version should mirror
`src/diagnosis.js` before adding engine or model-based explanations.

## Attempt Result Types

- `SOLVED_CLEAN`: first try, no hint, complete line solved
- `SOLVED_SLOW`: complete line solved, but slow or with hint
- `FIRST_MOVE_WRONG`: first candidate move failed
- `LINE_FAILED`: first move was correct, continuation failed
- `GAVE_UP`: user resigned the puzzle
- `ILLEGAL_MOVE`: malformed move input

## Weakness Score Inputs

Use tag-level aggregates over phase, theme, family, and thinking skill.

- error rate
- first move failure rate
- full line failure rate
- slow solve rate
- hint use
- sample reliability

Samples below 5 attempts are displayed as insufficient. Samples above 20 can
influence puzzle selection. Samples above 50 can be treated as stable major
weaknesses.

## Selector Mix

Default 12-puzzle session:

- weakness-based: 40%
- review due: 25%
- balanced phase coverage: 20%
- challenge rating band: 15%

When there is not enough data, fill with balanced opening, middlegame, and
endgame coverage.
