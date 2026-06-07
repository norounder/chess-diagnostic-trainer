# Sample Data

No fake Lichess rows are kept in the repository.

Use the app's Data page to paste real rows from the Lichess puzzle CSV. The importer expects these columns:

```csv
PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
```

The built-in starter puzzles live in `src/puzzles.js` and are marked as `source: "curated"`. They are not represented as Lichess data.
