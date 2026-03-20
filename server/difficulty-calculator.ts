/**
 * Phase 3: Difficulty Calculator
 * Harmonic mean scoring with centipawn/mate value mapping (0-3000 scale)
 */

export function centipawnToDifficulty(cp: number): number {
  const absCp = Math.abs(cp);
  return 1 / (1 + Math.exp(0.008 * (absCp - 200)));
}

export function mateToDifficulty(mateIn: number): number {
  const absMate = Math.abs(mateIn);
  if (absMate <= 1) return 0.3;
  if (absMate <= 2) return 0.5;
  if (absMate <= 3) return 0.7;
  if (absMate <= 5) return 0.85;
  return 0.95;
}

export function harmonicMean(values: number[]): number {
  if (values.length === 0) return 0;
  const filtered = values.filter(v => v > 0);
  if (filtered.length === 0) return 0;
  return filtered.length / filtered.reduce((sum, v) => sum + (1 / v), 0);
}

export interface PositionEval {
  type: "cp" | "mate";
  value: number;
}

export function calculateDifficulty(evaluations: PositionEval[]): number {
  if (evaluations.length === 0) return 1500;
  const scores = evaluations.map(ev =>
    ev.type === "mate" ? mateToDifficulty(ev.value) : centipawnToDifficulty(ev.value)
  );
  return Math.round(harmonicMean(scores) * 3000);
}

export function estimateDifficultyFromMetadata(
  rating: number, moveCount: number, themes: string[]
): number {
  let d = rating;
  if (moveCount > 6) d += (moveCount - 6) * 30;
  if (moveCount > 10) d += (moveCount - 10) * 50;
  const hard = ["sacrifice", "deflection", "interference", "zugzwang", "quietMove"];
  const easy = ["mateIn1", "oneMove", "hangingPiece"];
  for (const t of themes) {
    if (hard.includes(t)) d += 100;
    if (easy.includes(t)) d -= 100;
  }
  return Math.max(0, Math.min(3000, Math.round(d)));
}
