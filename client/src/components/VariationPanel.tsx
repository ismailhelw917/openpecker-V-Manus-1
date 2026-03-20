import React from "react";
import { trpc } from "../lib/trpc";
import { PuzzleVariationTree } from "./PuzzleVariationTree";

interface VariationPanelProps {
  puzzleId: string;
  isVisible: boolean;
  onToggle: () => void;
}

const VariationPanel: React.FC<VariationPanelProps> = ({ puzzleId, isVisible, onToggle }) => {
  const { data: puzzle, isLoading } = trpc.puzzleVariations.getWithVariations.useQuery(
    { puzzleId },
    { enabled: !!puzzleId }
  );

  return (
    <>
      <button
        onClick={onToggle}
        className="md:hidden fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg z-50"
        aria-label="Toggle variations panel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>

      <div className={[
        "fixed top-0 right-0 h-full bg-gray-800 text-white shadow-lg z-40 transform transition-transform duration-300 ease-in-out",
        "md:w-80 md:translate-x-0 w-full",
        isVisible ? "translate-x-0" : "translate-x-full",
      ].join(" ")}>
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Puzzle Variations</h2>
          <button onClick={onToggle} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="h-full overflow-y-auto p-4">
          <h2 className="text-xl font-bold mb-4 text-white">Variations</h2>
          {isLoading ? (
            <div className="p-4 animate-pulse">
              <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-700 rounded w-5/6"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ) : puzzle && puzzle.parsedVariations ? (
            <PuzzleVariationTree rootMove={puzzle.parsedVariations} />
          ) : (
            <p className="text-gray-400">No variations found for this puzzle.</p>
          )}
        </div>
      </div>

      {isVisible && <div onClick={onToggle} className="md:hidden fixed inset-0 bg-black opacity-50 z-30" />}
    </>
  );
};

export default VariationPanel;
