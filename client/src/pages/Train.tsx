import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search, Lock, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useState, useEffect } from "react";

type Step = "opening-selection" | "configuration";

const PUZZLE_COUNT_OPTIONS = [50, 100, 150, 200, 250];

export default function Train() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("opening-selection");
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPuzzles, setIsFetchingPuzzles] = useState(false);
  const [openings, setOpenings] = useState<string[]>([]);

  // Configuration state
  const [minRating, setMinRating] = useState(1000);
  const [maxRating, setMaxRating] = useState(2000);
  const [targetCycles, setTargetCycles] = useState(3);
  const [colorFilter, setColorFilter] = useState<"white" | "black" | "both">("both");
  const [puzzleCount, setPuzzleCount] = useState(50);

  // Fetch available openings using tRPC
  const getOpeningsQuery = trpc.openings.getNames.useQuery();

  useEffect(() => {
    if (getOpeningsQuery.data && Array.isArray(getOpeningsQuery.data)) {
      setOpenings(getOpeningsQuery.data);
    }
  }, [getOpeningsQuery.data]);

  useEffect(() => {
    setIsLoading(getOpeningsQuery.isLoading);
  }, [getOpeningsQuery.isLoading]);

  useEffect(() => {
    if (getOpeningsQuery.error) {
      toast.error("Failed to load openings");
    }
  }, [getOpeningsQuery.error]);

  const createTrainingSet = trpc.trainingSets.create.useMutation();
  const fetchPuzzlesMutation = trpc.trainingSets.fetchPuzzlesByOpening.useMutation();

  const handleStartSession = async () => {
    if (!selectedOpening) {
      toast.error("Please select an opening");
      return;
    }

    setIsFetchingPuzzles(true);
    try {
      // Get device ID from localStorage
      const deviceId = localStorage.getItem("openpecker-device-id") || "";

      // Fetch puzzles for the selected opening using tRPC mutation
      const puzzlesResponse = await fetchPuzzlesMutation.mutateAsync({
        opening: selectedOpening,
        minRating,
        maxRating,
        count: puzzleCount,
        colorFilter,
      });

      const puzzles = puzzlesResponse.puzzles || [];
      if (!puzzles || puzzles.length === 0) {
        toast.error(`No puzzles found for ${selectedOpening} with selected filters`);
        setIsFetchingPuzzles(false);
        return;
      }

      // Create training set with fetched puzzles
      const result = await createTrainingSet.mutateAsync({
        userId: user?.id,
        deviceId,
        openingName: selectedOpening,
        openingFen: "",
        themes: [selectedOpening],
        minRating,
        maxRating,
        puzzleCount: puzzles.length,
        targetCycles,
        colorFilter,
        puzzles,
      });

      if (result.success && result.setId) {
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

  // Group openings by parent name and extract variations
  const groupedOpenings = openings.reduce((acc, opening) => {
    const parts = opening.split(' ');
    let parentName = opening;
    
    // Check if this is a variation (contains keywords like Accepted, Declined, etc.)
    const variationKeywords = ['Accepted', 'Declined', 'Variation', 'System', 'Line'];
    const isVariation = variationKeywords.some(keyword => opening.endsWith(keyword));
    
    if (isVariation && parts.length > 1) {
      // Remove the last word (variation keyword)
      parentName = parts.slice(0, -1).join(' ');
    }
    
    // Find or create parent group
    let parent = acc.find(g => g.name === parentName);
    if (!parent) {
      parent = { name: parentName, variations: [] };
      acc.push(parent);
    }
    
    // Add this opening as a variation if it's different from parent
    if (opening !== parentName) {
      parent.variations.push(opening);
    }
    
    return acc;
  }, [] as Array<{ name: string; variations: string[] }>);
  
  // Filter grouped openings
  const filteredGroupedOpenings = groupedOpenings
    .map(group => ({
      ...group,
      variations: group.variations.filter(v =>
        v.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }))
    .filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.variations.length > 0
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 overflow-y-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
          {step !== "opening-selection" && (
            <button
              onClick={() => {
                setStep("opening-selection");
                setSelectedOpening(null);
              }}
              className="p-2 hover:bg-slate-800 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-amber-400" />
            </button>
          )}
          <h1 className="text-lg sm:text-2xl font-bold text-amber-400">
            {step === "opening-selection" ? "Select Opening" : "Configure Session"}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {step === "opening-selection" ? (
          <>
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search openings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Openings Grid */}
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGroupedOpenings.length > 0 ? (
                  filteredGroupedOpenings.map((group, groupIndex) => {
                    const isLocked = groupIndex % 10 >= 3;
                    const canAccess = !isLocked || user?.isPremium;
                    return (
                      <div key={group.name}>
                        {/* Parent Opening */}
                        <Card
                          onClick={() => {
                            if (!canAccess) {
                              toast.error("Unlock this opening with a premium account", {
                                action: { label: "Upgrade", onClick: () => setLocation("/settings") },
                              });
                              return;
                            }
                            setSelectedOpening(group.name);
                            setStep("configuration");
                          }}
                          className={`p-4 cursor-pointer transition border-2 relative ${
                            selectedOpening === group.name
                              ? "border-amber-400 bg-amber-400/10"
                              : "border-slate-700 hover:border-amber-400 bg-slate-800/50"
                          } ${!canAccess ? "opacity-60" : ""}`}
                        >
                          <h3 className="font-semibold text-white text-sm sm:text-lg pr-6">{group.name}</h3>
                          <p className="text-sm text-slate-400 mt-1">
                            {group.variations.length > 0 ? `${group.variations.length} variations` : "Click to select"}
                          </p>
                          {isLocked && !user?.isPremium && (
                            <div className="absolute top-2 right-2">
                              <Lock className="w-5 h-5 text-amber-400" />
                            </div>
                          )}
                        </Card>

                        {/* Subvariations */}
                        {group.variations.length > 0 && (
                          <div className="ml-4 mt-2 space-y-2 border-l-2 border-slate-700 pl-4">
                            {group.variations.map((variation, varIndex) => {
                              // If parent is locked, all subsets are also locked
                              const varIsLocked = isLocked || ((groupIndex * 10 + varIndex) % 10 >= 3);
                              const varCanAccess = !varIsLocked || user?.isPremium;
                              return (
                                <Card
                                  key={variation}
                                  onClick={() => {
                                    if (!varCanAccess) {
                                      toast.error("Unlock this variation with a premium account", {
                                        action: { label: "Upgrade", onClick: () => setLocation("/settings") },
                                      });
                                      return;
                                    }
                                    setSelectedOpening(variation);
                                    setStep("configuration");
                                  }}
                                  className={`p-3 cursor-pointer transition border-2 relative ${
                                    selectedOpening === variation
                                      ? "border-amber-400 bg-amber-400/10"
                                      : "border-slate-700 hover:border-amber-400 bg-slate-800/30"
                                  } ${!varCanAccess ? "opacity-60" : ""}`}
                                >
                                  <h4 className="font-medium text-slate-200 text-sm">{variation}</h4>
                                  {varIsLocked && !user?.isPremium && (
                                    <div className="absolute top-2 right-2">
                                      <Lock className="w-4 h-4 text-amber-400" />
                                    </div>
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-400">No openings found</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Configuration */}
            <Card className="bg-slate-800 border-slate-700 p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-xl font-semibold text-white mb-4 sm:mb-6 break-words">
                {selectedOpening}
              </h2>

              {/* Rating Range */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Rating Range
                </label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      placeholder="Min"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={maxRating}
                      onChange={(e) => setMaxRating(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      placeholder="Max"
                    />
                  </div>
                </div>
              </div>

              {/* Puzzle Count */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Puzzles per Session
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {PUZZLE_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setPuzzleCount(count)}
                      className={`py-2 px-3 rounded transition ${
                        puzzleCount === count
                          ? "bg-amber-400 text-slate-900 font-semibold"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Cycles */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Target Cycles
                </label>
                <input
                  type="number"
                  value={targetCycles}
                  onChange={(e) => setTargetCycles(Number(e.target.value))}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center"
                />
              </div>

              {/* Color Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {["both", "white", "black"].map((color: any) => (
                    <button
                      key={color}
                      onClick={() => setColorFilter(color as "white" | "black" | "both")}
                      className={`flex-1 py-2 px-3 rounded transition capitalize ${
                        colorFilter === color
                          ? "bg-amber-400 text-slate-900 font-semibold"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Start Button */}
            <Button
              onClick={handleStartSession}
              disabled={isFetchingPuzzles}
              className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-3 rounded-lg transition"
            >
              {isFetchingPuzzles ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading Puzzles...
                </>
              ) : (
                "Start Session →"
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
