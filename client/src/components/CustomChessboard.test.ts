import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomChessboard } from './CustomChessboard';
import { Chess } from 'chess.js';

describe('CustomChessboard - Auto-Solve and Auto-Next Features', () => {
  it('should display auto-solve indicator when isAutoSolving is true', () => {
    const game = new Chess();
    const { container } = render(
      <CustomChessboard
        game={game}
        isAutoSolving={true}
        autoNextCountdown={null}
      />
    );

    const autoSolveIndicator = container.querySelector('div:has-text("Auto-solving...")');
    expect(autoSolveIndicator || container.innerHTML.includes('Auto-solving')).toBeTruthy();
  });

  it('should display auto-next countdown when countdown is active', () => {
    const game = new Chess();
    const { container } = render(
      <CustomChessboard
        game={game}
        isAutoSolving={false}
        autoNextCountdown={2}
      />
    );

    expect(container.innerHTML.includes('Next puzzle in')).toBeTruthy();
    expect(container.innerHTML.includes('2')).toBeTruthy();
  });

  it('should not display countdown when autoNextCountdown is null', () => {
    const game = new Chess();
    const { container } = render(
      <CustomChessboard
        game={game}
        isAutoSolving={false}
        autoNextCountdown={null}
      />
    );

    expect(container.innerHTML.includes('Next puzzle in')).toBeFalsy();
  });

  it('should not display countdown when autoNextCountdown is 0', () => {
    const game = new Chess();
    const { container } = render(
      <CustomChessboard
        game={game}
        isAutoSolving={false}
        autoNextCountdown={0}
      />
    );

    expect(container.innerHTML.includes('Next puzzle in')).toBeFalsy();
  });

  it('should animate auto-solve move squares with green pulsing effect', () => {
    const game = new Chess();
    const { container } = render(
      <CustomChessboard
        game={game}
        autoSolveMove={{ from: 'e2', to: 'e4' }}
        isAutoSolving={true}
      />
    );

    // Check that motion divs are present for animation
    const motionDivs = container.querySelectorAll('[class*="bg-green"]');
    expect(motionDivs.length).toBeGreaterThan(0);
  });

  it('should clear auto-solve move when not provided', () => {
    const game = new Chess();
    const { container, rerender } = render(
      <CustomChessboard
        game={game}
        autoSolveMove={{ from: 'e2', to: 'e4' }}
      />
    );

    let greenSquares = container.querySelectorAll('[class*="bg-green"]');
    expect(greenSquares.length).toBeGreaterThan(0);

    rerender(
      <CustomChessboard
        game={game}
        autoSolveMove={null}
      />
    );

    greenSquares = container.querySelectorAll('[class*="bg-green"]');
    expect(greenSquares.length).toBe(0);
  });
});
