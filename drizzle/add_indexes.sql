CREATE INDEX IF NOT EXISTS idx_puzzles_difficulty ON puzzles (difficulty);
CREATE INDEX IF NOT EXISTS idx_puzzles_opening_variation ON puzzles (openingName, openingVariation);
CREATE INDEX IF NOT EXISTS idx_puzzles_subset ON puzzles (subset);
CREATE INDEX IF NOT EXISTS idx_puzzles_num_attempts ON puzzles (numAttempts);
CREATE INDEX IF NOT EXISTS idx_puzzles_num_solved ON puzzles (numSolved);
