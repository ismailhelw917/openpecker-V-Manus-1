import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Play, Trash2, Loader2, Plus } from "lucide-react";

export default function SavedSets() {
  const [, setLocation] = useLocation();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const storedDeviceId = localStorage.getItem("openpecker-device-id");
    setDeviceId(storedDeviceId);
  }, []);

  // Fetch saved sets
  const setsQuery = trpc.trainingSets.list.useQuery(
    {
      deviceId: deviceId || undefined,
    },
    {
      enabled: !!deviceId,
    }
  );

  const deleteSetMutation = trpc.trainingSets.delete.useMutation({
    onSuccess: () => {
      setsQuery.refetch();
    },
  });

  const handleDeleteSet = async (id: string) => {
    if (confirm("Are you sure you want to delete this training set?")) {
      await deleteSetMutation.mutateAsync({ id });
    }
  };

  const handlePlaySet = (id: string) => {
    setLocation(`/training/${id}`);
  };

  if (setsQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const sets = setsQuery.data || [];
  const activeSets = sets.filter((s: any) => s.status === "active");
  const pausedSets = sets.filter((s: any) => s.status === "paused");
  const completedSets = sets.filter((s: any) => s.status === "completed");

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
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold text-amber-400">Your Sets</h1>
          </div>
          <Button
            onClick={() => setLocation("/train")}
            className="bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold px-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            NEW SET
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Active Training Section */}
        {activeSets.length > 0 && (
          <div className="mb-12">
            <h2 className="text-amber-400 font-bold text-sm uppercase mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Active Training
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeSets.map((set: any) => (
                <Card
                  key={set.id}
                  className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700 transition-colors overflow-hidden"
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-amber-400 mb-2">
                      {set.openingName || "Custom Set"}
                    </h3>
                    <p className="text-slate-400 text-sm">{set.puzzleCount} Puzzles</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">CYCLE PROGRESS</span>
                      <span className="text-white font-semibold">
                        {set.cyclesCompleted || 0} / {set.targetCycles}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className="bg-amber-400 h-2 rounded-full transition-all"
                        style={{
                          width: `${((set.cyclesCompleted || 0) / set.targetCycles) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-slate-800/50 rounded p-3">
                      <p className="text-slate-400 text-xs uppercase">Best Accuracy</p>
                      <p className="text-white font-bold text-lg">
                        {set.bestAccuracy ? `${Math.round(Number(set.bestAccuracy))}%` : "0%"}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded p-3">
                      <p className="text-slate-400 text-xs uppercase">Last Played</p>
                      <p className="text-white font-bold">
                        {set.lastPlayedAt
                          ? new Date(set.lastPlayedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => handlePlaySet(set.id)}
                    className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-2 rounded-lg transition-colors"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    RESUME CYCLE
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Paused Sets Section */}
        {pausedSets.length > 0 && (
          <div className="mb-12">
            <h2 className="text-slate-400 font-bold text-sm uppercase mb-6">Paused</h2>
            <div className="space-y-3">
              {pausedSets.map((set: any) => (
                <Card
                  key={set.id}
                  className="bg-slate-800/30 border-slate-700 p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                >
                  <div>
                    <h3 className="text-white font-semibold">{set.openingName || "Custom Set"}</h3>
                    <p className="text-slate-400 text-sm">
                      {set.puzzleCount} puzzles • {set.cyclesCompleted || 0} / {set.targetCycles}{" "}
                      cycles
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => handlePlaySet(set.id)}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteSet(set.id)}
                      disabled={deleteSetMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Completed Sets Section */}
        {completedSets.length > 0 && (
          <div className="mb-12">
            <h2 className="text-slate-400 font-bold text-sm uppercase mb-6">Completed</h2>
            <div className="space-y-3">
              {completedSets.map((set: any) => (
                <Card
                  key={set.id}
                  className="bg-slate-800/30 border-slate-700 p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                >
                  <div>
                    <h3 className="text-white font-semibold">{set.openingName || "Custom Set"}</h3>
                    <p className="text-slate-400 text-sm">
                      {set.puzzleCount} puzzles • Final accuracy:{" "}
                      {set.bestAccuracy ? `${Math.round(Number(set.bestAccuracy))}%` : "—"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteSet(set.id)}
                    disabled={deleteSetMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {sets.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-12 text-center">
            <p className="text-slate-300 mb-6">No training sets yet</p>
            <Button
              className="bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold"
              onClick={() => setLocation("/train")}
            >
              Create Your First Set
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
