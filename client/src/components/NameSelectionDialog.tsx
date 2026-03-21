import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface NameSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentName?: string;
  onNameSave: (name: string) => Promise<void>;
}

export default function NameSelectionDialog({
  isOpen,
  onClose,
  currentName,
  onNameSave,
}: NameSelectionDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentName) {
      setName(currentName);
    }
  }, [currentName, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (name.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }

    if (name.trim().length > 50) {
      toast.error("Name must be less than 50 characters");
      return;
    }

    setLoading(true);
    try {
      await onNameSave(name.trim());
      toast.success("Name updated successfully!");
      onClose();
    } catch (error: any) {
      console.error("Failed to save name:", error);
      toast.error(error?.message || "Failed to save name. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleSave();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Your Name</DialogTitle>
          <DialogDescription>
            This is how you'll appear on the leaderboard and in your profile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            maxLength={50}
            autoFocus
            className="text-base"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !name.trim()}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
