import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const OPENER_THEMES = [
  "Caro-Kann Defense",
  "French Defense",
  "Sicilian Defense",
  "Italian Game",
  "Ruy Lopez",
  "Grob's Attack",
];

const TACTICAL_THEMES = [
  "Pin",
  "Fork",
  "Skewer",
  "Discovered Attack",
  "Double Attack",
  "Back Rank Mate",
  "Promotion",
  "Sacrifice",
];

const PREMIUM_THEMES = [
  "Advance Variation",
  "Bronstein-Larsen Variation",
];

export default function Train() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<"theme-selection" | "configuration">("theme-selection");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [themeType, setThemeType] = useState<"opener" | "tactical">("opener");
  
  // Configuration state
  const [minRating, setMinRating] = useState(1000);
  const [maxRating, setMaxRating] = useState(2000);
  const [puzzlesPerCycle, setPuzzlesPerCycle] = useState(20);
  const [targetCycles, setTargetCycles] = useState(3);
  const [colorFilter, setColorFilter] = useState("white");
  const [isLoading, setIsLoading] = useState(false);

  const createTrainingSet = trpc.trainingSets.create.useMutation();

  const openerThemes = OPENER_THEMES.filter((t) =>
    t.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tacticalThemes = TACTICAL_THEMES.filter((t) =>
    t.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleThemeSelect = (theme: string) => {
    setSelectedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
    );
  };

  const handleStartSession = async () => {
    if (selectedThemes.length === 0) {
      toast.error("Please select at least one theme");
      return;
    }

    setIsLoading(true);
    try {
      // Fetch puzzles for the selected themes
      const puzzles = [];
      for (const theme of selectedThemes) {
        const puzzleResult = await fetch(`/api/trpc/puzzles.fetchByTheme?input=${JSON.stringify({
          theme,
          minRating,
          maxRating,
          count: puzzlesPerCycle,
          color: colorFilter === 'both' ? undefined : colorFilter,
        })}`);
        // Note: This is a simplified approach - in production, use proper tRPC client
      }

      const result = await createTrainingSet.mutateAsync({
        themes: selectedThemes,
        minRating,
        maxRating,
        puzzleCount: puzzlesPerCycle,
        targetCycles,
        colorFilter: colorFilter as 'white' | 'black' | 'both',
        puzzles: [], // TODO: Fetch actual puzzles
      });

      if (result.setId) {
        setLocation(`/session/${result.setId}`);
      }
    } catch (error) {
      toast.error("Failed to create training session");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "theme-selection") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
        {/* Header */}
        <div className="bg-slate-900/50 backdrop-blur border-b border-teal-900/30 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-amber-400 mb-2">Configure Training</h1>
            <p className="text-slate-400">Set up your spaced repetition cycle.</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Theme Selection */}
            <Card className="lg:col-span-2 bg-slate-900/50 border-teal-900/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center">
                    <span className="text-amber-400">◉</span>
                  </div>
                  <h2 className="text-white font-bold">Select Theme</h2>
                </div>
                <button className="text-amber-400 text-sm font-bold hover:text-amber-300">
                  RESET
                </button>
              </div>

              {/* Theme Type Tabs */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => setThemeType("opener")}
                  className={`px-4 py-2 rounded font-semibold transition-all ${
                    themeType === "opener"
                      ? "bg-amber-400 text-slate-900"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  OPENER THEMES
                </button>
                <button
                  onClick={() => setThemeType("tactical")}
                  className={`px-4 py-2 rounded font-semibold transition-all ${
                    themeType === "tactical"
                      ? "bg-amber-400 text-slate-900"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  TACTICAL THEMES
                </button>
              </div>

              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search themes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Themes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {themeType === "opener"
                  ? openerThemes.map((theme) => (
                      <button
                        key={theme}
                        onClick={() => handleThemeSelect(theme)}
                        className={`p-3 rounded border-2 transition-all text-left ${
                          selectedThemes.includes(theme)
                            ? "bg-amber-400/10 border-amber-400 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {theme}
                      </button>
                    ))
                  : tacticalThemes.map((theme) => (
                      <button
                        key={theme}
                        onClick={() => handleThemeSelect(theme)}
                        className={`p-3 rounded border-2 transition-all text-left ${
                          selectedThemes.includes(theme)
                            ? "bg-amber-400/10 border-amber-400 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {theme}
                      </button>
                    ))}
              </div>

              {/* Premium Themes */}
              <div className="border-t border-slate-700 pt-6">
                <h3 className="text-amber-400 font-bold mb-3">Premium Themes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PREMIUM_THEMES.map((theme) => (
                    <div
                      key={theme}
                      className="p-3 rounded bg-slate-800/50 border border-slate-700 flex items-center justify-between"
                    >
                      <span className="text-slate-400">{theme}</span>
                      <Lock className="w-4 h-4 text-amber-400" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Configuration Panel */}
            <Card className="bg-teal-900/20 border-teal-600/40 p-6">
              <h3 className="text-amber-400 font-bold mb-6">Configuration</h3>

              {/* Rating Range */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white font-semibold">Rating Range</label>
                  <span className="text-amber-400 text-sm">
                    {minRating} – {maxRating}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={minRating}
                    onChange={(e) => setMinRating(parseInt(e.target.value))}
                    className="flex-1 bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="number"
                    value={maxRating}
                    onChange={(e) => setMaxRating(parseInt(e.target.value))}
                    className="flex-1 bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded"
                  />
                </div>
              </div>

              {/* Puzzles per Cycle */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-semibold">Puzzles per Cycle</label>
                  <span className="text-amber-400 font-bold">{puzzlesPerCycle}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 50, 100].map((num) => (
                    <button
                      key={num}
                      onClick={() => setPuzzlesPerCycle(num)}
                      className={`py-2 rounded font-semibold transition-all ${
                        puzzlesPerCycle === num
                          ? "bg-amber-400 text-slate-900"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Cycles */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-semibold">Target Cycles</label>
                  <span className="text-amber-400 font-bold">{targetCycles}</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 3, 5, 7, "∞"].map((num) => (
                    <button
                      key={num}
                      onClick={() => setTargetCycles(typeof num === 'number' ? num : 999)}
                      className={`py-2 rounded font-semibold transition-all ${
                        (num === "∞" ? targetCycles === 999 : targetCycles === num)
                          ? "bg-amber-400 text-slate-900"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Filter */}
              <div className="mb-6">
                <label className="text-white font-semibold block mb-3">Color Filter</label>
                <div className="grid grid-cols-3 gap-2">
                  {["both", "white", "black"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setColorFilter(color)}
                      className={`py-2 rounded font-semibold transition-all capitalize ${
                        colorFilter === color
                          ? "bg-amber-400 text-slate-900"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Session Summary */}
              <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
                <h4 className="text-teal-400 font-bold text-sm mb-3 uppercase">Session Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Theme:</span>
                    <span className="text-white font-semibold">
                      {selectedThemes.length} themes selected
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Puzzles:</span>
                    <span className="text-white font-semibold">
                      {puzzlesPerCycle * targetCycles}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Est. Time:</span>
                    <span className="text-white font-semibold">
                      ~{Math.round((puzzlesPerCycle * targetCycles * 2) / 60)} min
                    </span>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <Button
                onClick={handleStartSession}
                disabled={isLoading || selectedThemes.length === 0}
                className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-3 rounded-lg transition-all disabled:opacity-50"
              >
                {isLoading ? "Starting..." : "▶ START SESSION"}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
