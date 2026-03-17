"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search, Lock, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useState, useEffect } from "react";

// Mock opening data for now - will be replaced with database queries
const OPENINGS_DATA = {
  "French Defence": {
    variations: [
      { name: "Winawer Variation", puzzles: 245 },
      { name: "Classical Variation", puzzles: 189 },
      { name: "Tarrasch Variation", puzzles: 156 },
      { name: "Advance Variation", puzzles: 203, premium: true },
    ],
  },
  "Caro-Kann Defence": {
    variations: [
      { name: "Main Line", puzzles: 312 },
      { name: "Classical Variation", puzzles: 267 },
      { name: "Advance Variation", puzzles: 198 },
      { name: "Bronstein-Larsen Variation", puzzles: 145, premium: true },
    ],
  },
  "Sicilian Defence": {
    variations: [
      { name: "Najdorf Variation", puzzles: 456 },
      { name: "Dragon Variation", puzzles: 389 },
      { name: "Classical Variation", puzzles: 267 },
      { name: "Positional Variation", puzzles: 134 },
    ],
  },
  "Italian Game": {
    variations: [
      { name: "Two Knights Defense", puzzles: 234 },
      { name: "Giuoco Piano", puzzles: 189 },
      { name: "Fried Liver Attack", puzzles: 156 },
    ],
  },
  "Ruy Lopez": {
    variations: [
      { name: "Open Defense", puzzles: 345 },
      { name: "Closed Defense", puzzles: 289 },
      { name: "Berlin Defense", puzzles: 267 },
    ],
  },
};

type Step = "opening-selection" | "variation-selection" | "configuration";

const PUZZLE_COUNT_OPTIONS = [10, 25, 50, 100];

export default function Train() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("opening-selection");
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPuzzles, setIsFetchingPuzzles] = useState(false);

  // Configuration state
  const [minRating, setMinRating] = useState(1000);
  const [maxRating, setMaxRating] = useState(2000);
  const [targetCycles, setTargetCycles] = useState(3);
  const [colorFilter, setColorFilter] = useState("both");
  const [puzzleCount, setPuzzleCount] = useState(25);

  const createTrainingSet = trpc.trainingSets.create.useMutation();
  const fetchPuzzles = trpc.trainingSets.fetchPuzzles.useQuery(
    {
      theme: selectedVariation || "",
      minRating,
      maxRating,
      count: puzzleCount,
      colorFilter: colorFilter as "white" | "black" | "both",
    },
    { enabled: false }
  );

  const filteredOpenings = Object.keys(OPENINGS_DATA).filter((o) =>
    o.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentVariations = selectedOpening
    ? OPENINGS_DATA[selectedOpening as keyof typeof OPENINGS_DATA]?.variations || []
    : [];

  const currentVariationData = currentVariations.find(
    (v) => v.name === selectedVariation
  );
  const totalAvailablePuzzles = currentVariationData?.puzzles || 0;
  const maxPuzzleCount = Math.min(100, totalAvailablePuzzles);

  const handleOpeningSelect = (opening: string) => {
    setSelectedOpening(opening);
    setSelectedVariation(null);
    setStep("variation-selection");
  };

  const handleVariationSelect = (variation: string) => {
    setSelectedVariation(variation);
    setStep("configuration");
  };

  const handleStartSession = async () => {
    if (!selectedVariation) {
      toast.error("Please select a variation");
      return;
    }

    setIsLoading(true);
    setIsFetchingPuzzles(true);

    try {
      // Fetch real puzzles from database
      const result = await fetchPuzzles.refetch();

      if (!result.data?.success || !result.data?.puzzles) {
        toast.error("Failed to fetch puzzles from database");
        setIsLoading(false);
        setIsFetchingPuzzles(false);
        return;
      }

      const puzzles = result.data.puzzles;

      if (puzzles.length === 0) {
        toast.error("No puzzles found for this variation");
        setIsLoading(false);
        setIsFetchingPuzzles(false);
        return;
      }

      // Create training set with real puzzles
      const createResult = await createTrainingSet.mutateAsync({
        themes: [selectedVariation],
        minRating,
        maxRating,
        puzzleCount: Math.min(puzzleCount, puzzles.length),
        targetCycles,
        colorFilter: colorFilter as "white" | "black" | "both",
        puzzles: puzzles.slice(0, puzzleCount),
      });

      if (createResult.success && createResult.setId) {
        toast.success("Training set created!");
        setLocation(`/session/${createResult.setId}`);
      } else {
        toast.error("Failed to create training set");
      }
    } catch (error) {
      console.error("Error creating training set:", error);
      toast.error("Failed to create training set");
    } finally {
      setIsLoading(false);
      setIsFetchingPuzzles(false);
    }
  };

  // Step 1: Opening Selection
  if (step === "opening-selection") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-amber-400 mb-2">Configure Training</h1>
          <p className="text-amber-300 mb-8">Set up your spaced repetition cycle.</p>

          {/* Search */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search openings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-teal-900/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Opening List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOpenings.map((opening) => (
              <Card
                key={opening}
                onClick={() => handleOpeningSelect(opening)}
                className="bg-slate-900/50 border-teal-900/30 p-6 cursor-pointer hover:border-amber-400/50 transition-all"
              >
                <h3 className="text-lg font-semibold text-white mb-2">{opening}</h3>
                <p className="text-slate-400 text-sm">
                  {
                    OPENINGS_DATA[opening as keyof typeof OPENINGS_DATA]?.variations
                      .length
                  }{" "}
                  variations
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Variation Selection
  if (step === "variation-selection") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button
            onClick={() => setStep("opening-selection")}
            variant="outline"
            className="mb-8 border-teal-900/30 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Openings
          </Button>

          <h1 className="text-4xl font-bold text-amber-400 mb-2">{selectedOpening}</h1>
          <p className="text-amber-300 mb-8">Select a variation to train</p>

          {/* Variation List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentVariations.map((variation) => (
              <Card
                key={variation.name}
                onClick={() => {
                  if (!(variation as any).premium || user?.isPremium) {
                    handleVariationSelect(variation.name);
                  } else {
                    toast.error("This variation requires premium");
                  }
                }}
                className={`bg-slate-900/50 border-teal-900/30 p-6 cursor-pointer transition-all ${
                  (variation as any).premium && !user?.isPremium
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:border-amber-400/50"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">{variation.name}</h3>
                  {(variation as any).premium && <Lock className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-slate-400 text-sm">{variation.puzzles} puzzles available</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Configuration
  if (step === "configuration") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button
            onClick={() => setStep("variation-selection")}
            variant="outline"
            className="mb-8 border-teal-900/30 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Variations
          </Button>

          <h1 className="text-4xl font-bold text-amber-400 mb-2">{selectedVariation}</h1>
          <p className="text-amber-300 mb-8">Configure your training session</p>

          {/* Configuration Card */}
          <Card className="bg-slate-900/50 border-teal-900/30 p-8">
            <div className="space-y-8">
              {/* Rating Range */}
              <div>
                <label className="text-amber-400 font-bold mb-4 block">Rating Range</label>
                <div className="flex gap-4 items-center">
                  <input
                    type="number"
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="flex-1 px-4 py-3 bg-slate-800 border border-teal-900/30 rounded text-white text-lg"
                  />
                  <span className="text-slate-400 text-lg">-</span>
                  <input
                    type="number"
                    value={maxRating}
                    onChange={(e) => setMaxRating(Number(e.target.value))}
                    className="flex-1 px-4 py-3 bg-slate-800 border border-teal-900/30 rounded text-white text-lg"
                  />
                </div>
              </div>

              {/* Puzzle Count */}
              <div>
                <label className="text-amber-400 font-bold mb-4 block">
                  Puzzles per Cycle (Max: {maxPuzzleCount})
                </label>
                <div className="flex gap-3 flex-wrap">
                  {PUZZLE_COUNT_OPTIONS.map((count) => (
                    <Button
                      key={count}
                      onClick={() => setPuzzleCount(Math.min(count, maxPuzzleCount))}
                      disabled={count > maxPuzzleCount}
                      className={`px-6 py-3 text-lg font-semibold ${
                        puzzleCount === Math.min(count, maxPuzzleCount)
                          ? "bg-amber-400 hover:bg-amber-500 text-slate-900"
                          : "bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50"
                      }`}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Target Cycles - Centered */}
              <div className="flex justify-center">
                <div className="w-48">
                  <label className="text-amber-400 font-bold mb-4 block text-center">
                    Target Cycles
                  </label>
                  <input
                    type="number"
                    value={targetCycles}
                    onChange={(e) => setTargetCycles(Math.max(1, Number(e.target.value)))}
                    className="w-full px-4 py-3 bg-slate-800 border border-teal-900/30 rounded text-white text-lg text-center"
                  />
                </div>
              </div>

              {/* Color Filter */}
              <div>
                <label className="text-amber-400 font-bold mb-4 block">Color Filter</label>
                <div className="flex gap-3">
                  {["both", "white", "black"].map((color) => (
                    <Button
                      key={color}
                      onClick={() => setColorFilter(color)}
                      className={`flex-1 capitalize py-3 text-lg font-semibold ${
                        colorFilter === color
                          ? "bg-amber-400 hover:bg-amber-500 text-slate-900"
                          : "bg-slate-800 hover:bg-slate-700 text-white"
                      }`}
                    >
                      {color}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <Button
                onClick={handleStartSession}
                disabled={isLoading || isFetchingPuzzles}
                className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-4 text-xl mt-8"
              >
                {isFetchingPuzzles ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Fetching Puzzles...
                  </>
                ) : isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating Session...
                  </>
                ) : (
                  "Start Session"
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
