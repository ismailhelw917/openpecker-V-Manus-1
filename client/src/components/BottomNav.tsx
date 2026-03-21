import { Home, Play, BookOpen, Trophy, BarChart3, Settings } from "lucide-react";
import { useLocation } from "wouter";

export default function BottomNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { icon: Home, label: "HOME", path: "/" },
    { icon: Play, label: "TRAIN", path: "/train" },
    { icon: BookOpen, label: "SETS", path: "/sets" },
    { icon: Trophy, label: "RANK", path: "/leaderboard" },
    { icon: BarChart3, label: "STATS", path: "/stats" },
    { icon: Settings, label: "MORE", path: "/settings" },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div className="flex items-center h-16 sm:h-20 max-w-screen-xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex-1 flex flex-col items-center justify-center h-full transition-colors select-none min-w-0 ${
                isActive ? "text-amber-400" : "text-slate-400 hover:text-slate-300"
              }`}
              style={{
                touchAction: "manipulation",
                WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
              }}
            >
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 shrink-0" />
              <span className="text-[9px] sm:text-xs font-semibold truncate max-w-full px-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
