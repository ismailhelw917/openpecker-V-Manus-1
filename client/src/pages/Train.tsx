import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOrCreateDeviceId } from "@/_core/deviceId";
import { useHierarchyCache } from "@/hooks/useHierarchyCache";
import { toast } from "sonner";
import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, Lock, Zap } from "lucide-react";

type Step = "opening-selection" | "variation-selection" | "configuration";

const PUZZLE_COUNT_OPTIONS = [50, 100, 150, 200, 250];

interface HierarchyItem {
  opening: string;
  puzzleCount: number;
  variations: Array<{
    variation: string;
    puzzleCount: number;
  }>;
}

export default function Train() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("opening-selection");
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPuzzles, setIsFetchingPuzzles] = useState(false);

  // Scroll indicator state
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Configuration state
  const [minRating, setMinRating] = useState(1000);
  const [maxRating, setMaxRating] = useState(2000);
  const [targetCycles, setTargetCycles] = useState(3);
  const [colorFilter, setColorFilter] = useState<"white" | "black" | "both">("both");
  const [puzzleCount, setPuzzleCount] = useState(50);

  // Load hierarchy from static JSON (instant, no server requests)
  const { hierarchy, isLoading: hierarchyLoading } = useHierarchyCache();

  // Create session mutation
  const createSessionMutation = trpc.puzzleSession.create.useMutation();

  // Check if scrollable content exists below viewport
  useEffect(() => {
    const checkScroll = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const hasMore = el.scrollHeight > el.clientHeight + el.scrollTop + 50;
      setShowScrollIndicator(hasMore);
    };

    // Check on mount and when step changes
    const timer = setTimeout(checkScroll, 100);
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
    }

    return () => {
      clearTimeout(timer);
      if (el) {
        el.removeEventListener("scroll", checkScroll);
      }
    };
  }, [step, selectedOpening, selectedVariation]);

  // Get unique openings
  const uniqueOpenings = useMemo(() => {
    return hierarchy.map(h => ({
      opening: h.opening,
      puzzleCount: h.puzzleCount
    }));
  }, [hierarchy]);

  // Get variations for selected opening
  const variations = useMemo(() => {
    if (!selectedOpening) return [];
    const item = hierarchy.find(h => h.opening === selectedOpening);
    return item?.variations || [];
  }, [selectedOpening, hierarchy]);

  // Filter openings by search query
  const filteredOpenings = useMemo(() => {
    return uniqueOpenings.filter(item =>
      item.opening.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [uniqueOpenings, searchQuery]);

  // Determine which openings are free (first ~19%) vs premium (remaining ~81%)
  // Reduced from 25% to lock 6 more openings behind premium
  const freeOpeningLimit = useMemo(() => {
    return Math.max(Math.ceil(uniqueOpenings.length * 0.19), 5); // At least 5 free
  }, [uniqueOpenings]);

  const isOpeningLocked = (openingName: string): boolean => {
    if (user?.isPremium) return false;
    const index = uniqueOpenings.findIndex(o => o.opening === openingName);
    return index >= freeOpeningLimit;
  };

  // Filter variations by search query
  const filteredVariations = useMemo(() => {
    return variations.filter(v =>
      v.variation.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [variations, searchQuery]);

  // Get puzzle count for current selection
  const puzzleCountForSelection = useMemo(() => {
    if (selectedVariation && selectedOpening) {
      const opening = hierarchy.find(h => h.opening === selectedOpening);
      const variation = opening?.variations.find(v => v.variation === selectedVariation);
      return variation?.puzzleCount || 0;
    }
    if (selectedOpening) {
      const opening = hierarchy.find(h => h.opening === selectedOpening);
      return opening?.puzzleCount || 0;
    }
    return 0;
  }, [selectedOpening, selectedVariation, hierarchy]);

  const handleSelectOpening = (opening: string) => {
    // Check premium lock
    if (isOpeningLocked(opening)) {
      toast("Premium opening", {
        description: "Upgrade to Premium to unlock all openings.",
        action: {
          label: "Upgrade",
          onClick: () => setLocation("/settings"),
        },
      });
      return;
    }

    // Clear search and variation first
    setSearchQuery("");
    setSelectedVariation(null);
    
    // Check if there are variations for this opening
    const openingData = hierarchy.find(h => h.opening === opening);
    const hasVariations = openingData && openingData.variations.length > 0;
    
    // Set opening and advance step in sequence
    setSelectedOpening(opening);
    
    if (hasVariations) {
      setStep("variation-selection");
    } else {
      setStep("configuration");
    }
  };

  const handleSelectVariation = (variation: string) => {
    setSearchQuery("");
    setSelectedVariation(variation);
    setStep("configuration");
  };

  const handleStartSession = async () => {
    if (!selectedOpening) {
      toast.error("Please select an opening");
      return;
    }

    if (!selectedVariation) {
      toast.error("Please select a variation");
      return;
    }

    setIsLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();

      const session = await createSessionMutation.mutateAsync({
        opening: selectedOpening,
        variation: selectedVariation,
        puzzleCount,
        minRating,
        maxRating,
        targetCycles,
        colorFilter,
        deviceId,
      });

      if (session?.id) {
        setLocation(`/session/${session.id}`);
      } else {
        toast.error("Failed to create training session: No session ID");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Failed to create training session");
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "variation-selection") {
      setSelectedOpening(null);
      setSelectedVariation(null);
      setSearchQuery("");
      setStep("opening-selection");
    } else if (step === "configuration") {
      setSelectedVariation(null);
      setSearchQuery("");
      setStep("variation-selection");
    }
  };

  const scrollDown = () => {
    scrollContainerRef.current?.scrollBy({ top: 200, behavior: "smooth" });
  };

  if (hierarchyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading openings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-slate-800 rounded-lg p-8 text-center">
            <div className="mb-4">
              <div className="inline-block">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-teal-400 rounded-full animate-spin"></div>
              </div>
            </div>
            <p className="text-white font-semibold text-lg">Loading Session...</p>
            <p className="text-slate-400 text-sm mt-2">Preparing your training session</p>
          </div>
        </div>
      )}

      {/* Main scrollable area - takes full height minus bottom nav */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 pb-24"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-white">Train</h1>
              {step !== "opening-selection" && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                  Back
                </button>
              )}
            </div>

            {/* Selection Display */}
            {selectedOpening && (
              <div className="bg-teal-900/30 border border-teal-700/50 rounded-lg p-4 mb-6">
                <div className="text-sm text-teal-300">
                  <div>Opening: <span className="font-semibold text-teal-100">{selectedOpening}</span></div>
                  {selectedVariation && (
                    <div>Variation: <span className="font-semibold text-teal-100">{selectedVariation}</span></div>
                  )}
                  <div>Available Puzzles: <span className="font-semibold text-teal-100">{puzzleCountForSelection}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Opening Selection */}
          {step === "opening-selection" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Search openings...</label>
                <input
                  type="text"
                  placeholder="Search openings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-2">
                {filteredOpenings.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">No openings found</div>
                ) : (
                  filteredOpenings.map((item) => {
                    const locked = isOpeningLocked(item.opening);
                    return (
                      <button
                        key={item.opening}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectOpening(item.opening);
                        }}
                        className={`w-full text-left px-3 sm:px-4 py-3 rounded-lg transition border ${
                          locked
                            ? "bg-slate-800/60 border-slate-700/50 opacity-75"
                            : "bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-teal-500"
                        }`}
                        style={{ touchAction: "manipulation" }}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {locked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            <span className={`font-medium truncate min-w-0 text-sm sm:text-base ${locked ? 'text-slate-400' : 'text-white'}`}>{item.opening}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {locked && <span className="text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">PRO</span>}
                            <span className="text-gray-400 text-xs sm:text-sm whitespace-nowrap">{item.puzzleCount.toLocaleString()}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Variation Selection */}
          {step === "variation-selection" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Search variations...</label>
                <input
                  type="text"
                  placeholder="Search variations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-2">
                {filteredVariations.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">No variations found</div>
                ) : (
                  filteredVariations.map((variation) => (
                    <button
                      key={variation.variation}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectVariation(variation.variation);
                      }}
                      className="w-full text-left px-3 sm:px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition border border-slate-600 hover:border-teal-500"
                      style={{ touchAction: "manipulation" }}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-white font-medium truncate min-w-0 text-sm sm:text-base">{variation.variation}</span>
                        <span className="text-gray-400 text-xs sm:text-sm shrink-0 whitespace-nowrap">{variation.puzzleCount.toLocaleString()}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Configuration */}
          {step === "configuration" && (
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 sm:p-6 space-y-6" id="config-panel">
              {/* Puzzle Count */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Puzzles per Session</label>
                <div className="flex gap-2 flex-wrap">
                  {PUZZLE_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setPuzzleCount(count)}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        puzzleCount === count
                          ? "bg-teal-600 text-white"
                          : "bg-slate-600 text-gray-300 hover:bg-slate-500"
                      }`}
                      style={{ touchAction: "manipulation" }}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Rating Range</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Min</label>
                    <input
                      type="number"
                      value={minRating}
                      onChange={(e) => setMinRating(parseInt(e.target.value) || 1000)}
                      className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Max</label>
                    <input
                      type="number"
                      value={maxRating}
                      onChange={(e) => setMaxRating(parseInt(e.target.value) || 2000)}
                      className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cycles */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Cycles</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((cycle) => (
                    <button
                      key={cycle}
                      onClick={() => setTargetCycles(cycle)}
                      className={`px-3 py-2 rounded font-medium transition ${
                        targetCycles === cycle
                          ? "bg-teal-600 text-white"
                          : "bg-slate-600 text-gray-300 hover:bg-slate-500"
                      }`}
                      style={{ touchAction: "manipulation" }}
                    >
                      {cycle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Color</label>
                <div className="flex gap-2">
                  {(["white", "black", "both"] as const).map((color) => (
                    <button
                      key={color}
                      onClick={() => setColorFilter(color)}
                      className={`flex-1 py-2 rounded font-medium transition capitalize whitespace-nowrap text-sm sm:text-base ${
                        colorFilter === color
                          ? "bg-teal-600 text-white"
                          : "bg-slate-600 text-gray-300 hover:bg-slate-500"
                      }`}
                      style={{ touchAction: "manipulation" }}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Button - Native <button> element for best iOS/Android compatibility */}
              <button
                type="button"
                onClick={handleStartSession}
                disabled={isLoading || isFetchingPuzzles}
                className="w-full py-4 text-lg text-white font-semibold rounded-lg text-center bg-teal-600 active:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed select-none"
                style={{
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
                  WebkitAppearance: "none",
                }}
              >
                {isLoading || isFetchingPuzzles ? "Loading..." : "Start Session"}
              </button>
            </div>
          )}

          {/* Extra bottom spacing for mobile nav */}
          <div className="h-8"></div>
        </div>
      </div>

      {/* Scroll Down Indicator */}
      {showScrollIndicator && (
        <button
          onClick={scrollDown}
          className="fixed bottom-20 right-4 z-40 bg-teal-600 hover:bg-teal-700 text-white rounded-full p-2 shadow-lg animate-bounce"
          style={{ touchAction: "manipulation" }}
          aria-label="Scroll down"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
