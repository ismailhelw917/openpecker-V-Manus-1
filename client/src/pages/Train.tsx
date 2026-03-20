import { ArrowLeft, Search, Lock, Loader2, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOrCreateDeviceId } from "@/_core/deviceId";
import { useHierarchyCache, hierarchyFilters } from "@/hooks/useHierarchyCache";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";

type Step = "opening-selection" | "subset-selection" | "variation-selection" | "configuration";

const PUZZLE_COUNT_OPTIONS = [50, 100, 150, 200, 250];

interface HierarchyItem {
  opening: string | null;
  subset: string | null;
  variation: string | null;
  puzzleCount?: number;
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

  // Load hierarchy from static JSON (instant, no server requests)
  const { hierarchy, isLoading: hierarchyLoading } = useHierarchyCache();
  
  // Debug logging
  useEffect(() => {
    console.log('[Train] Hierarchy loaded:', hierarchy.length, 'items');
    if (hierarchy.length > 0) {
      const alekhineItems = hierarchy.filter(h => h.opening === 'Alekhine');
      console.log('[Train] Alekhine items:', alekhineItems.length);
      const subsets = new Set();
      alekhineItems.forEach(item => {
        if (item.subset) subsets.add(item.subset);
      });
      console.log('[Train] Alekhine subsets:', Array.from(subsets));
    }
  }, [hierarchy]);

  // Get unique openings using client-side filter
  const uniqueOpenings = useMemo(() => {
    return hierarchyFilters.getOpenings(hierarchy);
  }, [hierarchy]);

  // Get subsets for selected opening using client-side filter
  const subsets = useMemo(() => {
    if (!selectedOpening) return [];
    const result = hierarchyFilters.getSubsets(hierarchy, selectedOpening);
    console.log('[Train] getSubsets for', selectedOpening, ':', result);
    return result;
  }, [selectedOpening, hierarchy]);

  // Get variations for selected opening and subset using client-side filter
  const variations = useMemo(() => {
    if (!selectedOpening || !selectedSubset) return [];
    return hierarchyFilters.getVariations(hierarchy, selectedOpening, selectedSubset);
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

  // Get puzzle count for current selection using client-side filter
  const puzzleCountForSelection = useMemo(() => {
    if (selectedVariation) {
      return hierarchyFilters.getVariationCount(
        hierarchy,
        selectedOpening || '',
        selectedSubset || '',
        selectedVariation
      );
    } else if (selectedSubset) {
      return hierarchyFilters.getSubsetCount(
        hierarchy,
        selectedOpening || '',
        selectedSubset
      );
    } else if (selectedOpening) {
      return hierarchyFilters.getOpeningCount(hierarchy, selectedOpening);
    }
    return 0;
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
    // Calculate subsets directly instead of using stale value from useMemo
    const newSubsets = hierarchyFilters.getSubsets(hierarchy, opening);
    if (newSubsets.length > 0) {
      setStep("subset-selection");
    } else {
      setStep("configuration");
    }
  };

  const handleSelectSubset = (subset: string) => {
    setSelectedSubset(subset);
    setSelectedVariation(null);
    setSearchQuery("");
    // Calculate variations directly instead of using stale value from useMemo
    const newVariations = hierarchyFilters.getVariations(hierarchy, selectedOpening || '', subset);
    if (newVariations.length > 0) {
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

  if (isLoading || hierarchyLoading) {
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
                  // Get puzzle count using client-side filter
                  const puzzleCount = hierarchyFilters.getOpeningCount(hierarchy, opening);
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
                  // Get puzzle count using client-side filter
                  const puzzleCount = hierarchyFilters.getSubsetCount(
                    hierarchy,
                    selectedOpening || '',
                    subset
                  );
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
                  // Get puzzle count using client-side filter
                  const puzzleCount = hierarchyFilters.getVariationCount(
                    hierarchy,
                    selectedOpening || '',
                    selectedSubset || '',
                    variation
                  );
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
