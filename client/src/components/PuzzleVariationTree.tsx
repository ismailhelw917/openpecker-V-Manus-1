import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Zap } from 'lucide-react';

export interface ChessMoveNode {
  algebraicMove: string;
  evaluationScore?: number | null;
  isBestMove?: boolean;
  nextMoves?: ChessMoveNode[];
  moveIndex?: number;
}

interface PuzzleVariationTreeProps {
  rootMove: ChessMoveNode | null;
  onMoveSelect?: (moveSequence: string[]) => void;
  selectedPath?: string[];
}

/**
 * Hierarchical display component for puzzle variations
 * Shows the main line and alternative variations in a tree structure
 */
export const PuzzleVariationTree: React.FC<PuzzleVariationTreeProps> = ({
  rootMove,
  onMoveSelect,
  selectedPath = [],
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  if (!rootMove) {
    return (
      <div className="text-sm text-muted-foreground p-2">
        No variations available
      </div>
    );
  }

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderMove = (
    move: ChessMoveNode,
    path: string[] = [],
    depth: number = 0,
    isMainLine: boolean = true
  ) => {
    const currentPath = [...path, move.algebraicMove];
    const nodeId = currentPath.join('-');
    const isExpanded = expandedNodes.has(nodeId);
    const isSelected = JSON.stringify(selectedPath) === JSON.stringify(currentPath);
    const hasVariations = move.nextMoves && move.nextMoves.length > 1;
    const hasContinuation = move.nextMoves && move.nextMoves.length > 0;

    return (
      <div key={nodeId} className="text-sm">
        <div
          className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-100 dark:bg-blue-900'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          onClick={() => {
            if (hasContinuation) {
              toggleNode(nodeId);
            }
            if (onMoveSelect) {
              onMoveSelect(currentPath);
            }
          }}
        >
          {/* Expansion toggle */}
          {hasContinuation ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(nodeId);
              }}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {/* Best move indicator */}
          {move.isBestMove && (
            <Zap className="w-3 h-3 text-yellow-500 flex-shrink-0" />
          )}

          {/* Move notation */}
          <span
            className={`font-mono font-semibold ${
              move.isBestMove ? 'text-green-600 dark:text-green-400' : ''
            } ${isMainLine ? 'font-bold' : ''}`}
          >
            {move.algebraicMove}
          </span>

          {/* Evaluation score if available */}
          {move.evaluationScore !== null && move.evaluationScore !== undefined && (
            <span className="text-xs text-muted-foreground ml-1">
              ({move.evaluationScore > 0 ? '+' : ''}{move.evaluationScore.toFixed(1)})
            </span>
          )}
        </div>

        {/* Nested variations */}
        {isExpanded && hasContinuation && (
          <div className="ml-4 border-l border-gray-300 dark:border-gray-600 pl-2">
            {move.nextMoves!.map((nextMove, idx) => (
              <div key={idx}>
                {renderMove(
                  nextMove,
                  currentPath,
                  depth + 1,
                  idx === 0 // First move is main line
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg bg-card p-3 max-h-96 overflow-y-auto">
      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
        Puzzle Variations
      </div>
      {renderMove(rootMove, [], 0, true)}
    </div>
  );
};

/**
 * Flatten a variation tree into a list of all possible move sequences
 */
export function getAllVariationPaths(root: ChessMoveNode | null): string[][] {
  if (!root) return [];

  const paths: string[][] = [];

  function traverse(node: ChessMoveNode, path: string[]) {
    path.push(node.algebraicMove);

    if (!node.nextMoves || node.nextMoves.length === 0) {
      paths.push([...path]);
    } else {
      for (const nextMove of node.nextMoves) {
        traverse(nextMove, path);
      }
    }

    path.pop();
  }

  traverse(root, []);
  return paths;
}

/**
 * Get the main line (first variation) from a tree
 */
export function getMainLine(root: ChessMoveNode | null): string[] {
  if (!root) return [];

  const moves: string[] = [];
  let current: ChessMoveNode | null = root;

  while (current) {
    moves.push(current.algebraicMove);
    current =
      current.nextMoves && current.nextMoves.length > 0
        ? current.nextMoves[0]
        : null;
  }

  return moves;
}

/**
 * Convert a flat move sequence to a tree structure
 */
export function sequenceToTree(moves: string[]): ChessMoveNode | null {
  if (moves.length === 0) return null;

  const root: ChessMoveNode = {
    algebraicMove: moves[0],
    isBestMove: true,
    nextMoves: [],
  };

  let current = root;
  for (let i = 1; i < moves.length; i++) {
    const newNode: ChessMoveNode = {
      algebraicMove: moves[i],
      isBestMove: i === 1,
      nextMoves: [],
    };
    current.nextMoves = [newNode];
    current = newNode;
  }

  return root;
}
