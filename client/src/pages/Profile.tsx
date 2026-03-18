import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Edit2, Save, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Get user stats
  const userStats = trpc.stats.getUserStats.useQuery(undefined, {
    enabled: !!user?.id,
  });

  // Update profile mutation
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      setMessage({ type: "success", text: "Profile updated successfully" });
      setIsEditing(false);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: "error", text: error.message || "Failed to update profile" });
    },
  });

  // Change password mutation
  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setMessage({ type: "success", text: "Password changed successfully" });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: "error", text: error.message || "Failed to change password" });
    },
  });

  const handleSaveProfile = () => {
    if (!user?.id) return;
    
    updateProfileMutation.mutate({
      userId: user.id,
      name: formData.name,
      email: formData.email,
    });
  };

  const handleChangePassword = () => {
    if (!user?.id) return;
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    changePasswordMutation.mutate({
      userId: user.id,
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  if (!user) {
    return (
      <div className="w-screen h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-20">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Please log in to view your profile</p>
          <Button
            onClick={() => setLocation("/")}
            className="bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-teal-900/30 bg-slate-900/50 sticky top-0 z-10">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-amber-400 hover:text-amber-300 font-bold text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-lg font-bold text-amber-400">My Profile</h1>
        <div className="w-4" />
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* Message Alert */}
        {message && (
          <div
            className={`p-4 rounded-lg border ${
              message.type === "success"
                ? "bg-green-900/30 border-green-900/50 text-green-300"
                : "bg-red-900/30 border-red-900/50 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Account Information Card */}
        <Card className="bg-slate-800/50 border-teal-900/30 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-base sm:text-xl font-bold text-amber-400">Account Information</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 text-teal-300 hover:text-teal-200 text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-700/50 border-teal-900/30 text-white"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Email</label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  type="email"
                  className="bg-slate-700/50 border-teal-900/30 text-white"
                  placeholder="your@email.com"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                  className="flex-1 bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({ name: user.name || "", email: user.email || "" });
                  }}
                  variant="outline"
                  className="flex-1 border-teal-900/30 text-teal-300 hover:bg-teal-900/20"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-400">Name</p>
                <p className="text-sm sm:text-lg text-white font-semibold truncate">{user.name || "Not set"}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Email</p>
                <p className="text-sm sm:text-lg text-white font-semibold truncate">{user.email || "Not set"}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Account Type</p>
                <p className="text-sm sm:text-lg text-amber-400 font-semibold">
                  {user.isPremium ? "Premium" : "Free"}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Change Password Card */}
        <Card className="bg-slate-800/50 border-teal-900/30 p-4 sm:p-6">
          <h2 className="text-base sm:text-xl font-bold text-amber-400 mb-4 sm:mb-6">Change Password</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Current Password</label>
              <div className="relative">
                <Input
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                  }
                  type={showPassword ? "text" : "password"}
                  className="bg-slate-700/50 border-teal-900/30 text-white pr-10"
                  placeholder="Enter current password"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">New Password</label>
              <div className="relative">
                <Input
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  type={showNewPassword ? "text" : "password"}
                  className="bg-slate-700/50 border-teal-900/30 text-white pr-10"
                  placeholder="Enter new password (min 8 characters)"
                />
                <button
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Confirm New Password</label>
              <Input
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                type="password"
                className="bg-slate-700/50 border-teal-900/30 text-white"
                placeholder="Confirm new password"
              />
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={
                changePasswordMutation.isPending ||
                !passwordData.currentPassword ||
                !passwordData.newPassword ||
                !passwordData.confirmPassword
              }
              className="w-full bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold"
            >
              Update Password
            </Button>
          </div>
        </Card>

        {/* Statistics Card */}
        {userStats.data && (
          <Card className="bg-slate-800/50 border-teal-900/30 p-4 sm:p-6">
            <h2 className="text-base sm:text-xl font-bold text-amber-400 mb-4 sm:mb-6">Your Statistics</h2>

            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-slate-400">Total Puzzles</p>
                <p className="text-lg sm:text-2xl font-bold text-amber-400">
                  {userStats.data?.totalPuzzles || 0}
                </p>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-slate-400">Accuracy</p>
                <p className="text-lg sm:text-2xl font-bold text-teal-300">
                  {userStats.data?.accuracy || 0}%
                </p>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-slate-400">Total Cycles</p>
                <p className="text-lg sm:text-2xl font-bold text-amber-400">
                  {userStats.data?.totalCycles || 0}
                </p>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-slate-400">Avg Time/Puzzle</p>
                <p className="text-lg sm:text-2xl font-bold text-teal-300">
                  {userStats.data?.avgTimePerPuzzle || 0}s
                </p>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-slate-400">Win Rate</p>
                <p className="text-lg sm:text-2xl font-bold text-green-400">
                  {userStats.data?.winRate || 0}%
                </p>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-slate-400">Loss Rate</p>
                <p className="text-lg sm:text-2xl font-bold text-red-400">
                  {userStats.data?.lossRate || 0}%
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Danger Zone */}
        <Card className="bg-red-900/20 border-red-900/30 p-4 sm:p-6">
          <h2 className="text-base sm:text-xl font-bold text-red-400 mb-3 sm:mb-4">Danger Zone</h2>
          <p className="text-sm text-slate-400 mb-4">
            Deleting your account is permanent and cannot be undone.
          </p>
          <Button
            variant="destructive"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
          >
            Delete Account
          </Button>
        </Card>
      </div>
    </div>
  );
}
