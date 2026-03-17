import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search, Lock, Check } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// Sample opening data structure
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

type Step = "opening-selection" | "variation-selection" | "puzzle-selection" | "configuration";

export default function Train() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("opening-selection");
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [selectedPuzzles, setSelectedPuzzles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Configuration state
  const [minRating, setMinRating] = useState(1000);
  const [maxRating, setMaxRating] = useState(2000);
  const [targetCycles, setTargetCycles] = useState(3);
  const [colorFilter, setColorFilter] = useState("both");

  const createTrainingSet = trpc.trainingSets.create.useMutation();

  const filteredOpenings = Object.keys(OPENINGS_DATA).filter((o) =>
    o.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentVariations = selectedOpening
    ? OPENINGS_DATA[selectedOpening as keyof typeof OPENINGS_DATA]?.variations || []
    : [];

  const handleOpeningSelect = (opening: string) => {
    setSelectedOpening(opening);
    setSelectedVariation(null);
    setSelectedPuzzles([]);
    setStep("variation-selection");
  };

  const handleVariationSelect = (variationName: string) => {
    setSelectedVariation(variationName);
    setSelectedPuzzles([]);
    setStep("puzzle-selection");
  };

  const handlePuzzleToggle = (puzzleId: string) => {
    setSelectedPuzzles((prev) =>
      prev.includes(puzzleId)
        ? prev.filter((p) => p !== puzzleId)
        : [...prev, puzzleId]
    );
  };

  const handleStartSession = async () => {
    if (selectedPuzzles.length === 0) {
      toast.error("Please select at least one puzzle");
      return;
    }

    setIsLoading(true);
    try {
      // Create mock puzzle objects for now
      const puzzles = selectedPuzzles.map((id) => ({
        id,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moves: ["e2e4"],
        rating: Math.floor(Math.random() * 1000) + 1000,
        themes: ["opening"],
        color: "white",
      }));

      const result = await createTrainingSet.mutateAsync({
        themes: [selectedVariation || ""],
        minRating,
        maxRating,
        puzzleCount: selectedPuzzles.length,
        targetCycles,
        colorFilter: colorFilter as "white" | "black" | "both",
        puzzles,
      });

      if (result.setId) {
        toast.success("Training set created!");
        setLocation(`/session/${result.setId}`);
      }
    } catch (error) {
      console.error("Error creating training set:", error);
      toast.error("Failed to create training set");
    } finally {
      setIsLoading(false);
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

  // Step 3: Puzzle Selection
  if (step === "puzzle-selection") {
    const currentVariationData = currentVariations.find(
      (v) => v.name === selectedVariation
    );
    const totalPuzzles = currentVariationData?.puzzles || 0;

    // Generate mock puzzle list
    const puzzleList = Array.from({ length: Math.min(totalPuzzles, 50) }, (_, i) => ({
      id: `puzzle_${i + 1}`,
      name: `Puzzle ${i + 1}`,
      rating: Math.floor(Math.random() * 1000) + 1000,
    }));

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
          <p className="text-amber-300 mb-2">Select puzzles to train ({selectedPuzzles.length} selected)</p>
          <p className="text-slate-400 mb-8">Total available: {totalPuzzles} puzzles</p>

          {/* Puzzle Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {puzzleList.map((puzzle) => (
              <Card
                key={puzzle.id}
                onClick={() => handlePuzzleToggle(puzzle.id)}
                className={`bg-slate-900/50 border-teal-900/30 p-4 cursor-pointer transition-all ${
                  selectedPuzzles.includes(puzzle.id)
                    ? "border-amber-400 bg-amber-400/10"
                    : "hover:border-amber-400/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-semibold text-sm">{puzzle.name}</p>
                  {selectedPuzzles.includes(puzzle.id) && (
                    <Check className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <p className="text-slate-400 text-xs">Rating: {puzzle.rating}</p>
              </Card>
            ))}
          </div>

          {/* Configuration */}
          <Card className="bg-slate-900/50 border-teal-900/30 p-6 mb-8">
            <h3 className="text-amber-400 font-bold mb-6">Session Configuration</h3>

            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Rating Range */}
              <div>
                <label className="text-slate-400 text-sm mb-2 block">Rating Range</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-teal-900/30 rounded text-white text-sm"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="number"
                    value={maxRating}
                    onChange={(e) => setMaxRating(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-teal-900/30 rounded text-white text-sm"
                  />
                </div>
              </div>

              {/* Target Cycles */}
              <div>
                <label className="text-slate-400 text-sm mb-2 block">Target Cycles</label>
                <input
                  type="number"
                  value={targetCycles}
                  onChange={(e) => setTargetCycles(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-teal-900/30 rounded text-white text-sm"
                />
              </div>
            </div>

            {/* Color Filter */}
            <div>
              <label className="text-slate-400 text-sm mb-3 block">Color Filter</label>
              <div className="flex gap-3">
                {["both", "white", "black"].map((color) => (
                  <Button
                    key={color}
                    onClick={() => setColorFilter(color)}
                    className={`flex-1 capitalize ${
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
          </Card>

          {/* Start Button */}
          <Button
            onClick={handleStartSession}
            disabled={isLoading || selectedPuzzles.length === 0}
            className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-3 text-lg"
          >
            {isLoading ? "Creating Session..." : "Start Session"}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
