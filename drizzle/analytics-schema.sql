CREATE TABLE IF NOT EXISTS player_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  value DOUBLE DEFAULT 0,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pe_player (player_id),
  INDEX idx_pe_type (event_type),
  INDEX idx_pe_created (created_at)
);

CREATE TABLE IF NOT EXISTS player_stats (
  player_id INT PRIMARY KEY,
  total_puzzles_attempted INT DEFAULT 0,
  total_puzzles_solved INT DEFAULT 0,
  total_score DOUBLE DEFAULT 0,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  avg_solve_time_ms INT DEFAULT 0,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ps_score (total_score),
  INDEX idx_ps_streak (current_streak)
);

CREATE TABLE IF NOT EXISTS site_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  total_players INT DEFAULT 0,
  total_puzzles_attempted INT DEFAULT 0,
  total_puzzles_solved INT DEFAULT 0,
  avg_score DOUBLE DEFAULT 0,
  snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ss_date (snapshot_date)
);

CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  leaderboard_type VARCHAR(50) NOT NULL,
  player_id INT NOT NULL,
  score DOUBLE DEFAULT 0,
  rank_position INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lc_type (leaderboard_type),
  INDEX idx_lc_score (score)
);

CREATE TABLE IF NOT EXISTS session_analytics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  training_set_id VARCHAR(64),
  puzzles_attempted INT DEFAULT 0,
  puzzles_solved INT DEFAULT 0,
  total_time_ms BIGINT DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  INDEX idx_sa_player (player_id)
);

CREATE TABLE IF NOT EXISTS opening_performance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  opening_name VARCHAR(255) NOT NULL,
  puzzles_attempted INT DEFAULT 0,
  puzzles_solved INT DEFAULT 0,
  total_time_ms BIGINT DEFAULT 0,
  avg_time_ms INT DEFAULT 0,
  UNIQUE KEY uk_player_opening (player_id, opening_name),
  INDEX idx_op_opening (opening_name)
);

CREATE TABLE IF NOT EXISTS difficulty_performance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  difficulty_range_min INT NOT NULL,
  difficulty_range_max INT NOT NULL,
  puzzles_attempted INT DEFAULT 0,
  puzzles_solved INT DEFAULT 0,
  total_time_ms BIGINT DEFAULT 0,
  avg_time_ms INT DEFAULT 0,
  UNIQUE KEY uk_player_diff (player_id, difficulty_range_min, difficulty_range_max),
  INDEX idx_dp_range (difficulty_range_min, difficulty_range_max)
);
