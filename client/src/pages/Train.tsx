import { ArrowLeft, Search, Lock, Loader2, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOrCreateDeviceId } from "@/_core/deviceId";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";

type Step = "opening-selection" | "subset-selection" | "variation-selection" | "configuration";

const PUZZLE_COUNT_OPTIONS = [50, 100, 150, 200, 250];

interface HierarchyItem {
  opening: string | null;
  subset: string | null;
  variation: string | null;
}

export default function Train() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("opening-selection");
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const [selectedSubset, setSelectedSubset] = useState<string | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPuzzles, setIsFetchingPuzzles] = useState(false);

  // Configuration state
  const [minRating, setMinRating] = useState(1000);
  const [maxRating, setMaxRating] = useState(2000);
  const [targetCycles, setTargetCycles] = useState(3);
  const [colorFilter, setColorFilter] = useState<"white" | "black" | "both">("both");
  const [puzzleCount, setPuzzleCount] = useState(50);

  // Fetch opening hierarchy using tRPC
  const getHierarchyQuery = trpc.openings.getHierarchy.useQuery({});

  const hierarchy = useMemo(() => {
    if (!getHierarchyQuery.data) return [];
    return getHierarchyQuery.data as HierarchyItem[];
  }, [getHierarchyQuery.data]);

  // Get unique openings
  const uniqueOpenings = useMemo(() => {
    const openings = new Set<string>();
    hierarchy.forEach(item => {
      if (item.opening) openings.add(item.opening);
    });
    return Array.from(openings).sort();
  }, [hierarchy]);

  // Get subsets for selected opening
  const subsets = useMemo(() => {
    if (!selectedOpening) return [];
    const subsetSet = new Set<string>();
    hierarchy.forEach(item => {
      if (item.opening === selectedOpening && item.subset) {
        subsetSet.add(item.subset);
      }
    });
    return Array.from(subsetSet).sort();
  }, [selectedOpening, hierarchy]);

  // Get variations for selected opening and subset
  const variations = useMemo(() => {
    if (!selectedOpening || !selectedSubset) return [];
    const variationSet = new Set<string>();
    hierarchy.forEach(item => {
      if (item.opening === selectedOpening && item.subset === selectedSubset && item.variation) {
        variationSet.add(item.variation);
      }
    });
    return Array.from(variationSet).sort();
  }, [selectedOpening, selectedSubset, hierarchy]);

  // Filter openings by search query
  const filteredOpenings = useMemo(() => {
    return uniqueOpenings.filter(opening =>
      opening.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [uniqueOpenings, searchQuery]);

  // Filter subsets by search query
  const filteredSubsets = useMemo(() => {
    return subsets.filter(subset =>
      subset.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [subsets, searchQuery]);

  // Filter variations by search query
  const filteredVariations = useMemo(() => {
    return variations.filter(variation =>
      variation.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [variations, searchQuery]);

  // Get puzzle count for current selection from hierarchy
  const puzzleCountForSelection = useMemo(() => {
    const matching = hierarchy.filter(item => {
      if (selectedOpening && item.opening !== selectedOpening) return false;
      if (selectedSubset && item.subset !== selectedSubset) return false;
      if (selectedVariation && item.variation !== selectedVariation) return false;
      return true;
    });
    // Sum up puzzle counts from matching hierarchy items
    return matching.reduce((sum, item) => sum + (item.puzzleCount || 0), 0);
  }, [selectedOpening, selectedSubset, selectedVariation, hierarchy]);

  const createTrainingSet = trpc.trainingSets.create.useMutation();

  const handleStartSession = async () => {
    if (!selectedOpening) {
      toast.error("Please select an opening");
      return;
    }

    setIsFetchingPuzzles(true);
    try {
      const deviceId = getOrCreateDeviceId();

      // Create training set with hierarchy parameters
      const result = await createTrainingSet.mutateAsync({
        userId: user?.id,
        deviceId,
        opening: selectedOpening,
        subset: selectedSubset || undefined,
        variation: selectedVariation || undefined,
        minRating,
        maxRating,
        puzzleCount,
        color: colorFilter,
        cycles: targetCycles,
      });

      if (result && typeof result === 'string') {
        toast.success("Training session started!");
        setLocation(`/session/${result}`);
      } else if (result && typeof result === 'object' && 'setId' in result) {
        toast.success("Training session started!");
        setLocation(`/session/${result.setId}`);
      } else {
        toast.error("Failed to create training session");
      }
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error("Failed to start training session");
    } finally {
      setIsFetchingPuzzles(false);
    }
  };

  const handleBack = () => {
    if (step === "configuration") {
      setStep("variation-selection");
    } else if (step === "variation-selection") {
      setStep("subset-selection");
    } else if (step === "subset-selection") {
      setStep("opening-selection");
    }
  };

  const handleSelectOpening = (opening: string) => {
    setSelectedOpening(opening);
    setSelectedSubset(null);
    setSelectedVariation(null);
    setSearchQuery("");
    if (subsets.length > 0) {
      setStep("subset-selection");
    } else {
      setStep("configuration");
    }
  };

  const handleSelectSubset = (subset: string) => {
    setSelectedSubset(subset);
    setSelectedVariation(null);
    setSearchQuery("");
    if (variations.length > 0) {
      setStep("variation-selection");
    } else {
      setStep("configuration");
    }
  };

  const handleSelectVariation = (variation: string) => {
    setSelectedVariation(variation);
    setSearchQuery("");
    setStep("configuration");
  };

  if (isLoading || getHierarchyQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Train</h1>
          {step !== "opening-selection" && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>

        {/* Opening Selection */}
        {step === "opening-selection" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search openings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Scrollable opening list */}
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2">
              {filteredOpenings.length > 0 ? (
                filteredOpenings.map(opening => {
                  // Sum puzzle counts for this opening across all subsets/variations
                  const puzzleCount = hierarchy
                    .filter(h => h.opening === opening)
                    .reduce((sum, item) => sum + (item.puzzleCount || 0), 0);
                  return (
                    <div
                      key={opening}
                      onClick={() => handleSelectOpening(opening)}
                      className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:shadow-teal-500/20 border border-slate-600 hover:border-teal-500 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white group-hover:text-teal-400 transition-colors">{opening}</h3>
                          <p className="text-sm text-slate-400">
                            {puzzleCount} puzzle{puzzleCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-400 transition-colors" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-slate-400 py-12">No openings found</p>
              )}
            </div>
          </div>
        )}

        {/* Subset Selection */}
        {step === "subset-selection" && (
          <div className="space-y-4">
            <div className="bg-teal-900/30 border border-teal-700 rounded-lg p-4">
              <p className="text-sm text-teal-300">
                <span className="font-semibold">Opening:</span> {selectedOpening}
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search subsets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Scrollable subset list */}
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2">
              {filteredSubsets.length > 0 ? (
                filteredSubsets.map(subset => {
                  // Sum puzzle counts for this subset across all variations
                  const puzzleCount = hierarchy
                    .filter(h => h.opening === selectedOpening && h.subset === subset)
                    .reduce((sum, item) => sum + (item.puzzleCount || 0), 0);
                  return (
                    <div
                      key={subset}
                      onClick={() => handleSelectSubset(subset)}
                      className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:shadow-teal-500/20 border border-slate-600 hover:border-teal-500 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white group-hover:text-teal-400 transition-colors">{subset}</h3>
                          <p className="text-sm text-slate-400">
                            {puzzleCount} puzzle{puzzleCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-400 transition-colors" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-slate-400 py-12">No subsets found</p>
              )}
            </div>
          </div>
        )}

        {/* Variation Selection */}
        {step === "variation-selection" && (
          <div className="space-y-4">
            <div className="bg-teal-900/30 border border-teal-700 rounded-lg p-4 space-y-2">
              <p className="text-sm text-teal-300">
                <span className="font-semibold">Opening:</span> {selectedOpening}
              </p>
              <p className="text-sm text-teal-300">
                <span className="font-semibold">Subset:</span> {selectedSubset}
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search variations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Scrollable variation list */}
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2">
              {filteredVariations.length > 0 ? (
                filteredVariations.map(variation => {
                  // Get puzzle count for this specific variation
                  const puzzleCount = hierarchy
                    .filter(h => h.opening === selectedOpening && h.subset === selectedSubset && h.variation === variation)
                    .reduce((sum, item) => sum + (item.puzzleCount || 0), 0);
                  return (
                    <div
                      key={variation}
                      onClick={() => handleSelectVariation(variation)}
                      className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:shadow-teal-500/20 border border-slate-600 hover:border-teal-500 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white group-hover:text-teal-400 transition-colors">{variation}</h3>
                          <p className="text-sm text-slate-400">
                            {puzzleCount} puzzle{puzzleCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-400 transition-colors" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-slate-400 py-12">No variations found</p>
              )}
            </div>
          </div>
        )}

        {/* Configuration */}
        {step === "configuration" && (
          <div className="space-y-6">
            <div className="bg-teal-900/30 border border-teal-700 rounded-lg p-4 space-y-2">
              <p className="text-sm text-teal-300">
                <span className="font-semibold">Opening:</span> {selectedOpening}
              </p>
              {selectedSubset && (
                <p className="text-sm text-teal-300">
                  <span className="font-semibold">Subset:</span> {selectedSubset}
                </p>
              )}
              {selectedVariation && (
                <p className="text-sm text-teal-300">
                  <span className="font-semibold">Variation:</span> {selectedVariation}
                </p>
              )}
              <p className="text-sm text-teal-300 pt-2 border-t border-teal-700">
                <span className="font-semibold">Available Puzzles:</span> {puzzleCountForSelection}
              </p>
            </div>

            <div className="bg-slate-700 rounded-lg p-6 space-y-6 border border-slate-600">
              {/* Puzzle Count */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Puzzles per Session
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {PUZZLE_COUNT_OPTIONS.map(count => (
                    <button
                      key={count}
                      onClick={() => setPuzzleCount(count)}
                      className={`py-2 px-3 rounded-lg font-medium transition-all ${
                        puzzleCount === count
                          ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/50'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating Range */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Rating Range
                </label>
                <div className="space-y-2">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-slate-400">Min</label>
                      <input
                        type="number"
                        value={minRating}
                        onChange={(e) => setMinRating(parseInt(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-600 border border-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-400">Max</label>
                      <input
                        type="number"
                        value={maxRating}
                        onChange={(e) => setMaxRating(parseInt(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-600 border border-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cycles */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Training Cycles
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(cycle => (
                    <button
                      key={cycle}
                      onClick={() => setTargetCycles(cycle)}
                      className={`py-2 px-4 rounded-lg font-medium transition-all ${
                        targetCycles === cycle
                          ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/50'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {cycle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Filter */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Color
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['white', 'black', 'both'] as const).map(color => (
                    <button
                      key={color}
                      onClick={() => setColorFilter(color)}
                      className={`py-2 px-3 rounded-lg font-medium transition-all capitalize ${
                        colorFilter === color
                          ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/50'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartSession}
                disabled={isFetchingPuzzles}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-teal-600/50 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isFetchingPuzzles ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Starting Session...
                  </>
                ) : (
                  'Start Session'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
