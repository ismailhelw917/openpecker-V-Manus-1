import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { X, Loader2 } from "lucide-react";

interface CreateSetDialogProps {
  onClose: () => void;
  onSuccess: () => void;
  deviceId: string | null;
}

export default function CreateSetDialog({ onClose, onSuccess, deviceId }: CreateSetDialogProps) {
  const [step, setStep] = useState<"opening" | "themes" | "settings" | "loading">("opening");
  const [selectedOpening, setSelectedOpening] = useState("");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(1000);
  const [maxRating, setMaxRating] = useState(2000);
  const [puzzleCount, setPuzzleCount] = useState(20);
  const [targetCycles, setTargetCycles] = useState(3);
  const [colorFilter, setColorFilter] = useState("both");

  // Fetch openings
  const openingsQuery = trpc.openings.list.useQuery();

  // Create training set mutation
  const createSetMutation = trpc.trainingSets.create.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const openings = openingsQuery.data?.openings || [];

  const commonThemes = [
    "opening",
    "endgame",
    "middlegame",
    "tactical",
    "sacrifice",
    "pin",
    "fork",
    "skewer",
    "discovered-attack",
    "double-attack",
    "back-rank",
    "promotion",
  ];

  const handleCreateSet = async () => {
    if (!selectedThemes.length) {
      alert("Please select at least one theme");
      return;
    }

    setStep("loading");

    try {
      // Fetch puzzles using tRPC client
      const utils = trpc.useUtils();
      const puzzlesResponse = await utils.puzzles.fetchByTheme.fetch({
        theme: selectedThemes[0],
        minRating,
        maxRating,
        count: puzzleCount,
        color: colorFilter as "white" | "black" | "both",
      });

      if (!puzzlesResponse?.success || !puzzlesResponse?.puzzles?.length) {
        alert("No puzzles found for the selected criteria");
        setStep("settings");
        return;
      }

      // Create training set
      await createSetMutation.mutateAsync({
        deviceId: deviceId || undefined,
        openingName: selectedOpening || undefined,
        themes: selectedThemes,
        minRating,
        maxRating,
        puzzleCount,
        targetCycles,
        colorFilter: colorFilter as "white" | "black" | "both",
        puzzles: puzzlesResponse.puzzles || [],
      });
    } catch (error: any) {
      console.error("Error creating training set:", error);
      alert(error?.message || "Failed to create training set");
      setStep("settings");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-slate-800 border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-800">
          <h2 className="text-xl font-bold text-white">Create Training Set</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === "opening" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Opening (Optional)
                </label>
                <select
                  value={selectedOpening}
                  onChange={(e) => setSelectedOpening(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                >
                  <option value="">No specific opening</option>
                  {openings.map((opening: any) => (
                    <option key={opening.id} value={opening.name}>
                      {opening.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                className="w-full bg-amber-600 hover:bg-amber-700"
                onClick={() => setStep("themes")}
              >
                Next
              </Button>
            </div>
          )}

          {step === "themes" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Select Themes
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {commonThemes.map((theme) => (
                    <button
                      key={theme}
                      onClick={() => {
                        if (selectedThemes.includes(theme)) {
                          setSelectedThemes(selectedThemes.filter((t) => t !== theme));
                        } else {
                          setSelectedThemes([...selectedThemes, theme]);
                        }
                      }}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        selectedThemes.includes(theme)
                          ? "bg-amber-600 text-white"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("opening")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                  onClick={() => setStep("settings")}
                  disabled={!selectedThemes.length}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === "settings" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Rating Range
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="number"
                    value={maxRating}
                    onChange={(e) => setMaxRating(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Puzzles per Cycle: {puzzleCount}
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={puzzleCount}
                  onChange={(e) => setPuzzleCount(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Target Cycles: {targetCycles}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={targetCycles}
                  onChange={(e) => setTargetCycles(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Color Filter
                </label>
                <select
                  value={colorFilter}
                  onChange={(e) => setColorFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                >
                  <option value="both">Both</option>
                  <option value="white">White</option>
                  <option value="black">Black</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("themes")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                  onClick={handleCreateSet}
                  disabled={createSetMutation.isPending}
                >
                  Create
                </Button>
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-4" />
              <p className="text-slate-300">Creating training set...</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
