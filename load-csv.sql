-- Drop old table if exists
DROP TABLE IF EXISTS puzzles_raw;

-- Create table matching CSV structure
CREATE TABLE puzzles_raw (
  PuzzleId VARCHAR(20) PRIMARY KEY,
  FEN TEXT NOT NULL,
  Moves TEXT NOT NULL,
  Rating INT,
  RatingDeviation INT,
  Popularity INT,
  NbPlays INT,
  Themes TEXT,
  GameUrl TEXT,
  OpeningTags TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Load CSV data
LOAD DATA LOCAL INFILE '/home/ubuntu/upload/lichess_db_puzzle(1).csv'
INTO TABLE puzzles_raw
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

-- Show count
SELECT COUNT(*) as total_puzzles FROM puzzles_raw;
