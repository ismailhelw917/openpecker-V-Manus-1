import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Play } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

interface CreateSetDialogProps {
  onClose: () => void;
  onSuccess: () => void;
  deviceId: string | null;
}

function CreateSetDialog({ onClose, onSuccess, deviceId }: CreateSetDialogProps) {
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
            ✕
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
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-300">Creating training set...</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function Train() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [, setLocation] = useLocation();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    // Get or create device ID
    let id = localStorage.getItem("openpecker-device-id");
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("openpecker-device-id", id);
    }
    setDeviceId(id);
  }, []);

  // Fetch training sets
  const trainingSetsQuery = trpc.trainingSets.list.useQuery({
    deviceId: deviceId || undefined,
  });

  const trainingSets = trainingSetsQuery.data || [];

  return (
    <div className="min-h-screen bg-slate-950 pb-24 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Training</h1>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Set
          </button>
        </div>

        {trainingSets.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700 p-12 text-center">
            <p className="text-slate-400 mb-4">No training sets yet</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Create Your First Set
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {trainingSets.map((set: any) => (
              <Card
                key={set.id}
                className="bg-slate-800/50 border-slate-700 p-6 hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => setLocation(`/train/${set.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {set.openingName || "Custom Set"}
                    </h3>
                    <div className="flex gap-4 text-sm text-slate-400">
                      <span>{set.puzzleCount} puzzles</span>
                      <span>{set.targetCycles} cycles</span>
                      <span>Status: {set.status}</span>
                    </div>
                  </div>
                  <Play className="w-6 h-6 text-amber-400" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreateDialog && (
        <CreateSetDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            trainingSetsQuery.refetch();
          }}
          deviceId={deviceId}
        />
      )}
    </div>
  );
}
