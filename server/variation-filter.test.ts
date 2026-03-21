import { describe, it, expect } from 'vitest';
import { getRandomPuzzlesByOpeningAndRating } from './db';

describe('Variation Filtering', () => {
  it('should return different puzzles for different Sicilian variations', async () => {
    // Fetch puzzles for Najdorf Variation
    const najdorfPuzzles = await getRandomPuzzlesByOpeningAndRating(
      'Sicilian Defence',
      0,
      3000,
      10,
      'Najdorf Variation',
      undefined
    );

    // Fetch puzzles for Dragon Variation
    const dragonPuzzles = await getRandomPuzzlesByOpeningAndRating(
      'Sicilian Defence',
      0,
      3000,
      10,
      'Dragon Variation',
      undefined
    );

    console.log('Najdorf puzzles:', najdorfPuzzles.length);
    console.log('Dragon puzzles:', dragonPuzzles.length);

    // Both should return puzzles
    expect(najdorfPuzzles.length).toBeGreaterThan(0);
    expect(dragonPuzzles.length).toBeGreaterThan(0);

    // They should have different puzzle IDs (not the same set)
    const najdorfIds = new Set(najdorfPuzzles.map(p => p.id));
    const dragonIds = new Set(dragonPuzzles.map(p => p.id));

    // Check that the sets are different - at least some IDs should differ
    let overlapCount = 0;
    for (const id of dragonIds) {
      if (najdorfIds.has(id)) overlapCount++;
    }

    // With 10 puzzles each from different variations, overlap should be 0
    expect(overlapCount).toBe(0);

    // Verify openingVariation contains the correct variation name
    for (const p of najdorfPuzzles) {
      expect(p.openingVariation).toContain('Najdorf');
    }
    for (const p of dragonPuzzles) {
      expect(p.openingVariation).toContain('Dragon');
    }
  });

  it('should return puzzles when no variation is specified (all opening puzzles)', async () => {
    const allSicilianPuzzles = await getRandomPuzzlesByOpeningAndRating(
      'Sicilian Defence',
      0,
      3000,
      10,
      undefined,
      undefined
    );

    expect(allSicilianPuzzles.length).toBeGreaterThan(0);
    // All should be Sicilian
    for (const p of allSicilianPuzzles) {
      expect(p.openingName).toBe('Sicilian');
    }
  });

  it('should filter unclassified openings from getUniqueOpenings', async () => {
    const { getUniqueOpenings } = await import('./db');
    const openings = await getUniqueOpenings();

    // Should not contain Unclassified, Opening, or Unknown
    expect(openings).not.toContain('Unclassified');
    expect(openings).not.toContain('Opening');
    expect(openings).not.toContain('Unknown');

    // Should contain real openings
    expect(openings.length).toBeGreaterThan(0);
    console.log('Unique openings count:', openings.length);
  });
});
