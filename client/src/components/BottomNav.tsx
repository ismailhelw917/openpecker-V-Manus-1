import { Home, Play, BookOpen, BarChart3, Settings } from "lucide-react";
import { useLocation } from "wouter";

export default function BottomNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { icon: Home, label: "HOME", path: "/" },
    { icon: Play, label: "TRAIN", path: "/train" },
    { icon: BookOpen, label: "SETS", path: "/sets" },
    { icon: BarChart3, label: "STATS", path: "/stats" },
    { icon: Settings, label: "SETTINGS", path: "/settings" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-20 max-w-screen-xl mx-auto pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center justify-center w-16 h-20 transition-colors ${
                isActive ? "text-amber-400" : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
