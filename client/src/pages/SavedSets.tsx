import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Play, Trash2, Plus, Loader2 } from "lucide-react";
import CreateSetDialog from "@/components/CreateSetDialog";

export default function SavedSets() {
  const [, setLocation] = useLocation();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const sets = setsQuery.data || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white">Training Sets</h1>
          </div>
          <Button
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Set
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {sets.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700 p-12 text-center">
            <p className="text-slate-300 mb-6">No training sets yet</p>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => setShowCreateDialog(true)}
            >
              Create Your First Set
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sets.map((set: any) => (
              <Card
                key={set.id}
                className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 transition-colors overflow-hidden"
              >
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {set.openingName || "Untitled Set"}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {set.puzzleCount} puzzles • {set.targetCycles} cycles
                    </p>
                  </div>

                  <div className="space-y-2 mb-6 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rating Range:</span>
                      <span className="text-white">
                        {set.minRating} - {set.maxRating}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Progress:</span>
                      <span className="text-white">
                        {set.cyclesCompleted} / {set.targetCycles}
                      </span>
                    </div>
                    {set.bestAccuracy && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Best Accuracy:</span>
                        <span className="text-amber-400">
                          {Math.round(Number(set.bestAccuracy))}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-amber-600 hover:bg-amber-700"
                      onClick={() => handlePlaySet(set.id)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteSet(set.id)}
                      disabled={deleteSetMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Set Dialog */}
      {showCreateDialog && (
        <CreateSetDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            setsQuery.refetch();
          }}
          deviceId={deviceId}
        />
      )}
    </div>
  );
}
