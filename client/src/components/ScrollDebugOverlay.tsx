import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Bug, X, ChevronDown, ChevronUp } from "lucide-react";

interface SectionVisibility {
  id: string;
  ratio: number;
  inViewport: boolean;
  score: number;
  rect: { top: number; bottom: number; height: number };
}

interface ScrollDebugOverlayProps {
  activeSection: string;
  navItems: Array<{ id: string; label: string }>;
  isEnabled?: boolean;
}

export function ScrollDebugOverlay({
  activeSection,
  navItems,
  isEnabled = false,
}: ScrollDebugOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sectionData, setSectionData] = useState<SectionVisibility[]>([]);
  const [scrollInfo, setScrollInfo] = useState({ scrollY: 0, viewportHeight: 0, documentHeight: 0, isNearBottom: false });
  const frameRef = useRef<number>();

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEnabled]);

  // Update section visibility data on scroll
  useEffect(() => {
    if (!visible || !isEnabled) return;

    const updateData = () => {
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollY = window.scrollY;
      const isNearBottom = scrollY + viewportHeight >= documentHeight - 200;

      setScrollInfo({ scrollY, viewportHeight, documentHeight, isNearBottom });

      const data: SectionVisibility[] = [];

      navItems.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          const visibleTop = Math.max(0, rect.top);
          const visibleBottom = Math.min(viewportHeight, rect.bottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const visibilityRatio = visibleHeight / Math.min(rect.height, viewportHeight);
          const positionScore = rect.top >= 0 && rect.top < viewportHeight * 0.5 ? 1 : 0;
          const score = visibilityRatio + positionScore * 0.5;
          const inViewport = visibleHeight > 50;

          data.push({
            id,
            ratio: Math.round(visibilityRatio * 100) / 100,
            inViewport,
            score: Math.round(score * 100) / 100,
            rect: {
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              height: Math.round(rect.height),
            },
          });
        } else {
          data.push({
            id,
            ratio: 0,
            inViewport: false,
            score: 0,
            rect: { top: 0, bottom: 0, height: 0 },
          });
        }
      });

      setSectionData(data);
      frameRef.current = requestAnimationFrame(updateData);
    };

    frameRef.current = requestAnimationFrame(updateData);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [visible, isEnabled, navItems]);

  if (!isEnabled) return null;

  // Floating toggle button
  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 z-[9999] p-3 rounded-full bg-amber-500 text-black shadow-lg hover:bg-amber-400 transition-colors"
        title="Open Scroll Debug (Ctrl+Shift+D)"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[9999] bg-black/95 text-white rounded-xl shadow-2xl border border-amber-500/50 backdrop-blur-sm font-mono text-xs",
        collapsed ? "w-64" : "w-96 max-h-[80vh] overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-amber-500/30 bg-amber-500/10">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-amber-400">Scroll Debug</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-white/10 rounded"
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="p-1 hover:bg-white/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="overflow-y-auto max-h-[60vh]">
          {/* Active Section */}
          <div className="p-3 border-b border-white/10">
            <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Active Section</div>
            <div className="text-lg font-bold text-green-400">{activeSection}</div>
          </div>

          {/* Scroll Info */}
          <div className="p-3 border-b border-white/10 grid grid-cols-2 gap-2">
            <div>
              <div className="text-gray-400 text-[10px]">Scroll Y</div>
              <div className="text-cyan-400">{scrollInfo.scrollY}px</div>
            </div>
            <div>
              <div className="text-gray-400 text-[10px]">Viewport</div>
              <div className="text-cyan-400">{scrollInfo.viewportHeight}px</div>
            </div>
            <div>
              <div className="text-gray-400 text-[10px]">Doc Height</div>
              <div className="text-cyan-400">{scrollInfo.documentHeight}px</div>
            </div>
            <div>
              <div className="text-gray-400 text-[10px]">Near Bottom</div>
              <div className={scrollInfo.isNearBottom ? "text-amber-400" : "text-gray-500"}>
                {scrollInfo.isNearBottom ? "YES" : "no"}
              </div>
            </div>
          </div>

          {/* Section Visibility */}
          <div className="p-3">
            <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-2">
              Section Visibility ({sectionData.length})
            </div>
            <div className="space-y-1">
              {sectionData.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "p-2 rounded border transition-all",
                    s.id === activeSection
                      ? "border-green-500 bg-green-500/10"
                      : s.inViewport
                      ? "border-white/20 bg-white/5"
                      : "border-transparent bg-transparent opacity-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("font-medium", s.id === activeSection && "text-green-400")}>
                      {s.id}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px]",
                        s.inViewport ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-500"
                      )}
                    >
                      {s.inViewport ? "visible" : "hidden"}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                    <span>
                      ratio: <span className="text-cyan-400">{s.ratio}</span>
                    </span>
                    <span>
                      score: <span className="text-purple-400">{s.score}</span>
                    </span>
                    <span>
                      top: <span className="text-yellow-400">{s.rect.top}</span>
                    </span>
                  </div>
                  {/* Visual ratio bar */}
                  <div className="mt-1 h-1 bg-white/10 rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all"
                      style={{ width: `${Math.min(s.ratio * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer hint */}
      <div className="p-2 border-t border-white/10 text-center text-gray-500 text-[10px]">
        Press <kbd className="px-1 py-0.5 bg-white/10 rounded">Ctrl+Shift+D</kbd> to toggle
      </div>
    </div>
  );
}
