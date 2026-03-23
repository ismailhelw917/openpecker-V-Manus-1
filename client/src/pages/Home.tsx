import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
// ── cburnett piece URLs (same set used by the main board via chessground) ─────
const CDN = "https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett";
// Map from our piece key → cburnett filename: {color}{TYPE}.svg
// color: 'b' | 'w'   TYPE: P|N|B|R|Q|K
function pieceUrl(color: "w" | "b", type: "P" | "N" | "B" | "R" | "Q" | "K") {
  return `${CDN}/${color}${type}.svg`;
}

// ── Board position ─────────────────────────────────────────────────────────────
// Each value: [color, type]
type PieceData = ["w" | "b", "P" | "N" | "B" | "R" | "Q" | "K"];
const INITIAL_PIECES: Record<string, PieceData> = {
  // Black pieces (rank 8 = row 0)
  "0,0": ["b","R"], "0,2": ["b","B"], "0,3": ["b","Q"], "0,4": ["b","K"], "0,5": ["b","B"], "0,7": ["b","R"],
  "1,0": ["b","P"], "1,1": ["b","P"], "1,2": ["b","P"], "1,4": ["b","P"], "1,5": ["b","P"], "1,6": ["b","P"], "1,7": ["b","P"],
  "2,2": ["b","N"], "2,5": ["b","N"],
  "3,3": ["b","P"],
  // White pieces
  "4,3": ["w","P"], "4,4": ["w","P"],
  "5,2": ["w","N"], "5,5": ["w","N"],
  "6,0": ["w","P"], "6,1": ["w","P"], "6,2": ["w","P"], "6,5": ["w","P"], "6,6": ["w","P"], "6,7": ["w","P"],
  "7,0": ["w","R"], "7,2": ["w","B"], "7,3": ["w","Q"], "7,4": ["w","K"], "7,5": ["w","B"], "7,7": ["w","R"],
};

// Sequence of moves: [fromRow, fromCol, toRow, toCol]
const MOVE_SEQUENCE: [number, number, number, number][] = [
  [5, 5, 3, 4], // Nf3-e5
  [2, 5, 4, 4], // Nf6-e4
  [3, 4, 1, 5], // Ne5xf7 sacrifice
  [0, 4, 1, 5], // Kxf7
  [4, 3, 4, 4], // d5
];

const LIGHT = "#f0d9b5";
const DARK  = "#b58863";

function ChessPreview() {
  const [pieces, setPieces] = useState<Record<string, PieceData>>(() => ({ ...INITIAL_PIECES }));
  const [toSq,   setToSq]   = useState<[number,number] | null>(null);
  const [fromSq, setFromSq] = useState<[number,number] | null>(null);
  const moveIdx = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const [fr, fc, tr, tc] = MOVE_SEQUENCE[moveIdx.current % MOVE_SEQUENCE.length];
      setPieces(prev => {
        const next = { ...prev };
        const piece = next[`${fr},${fc}`];
        if (piece) {
          delete next[`${fr},${fc}`];
          next[`${tr},${tc}`] = piece;
        }
        return next;
      });
      setFromSq([fr, fc]);
      setToSq([tr, tc]);
      moveIdx.current++;
      if (moveIdx.current >= MOVE_SEQUENCE.length) {
        setTimeout(() => {
          setPieces({ ...INITIAL_PIECES });
          setToSq(null);
          setFromSq(null);
          moveIdx.current = 0;
        }, 1800);
      }
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  const SQ = 32;
  const BOARD = SQ * 8;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="rounded-lg overflow-hidden shadow-2xl border border-slate-700"
        style={{ position: "relative", width: BOARD, height: BOARD }}
      >
        {Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => {
            const isLight = (row + col) % 2 === 0;
            const isTo   = toSq   && toSq[0]   === row && toSq[1]   === col;
            const isFrom = fromSq && fromSq[0] === row && fromSq[1] === col;
            const piece  = pieces[`${row},${col}`];
            return (
              <div
                key={`${row}-${col}`}
                style={{
                  position: "absolute",
                  left: col * SQ,
                  top:  row * SQ,
                  width:  SQ,
                  height: SQ,
                  backgroundColor: isTo
                    ? "rgba(20,200,120,0.55)"
                    : isFrom
                    ? "rgba(20,200,120,0.3)"
                    : isLight ? LIGHT : DARK,
                  transition: "background-color 0.3s",
                }}
              >
                {piece && (
                  <img
                    src={pieceUrl(piece[0], piece[1])}
                    alt=""
                    style={{ width: SQ, height: SQ, display: "block", userSelect: "none", pointerEvents: "none" }}
                    draggable={false}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}

// ── Click tracking ─────────────────────────────────────────────────────────────
function trackClick(eventName: string, page: string) {
  try {
    const deviceId = localStorage.getItem("openpecker-device-id") || undefined;
    const body = JSON.stringify({ eventName, eventCategory: "conversion", page, deviceId });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track-event", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track-event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* never break the app */ }
}

// ── Home page ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [premiumNotified, setPremiumNotified] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    if (isAuthenticated && user && !premiumNotified && user.isPremium) {
      toast.success("Welcome! You've been granted FREE lifetime premium!", { duration: 5000 });
      setPremiumNotified(true);
    }
  }, [isAuthenticated, user, premiumNotified]);

  if (loading) {
    return (
      <div className="h-[calc(100dvh-5rem)] bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-slate-950 flex flex-col items-center justify-center px-5 py-6 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-900/20 rounded-full blur-3xl" />
      </div>

      {/* Language selector */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-800 rounded-full px-1 py-1 border border-slate-700 z-10">
        <button
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${language === 'en' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage('hi')}
          className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${language === 'hi' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
        >
          हिं
        </button>
      </div>

      {/* Title — Playfair Display for a classic chess feel */}
      <h1
        className="text-4xl sm:text-5xl font-black text-white mb-1 text-center relative z-10"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em" }}
      >
        OpenPecker
      </h1>

      {/* Subtitle */}
      <p className="text-sm text-slate-400 mb-4 text-center max-w-xs relative z-10">
        {t.appTagline}
      </p>

      {/* Animated chess board */}
      <div className="mb-4 relative z-10">
        <ChessPreview />
      </div>

      {/* Social proof — puzzles only */}
      <div className="flex items-center gap-2 mb-4 flex-wrap justify-center relative z-10">
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-full px-3 py-1.5">
          <span className="text-teal-400 text-sm">♟</span>
          <span className="text-xs font-semibold text-slate-200">4,800,000+ puzzles</span>
        </div>
      </div>

      {/* How it works */}
      <div className="flex items-center gap-2 mb-5 relative z-10">
        {[
          { icon: "📂", label: language === 'hi' ? "ओपनिंग चुनें" : "Pick an opening" },
          { arrow: true },
          { icon: "♟", label: language === 'hi' ? "पज़ल्स हल करें" : "Solve puzzles" },
          { arrow: true },
          { icon: "📈", label: language === 'hi' ? "प्रगति ट्रैक करें" : "Track accuracy" },
        ].map((step, i) =>
          (step as any).arrow ? (
            <span key={i} className="text-slate-600 text-sm font-bold">→</span>
          ) : (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg">
                {(step as any).icon}
              </div>
              <span className="text-[9px] text-slate-500 text-center max-w-[3.5rem] leading-tight">{(step as any).label}</span>
            </div>
          )
        )}
      </div>

      {/* CTAs */}
      <div className="w-full max-w-xs space-y-3 relative z-10">
        <button
          onClick={() => {
            trackClick("start_training_click", "/");
            setLocation("/train");
          }}
          className="w-full bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-lg py-4 rounded-xl transition-colors shadow-lg shadow-teal-900/40"
          style={{ touchAction: "manipulation" }}
        >
          {t.home.startTraining}
        </button>

        <p className="text-center text-slate-500 text-xs">
          {language === 'hi' ? 'शुरू करने के लिए साइन अप की जरूरत नहीं' : 'No sign-up required to start'}
        </p>

        {isAuthenticated ? (
          <p className="text-center text-slate-400 text-sm pt-1">
            {t.home.welcome}{" "}
            <span className="text-teal-400 font-semibold">{user?.name || user?.email}</span>
          </p>
        ) : (
          <a
            href="/auth"
            onClick={() => trackClick("sign_in_click", "/")}
            className="w-full bg-transparent border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
            style={{ touchAction: "manipulation", textDecoration: "none" }}
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            {language === 'hi' ? 'साइन इन / रजिस्टर करें' : 'Sign In / Register'}
          </a>
        )}
      </div>
    </div>
  );
}
