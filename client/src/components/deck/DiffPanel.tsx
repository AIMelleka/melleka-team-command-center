import { useState } from 'react';
import { useDeckEdit } from './DeckEditContext';
import { RotateCcw, ChevronDown, ChevronUp, GitCompare, Eye, EyeOff } from 'lucide-react';

// ─── Key → human-readable label ───────────────────────────────────────────────
function labelForKey(key: string): string {
  if (key === 'cover.subtitle') return 'Cover › Subtitle';
  if (key === 'cover.clientName') return 'Cover › Client Name';
  if (key === 'cover.logo') return 'Cover › Client Logo';
  if (key === 'hero.executiveSummary') return 'Executive Summary › Body Text';
  if (key === 'hero.headline') return 'Hero › Headline';

  const platformMetric = key.match(/^platform-(.+?)\.metric\.(.+)$/);
  if (platformMetric) {
    const platform = platformMetric[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const metric = platformMetric[2].replace(/([A-Z])/g, ' $1').replace(/\b\w/g, c => c.toUpperCase());
    return `${platform} › ${metric}`;
  }
  const platformLabel = key.match(/^platform-(.+?)\.label$/);
  if (platformLabel) return `${platformLabel[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} › Section Title`;
  const platformImage = key.match(/^platform-(.+?)\.sectionImage$/);
  if (platformImage) return `${platformImage[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} › Section Image`;

  const platformGameplan = key.match(/^platform-(.+?)\.gameplan\.(.+)$/);
  if (platformGameplan) {
    const p = platformGameplan[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const f = platformGameplan[2].replace(/\./g, ' › ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, c => c.toUpperCase());
    return `${p} › Gameplan › ${f}`;
  }
  const heroKeyWin = key.match(/^hero\.keyWins\.(\d+)$/);
  if (heroKeyWin) return `Executive Summary › Key Win #${parseInt(heroKeyWin[1]) + 1}`;
  const heroChallenge = key.match(/^hero\.challenges\.(\d+)$/);
  if (heroChallenge) return `Executive Summary › Challenge #${parseInt(heroChallenge[1]) + 1}`;

  const nextRec = key.match(/^next-steps\.rec\.(\d+)\.(.+)$/);
  if (nextRec) return `Recommendation #${parseInt(nextRec[1]) + 1} › ${nextRec[2].replace(/([A-Z])/g, ' $1').replace(/\b\w/g, c => c.toUpperCase())}`;

  const sectionHeader = key.match(/^([a-zA-Z-]+)\.(title|subtitle)$/);
  if (sectionHeader) {
    const s = sectionHeader[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `${s} › ${sectionHeader[2].charAt(0).toUpperCase() + sectionHeader[2].slice(1)}`;
  }
  const sectionBullet = key.match(/^([a-zA-Z-]+)\.([a-zA-Z]+)\.(\d+)$/);
  if (sectionBullet) {
    const s = sectionBullet[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const f = sectionBullet[2].replace(/([A-Z])/g, ' $1').replace(/\b\w/g, c => c.toUpperCase());
    return `${s} › ${f} #${parseInt(sectionBullet[3]) + 1}`;
  }
  const customMatch = key.match(/^custom-([a-z0-9]+)\.(.+)$/i);
  if (customMatch) return `Custom Section › ${customMatch[2].replace(/([A-Z])/g, ' $1').replace(/\b\w/g, c => c.toUpperCase())}`;

  const sectionField = key.match(/^([a-zA-Z]+)\.([a-zA-Z.]+)$/);
  if (sectionField) {
    const s = sectionField[1].replace(/([A-Z])/g, ' $1').replace(/\b\w/g, c => c.toUpperCase());
    const f = sectionField[2].replace(/\./g, ' › ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, c => c.toUpperCase());
    return `${s} › ${f}`;
  }
  if (key.startsWith('deck.')) return key.replace('deck.', 'Deck › ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, c => c.toUpperCase());
  return key;
}

// Truncate long values for display
function truncate(val: string, max = 80): string {
  if (!val) return '(empty)';
  if (val.length <= max) return val;
  return val.slice(0, max) + '…';
}

// Try to extract original value from deck content for a given override key
function getOriginalValue(key: string, deckContent: Record<string, any>): string | null {
  try {
    // Platform metric: platform-google_ads_v1.metric.spend
    const platformMetric = key.match(/^platform-(.+?)\.metric\.(.+)$/);
    if (platformMetric) {
      const platformKey = platformMetric[1];
      const metricKey = platformMetric[2];
      const platforms: any[] = deckContent?.adPlatforms || [];
      const platform = platforms.find((p: any) => p.key === platformKey);
      if (platform && metricKey in platform) return String(platform[metricKey]);
    }

    // Section.field: e.g. hero.executiveSummary, googleAds.spend
    const sectionField = key.match(/^([a-zA-Z]+)\.([a-zA-Z]+)$/);
    if (sectionField) {
      const section = deckContent?.[sectionField[1]];
      if (section && sectionField[2] in section) return String(section[sectionField[2]]);
    }

    // aiRewrite keys: sectionId.aiRewrite
    if (key.endsWith('.aiRewrite')) return null;

    // images, title, content for custom sections — no original
    return null;
  } catch {
    return null;
  }
}

// ─── DiffPanel component ──────────────────────────────────────────────────────
interface DiffPanelProps {
  deckContent: Record<string, any>;
}

export const DiffPanel = ({ deckContent }: DiffPanelProps) => {
  const { overrides, hiddenSections, removeOverride, toggleSection, isEditMode } = useDeckEdit();
  const [collapsed, setCollapsed] = useState(false);

  if (!isEditMode) return null;

  const overrideEntries = Object.entries(overrides).filter(([key]) => key !== 'deck.customSections' && !key.endsWith('.customMetrics'));
  const customMetricsCount = Object.entries(overrides)
    .filter(([key]) => key.endsWith('.customMetrics'))
    .reduce((acc, [, val]) => { try { return acc + JSON.parse(val).length; } catch { return acc; } }, 0);
  const hasChanges = overrideEntries.length > 0 || hiddenSections.length > 0 || customMetricsCount > 0;
  if (!hasChanges) return null;

  const totalChanges = overrideEntries.length + hiddenSections.length + customMetricsCount;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] max-h-[70vh] flex flex-col rounded-2xl border border-yellow-400/30 bg-black/90 backdrop-blur-2xl shadow-2xl text-xs">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b border-yellow-400/20"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-2 text-yellow-300 font-semibold">
          <GitCompare className="h-3.5 w-3.5" />
          <span>Edit Diff</span>
          <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200 font-bold">
            {totalChanges}
          </span>
        </div>
        <button className="text-yellow-300/60 hover:text-yellow-300 transition-colors">
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="overflow-y-auto flex-1 divide-y divide-white/5">
          {/* Hidden sections */}
          {hiddenSections.map(sectionId => (
            <div key={sectionId} className="flex items-center gap-3 px-4 py-3">
              <EyeOff className="h-3 w-3 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-[10px] uppercase tracking-wide mb-0.5">Hidden Section</p>
                <p className="text-white/80 font-medium truncate">{sectionId}</p>
              </div>
              <button
                onClick={() => toggleSection(sectionId)}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border border-yellow-400/20 transition-colors"
                title="Restore section"
              >
                <Eye className="h-3 w-3" />
                Restore
              </button>
            </div>
          ))}

          {/* Overrides */}
          {overrideEntries.map(([key, newValue]) => {
            const originalValue = getOriginalValue(key, deckContent);
            const label = labelForKey(key);
            const isImageKey = key.endsWith('.images');
            const isSingleImageKey = key.endsWith('Image') || key.endsWith('Logo') || key.endsWith('.logo');
            const isAiKey = key.endsWith('.aiRewrite');

            return (
              <div key={key} className="px-4 py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white/40 text-[10px] uppercase tracking-wide leading-tight flex-1 min-w-0 truncate">
                    {label}
                  </p>
                  <button
                    onClick={() => removeOverride(key)}
                    className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 transition-colors"
                    title="Revert to original"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Revert
                  </button>
                </div>

                {isSingleImageKey ? (
                  <div className="flex items-center gap-3">
                    <img src={newValue} alt="" className="h-16 w-24 object-contain rounded-lg border border-white/10 bg-white/5" />
                    <span className="text-white/40 text-[10px] italic">Image uploaded</span>
                  </div>
                ) : isImageKey ? (
                  (() => {
                    const urls: string[] = (() => { try { return JSON.parse(newValue); } catch { return []; } })();
                    return (
                      <div className="flex gap-1.5 flex-wrap">
                        {urls.map((url, i) => (
                          <img key={i} src={url} alt="" className="h-10 w-16 object-cover rounded-md border border-white/10" />
                        ))}
                        {!urls.length && <span className="text-white/30 italic">No images</span>}
                      </div>
                    );
                  })()
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {originalValue !== null ? (
                      <div className="rounded-lg px-2.5 py-1.5 bg-red-900/20 border border-red-500/20">
                        <p className="text-[9px] text-red-400/70 mb-0.5 uppercase tracking-wide">Original</p>
                        <p className="text-red-300/80 line-through text-[11px] leading-snug break-words">
                          {truncate(originalValue)}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg px-2.5 py-1.5 bg-white/5 border border-white/10 flex items-center justify-center">
                        <p className="text-white/20 italic text-[10px]">
                          {isAiKey ? 'AI generated' : 'Custom addition'}
                        </p>
                      </div>
                    )}
                    <div className="rounded-lg px-2.5 py-1.5 bg-green-900/20 border border-green-500/20">
                      <p className="text-[9px] text-green-400/70 mb-0.5 uppercase tracking-wide">Edited</p>
                      <p className="text-green-300 text-[11px] leading-snug break-words">
                        {truncate(newValue)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {!collapsed && overrideEntries.length > 0 && (
        <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
          <span className="text-white/30">{overrideEntries.length} text edit{overrideEntries.length !== 1 ? 's' : ''}{customMetricsCount > 0 ? `, ${customMetricsCount} custom metric${customMetricsCount !== 1 ? 's' : ''}` : ''}, {hiddenSections.length} hidden</span>
          <button
            onClick={async () => {
              if (!confirm('Revert ALL manual edits and restore all hidden sections?')) return;
              for (const [key] of overrideEntries) await removeOverride(key);
              for (const id of [...hiddenSections]) await toggleSection(id);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-400/20 transition-colors font-medium"
          >
            <RotateCcw className="h-3 w-3" />
            Revert All
          </button>
        </div>
      )}
    </div>
  );
};
