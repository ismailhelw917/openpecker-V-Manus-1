import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

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

  const openerThemes = OPENER_THEMES.filter((t) =>
    t.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tacticalThemes = TACTICAL_THEMES.filter((t) =>
    t.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allThemes = themeType === "opener" ? openerThemes : tacticalThemes;

  const handleSelectTheme = (theme: string) => {
    if (selectedThemes.includes(theme)) {
      setSelectedThemes(selectedThemes.filter((t) => t !== theme));
    } else {
      setSelectedThemes([...selectedThemes, theme]);
    }
  };

  const handleStartSession = () => {
    // In a real app, this would create a training session
    console.log("Starting session with:", {
      themes: selectedThemes,
      minRating,
      maxRating,
      puzzlesPerCycle,
      targetCycles,
      colorFilter,
    });
    // Navigate to puzzle solving interface
    // setLocation("/puzzle");
  };

  const estimatedTime = Math.ceil((puzzlesPerCycle * 2) / 60); // ~2 min per puzzle

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-teal-900/30 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-amber-400">Configure Training</h1>
          </div>
          <p className="text-slate-400 text-sm">Set up your spaced repetition cycle.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {step === "theme-selection" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Theme Selection */}
            <div className="lg:col-span-2">
              <Card className="bg-slate-900/50 border-teal-900/30 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center">
                      <span className="text-amber-400 text-sm">⊙</span>
                    </div>
                    <h2 className="text-xl font-semibold text-white">Select Theme</h2>
                  </div>
                  <button
                    onClick={() => setSelectedThemes([])}
                    className="text-amber-400 text-sm font-semibold hover:text-amber-300 transition-colors"
                  >
                    RESET
                  </button>
                </div>

                <p className="text-slate-400 mb-6">Choose an opening or tactical theme</p>

                {/* Theme Type Tabs */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => {
                      setThemeType("opener");
                      setSearchQuery("");
                    }}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                      themeType === "opener"
                        ? "bg-amber-400 text-slate-900"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    OPENER THEMES
                  </button>
                  <button
                    onClick={() => {
                      setThemeType("tactical");
                      setSearchQuery("");
                    }}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                      themeType === "tactical"
                        ? "bg-amber-400 text-slate-900"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    TACTICAL THEMES
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search themes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Theme Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {allThemes.map((theme) => {
                    const isPremium = PREMIUM_THEMES.includes(theme);
                    const isSelected = selectedThemes.includes(theme);

                    return (
                      <button
                        key={theme}
                        onClick={() => {
                          if (!isPremium || user) {
                            handleSelectTheme(theme);
                          }
                        }}
                        disabled={isPremium && !user}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? "border-amber-400 bg-amber-400/10"
                            : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                        } ${isPremium && !user ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-medium text-white">{theme}</span>
                          {isPremium && !user && (
                            <Lock className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Right: Configuration */}
            <div className="lg:col-span-1">
              <Card className="bg-slate-900/50 border-teal-900/30 p-6 sticky top-24">
                <h3 className="text-lg font-semibold text-white mb-6">
                  Rating Range
                  <span className="text-amber-400 ml-2">{minRating} – {maxRating}</span>
                </h3>

                <div className="space-y-6">
                  {/* Rating Range */}
                  <div>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="number"
                        value={minRating}
                        onChange={(e) => setMinRating(Number(e.target.value))}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm"
                      />
                      <span className="text-slate-500">–</span>
                      <input
                        type="number"
                        value={maxRating}
                        onChange={(e) => setMaxRating(Number(e.target.value))}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>

                  {/* Puzzles per Cycle */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-slate-300 text-sm font-medium">Puzzles per Cycle</label>
                      <span className="text-amber-400 font-semibold">{puzzlesPerCycle}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 20, 50, 100].map((num) => (
                        <button
                          key={num}
                          onClick={() => setPuzzlesPerCycle(num)}
                          className={`py-2 rounded font-semibold text-sm transition-colors ${
                            puzzlesPerCycle === num
                              ? "bg-amber-400 text-slate-900"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {[150, 200, 400].map((num) => (
                        <button
                          key={num}
                          onClick={() => setPuzzlesPerCycle(num)}
                          className={`py-2 rounded font-semibold text-sm transition-colors ${
                            puzzlesPerCycle === num
                              ? "bg-amber-400 text-slate-900"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target Cycles */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-slate-300 text-sm font-medium">Target Cycles</label>
                      <span className="text-amber-400 font-semibold">{targetCycles}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 3, 5, 7, "∞"].map((num) => (
                        <button
                          key={num}
                          onClick={() => setTargetCycles(num === "∞" ? 999 : Number(num))}
                          className={`py-2 rounded font-semibold text-sm transition-colors ${
                            targetCycles === (num === "∞" ? 999 : Number(num))
                              ? "bg-amber-400 text-slate-900"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Filter */}
                  <div>
                    <label className="text-slate-300 text-sm font-medium block mb-3">
                      Color Filter
                      <span className="text-amber-400 ml-2">{colorFilter}</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Both", "White", "Black"].map((color) => (
                        <button
                          key={color}
                          onClick={() => setColorFilter(color.toLowerCase())}
                          className={`py-2 rounded font-semibold text-sm transition-colors ${
                            colorFilter === color.toLowerCase()
                              ? "bg-amber-400 text-slate-900"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Session Summary */}
        {selectedThemes.length > 0 && (
          <Card className="bg-slate-900/50 border-teal-900/30 p-6 mt-6">
            <h3 className="text-teal-400 font-semibold text-sm uppercase mb-4">Session Summary</h3>
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⊙</span>
                <div>
                  <p className="text-slate-400 text-sm">Theme:</p>
                  <p className="text-white font-semibold">{selectedThemes.length} themes selected</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">↻</span>
                <div>
                  <p className="text-slate-400 text-sm">Total Puzzles:</p>
                  <p className="text-white font-semibold">{puzzlesPerCycle * targetCycles}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏱</span>
                <div>
                  <p className="text-slate-400 text-sm">Est. Time:</p>
                  <p className="text-white font-semibold">~{estimatedTime} min</p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleStartSession}
              disabled={selectedThemes.length === 0}
              className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-3 rounded-lg transition-colors"
            >
              ▶ START SESSION
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
