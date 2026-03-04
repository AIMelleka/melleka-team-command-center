import { useState, useRef, useEffect, useCallback } from 'react';
import { useDeckEdit } from './DeckEditContext';
import type { QAStatus } from './DeckEditContext';
import { Pencil, Check, X, Eye, EyeOff, Upload, Trash2, Sparkles, Loader2, Plus, LayoutTemplate, RotateCcw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AddSectionModal } from './AddSectionModal';
import { useToast } from '@/hooks/use-toast';

// ─── QA Status Badge ──────────────────────────────────────────────────────────
const QA_CONFIG: Record<QAStatus, { dot: string; label: string; title: string }> = {
  GREEN:  { dot: 'bg-emerald-400', label: 'text-emerald-400', title: 'QA: Good to go' },
  YELLOW: { dot: 'bg-yellow-400',  label: 'text-yellow-400',  title: 'QA: Needs review' },
  RED:    { dot: 'bg-red-400',     label: 'text-red-400',     title: 'QA: Action required' },
};

const QABadge = ({ status }: { status?: QAStatus }) => {
  if (!status) return null;
  const { dot, label, title } = QA_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${label} opacity-90`} title={title}>
      <span className={`w-2 h-2 rounded-full ${dot} animate-pulse`} />
      {status}
    </span>
  );
};

// ─── Inline editable text ─────────────────────────────────────────────────────
interface InlineEditProps {
  value: string;
  editKey: string;
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'div' | 'li';
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
}

export const InlineEdit = ({
  value,
  editKey,
  as: Tag = 'span',
  className = '',
  style,
  multiline = false,
}: InlineEditProps) => {
  const { isEditMode, overrides, updateOverride, removeOverride, isSaving } = useDeckEdit();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const display = overrides[editKey] ?? value;

  useEffect(() => {
    if (editing) {
      setDraft(display);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing]);

  const save = async () => {
    const current = overrides[editKey] ?? value;
    if (draft !== current) {
      await updateOverride(editKey, draft);
    }
    setEditing(false);
  };

  const cancel = () => { setEditing(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancel();
  };

  if (!isEditMode) {
    return <Tag className={className} style={style}>{display}</Tag>;
  }

  if (editing) {
    const baseClass = `bg-black/60 border border-yellow-400/80 rounded px-2 py-1 outline-none focus:border-yellow-400 text-white resize-none w-full ${className}`;
    return (
      <span className="inline-flex flex-col gap-1 w-full">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKey}
            className={`${baseClass} min-h-[80px]`}
            style={style}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKey}
            className={baseClass}
            style={style}
          />
        )}
        <span className="flex gap-1 self-start">
          <button onClick={save} disabled={isSaving} className="p-1 rounded bg-green-500 hover:bg-green-600 text-white transition-colors" title="Save (Enter)">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={cancel} className="p-1 rounded bg-red-500 hover:bg-red-600 text-white transition-colors" title="Cancel (Esc)">
            <X className="w-3 h-3" />
          </button>
        </span>
      </span>
    );
  }

  const isEdited = editKey in overrides;
  const isEmpty = !display;

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeOverride(editKey);
  };

  return (
    <span className="group/inline relative inline-flex items-baseline gap-0.5 cursor-text">
      <span onClick={() => setEditing(true)} title="Click to edit">
        {isEmpty ? (
          <span
            className={`${className} italic text-white/30 hover:outline hover:outline-2 hover:outline-yellow-400/30 rounded px-1`}
            style={style}
          >
            Click to add text…
          </span>
        ) : (
          <Tag
            className={`${className} ${isEdited ? 'outline outline-2 outline-yellow-400/50 rounded' : 'hover:outline hover:outline-2 hover:outline-yellow-400/30 rounded'}`}
            style={style}
          >
            {display}
          </Tag>
        )}
      </span>
      {/* Pencil icon — always on hover */}
      {!isEdited && (
        <Pencil className="inline-block w-3 h-3 text-yellow-400 opacity-0 group-hover/inline:opacity-100 transition-opacity flex-shrink-0" />
      )}
      {/* Reset icon — only on edited fields */}
      {isEdited && (
        <button
          onClick={handleReset}
          title="Reset to AI original"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400/20 hover:bg-red-500/30 border border-yellow-400/40 hover:border-red-400/60 text-yellow-400 hover:text-red-400 opacity-0 group-hover/inline:opacity-100 transition-all duration-150 flex-shrink-0"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
};

// ─── Section visibility toggle wrapper with full edit toolbar ─────────────────
interface SectionToggleProps {
  sectionId: string;
  label: string;
  children: React.ReactNode;
  className?: string;
  // Optional: supply deckId + assetKey for image upload within this section
  deckId?: string;
  assetKey?: string;
  // Optional: AI rewrite prompt context
  aiContext?: string;
  // Optional: allow adding custom items (e.g. bullet points)
  onAddItem?: () => void;
  /** Show the "Add Section" button in the toolbar */
  allowAddSection?: boolean;
  /** If true, skip auto-rendering uploaded images (caller handles it) */
  suppressImages?: boolean;
}

export const SectionToggle = ({
  sectionId,
  label,
  children,
  className,
  deckId,
  assetKey,
  aiContext,
  onAddItem,
  allowAddSection = false,
  suppressImages = false,
}: SectionToggleProps) => {
  const { isEditMode, isSectionHidden, toggleSection, updateOverride, removeOverride, overrides, sectionNotes } = useDeckEdit();
  const { toast } = useToast();
  const hidden = isSectionHidden(sectionId);
  const [isAiWriting, setIsAiWriting] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteSection = useCallback(async () => {
    if (!deckId) return;
    // Hide the section
    if (!hidden) toggleSection(sectionId);
    
    // Clear section overrides (images, AI rewrites, etc.)
    const keysToRemove = Object.keys(overrides).filter(k => k.startsWith(`${sectionId}.`));
    for (const key of keysToRemove) {
      removeOverride(key);
    }

    // Clear campaign assets for this section if assetKey is provided
    if (assetKey) {
      try {
        const { data } = await supabase.from('decks').select('content').eq('id', deckId).single();
        if (data?.content) {
          const content = data.content as Record<string, any>;
          const campaignAssets = { ...(content.campaignAssets || {}) };
          if (campaignAssets[assetKey]) {
            delete campaignAssets[assetKey];
          }
          // Also clear related details (e.g. nextEmailDetails for next-email-campaign)
          const updatedContent: Record<string, any> = { ...content, campaignAssets };
          if (sectionId === 'next-email-campaign') delete updatedContent.nextEmailDetails;
          
          await supabase.from('decks').update({ content: updatedContent as any, updated_at: new Date().toISOString() }).eq('id', deckId);
        }
      } catch (err) {
        console.error('Failed to clear section assets:', err);
      }
    }

    setShowDeleteConfirm(false);
    toast({ title: `"${label}" section deleted` });
  }, [deckId, sectionId, assetKey, label, hidden, toggleSection, overrides, removeOverride, toast]);
  const uploadingRef = useRef(false);
  // Keep a ref to overrides so the upload callback never reads stale state
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !deckId || !assetKey) return;
    // Guard against duplicate invocations (drag+change race)
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setIsUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const fileExt = file.name.split('.').pop();
      const fileName = `deck-assets/${deckId}/${assetKey}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
      try {
        const { error } = await supabase.storage.from('proposal-assets').upload(fileName, file, { cacheControl: '3600', upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('proposal-assets').getPublicUrl(fileName);
        newUrls.push(data.publicUrl);
      } catch (err) {
        console.error('Upload error:', err);
      }
    }

    if (newUrls.length > 0) {
      // Read latest overrides via ref to avoid stale closure
      const existingKey = `${sectionId}.images`;
      const existing: string[] = JSON.parse(overridesRef.current[existingKey] || '[]');
      // Deduplicate by URL
      const merged = [...existing, ...newUrls.filter(u => !existing.includes(u))];
      updateOverride(existingKey, JSON.stringify(merged));
      toast({ title: `${newUrls.length} image(s) uploaded!` });
    }
    setIsUploading(false);
    uploadingRef.current = false;
  }, [deckId, assetKey, sectionId, updateOverride, toast]);

  const handleAiRewrite = useCallback(async () => {
    if (!aiContext && !aiPrompt.trim()) return;
    setIsAiWriting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deck-section-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          sectionId,
          currentContent: aiContext || '',
          instruction: aiPrompt.trim() || 'Rewrite this section to be more compelling and client-friendly.',
        }),
      });
      const result = await response.json();
      if (result.rewritten) {
        await updateOverride(`${sectionId}.aiRewrite`, result.rewritten);
        toast({ title: '✨ AI rewrite applied!', description: 'Content has been updated.' });
        setShowAiPanel(false);
        setAiPrompt('');
      } else {
        throw new Error(result.error || 'No output');
      }
    } catch (err) {
      toast({ title: 'AI rewrite failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsAiWriting(false);
    }
  }, [aiContext, aiPrompt, sectionId, updateOverride, toast]);

  if (!isEditMode) {
    if (hidden) return null;
    // Render children + any uploaded section images (stored in overrides)
    const sectionImagesKey = `${sectionId}.images`;
    const sectionImgs: string[] = (() => {
      try { return JSON.parse(overrides[sectionImagesKey] || '[]'); }
      catch { return []; }
    })();
    return (
      <>
        {children}
        {!suppressImages && sectionImgs.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 px-8">
            {sectionImgs.map((url, i) => (
              <img key={i} src={url} alt={`${label} ${i + 1}`} className="w-full rounded-xl shadow-lg" />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`relative ${className || ''}`}>
      {/* ─── Edit toolbar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 flex items-center gap-1.5 px-3 py-2 mb-1 rounded-xl border border-yellow-400/30 bg-black/70 backdrop-blur-xl text-xs text-yellow-300 font-medium shadow-lg">
        <span className="flex-1 truncate text-yellow-200/80 font-semibold flex items-center gap-2">
          {label}
          <QABadge status={sectionNotes[sectionId] as QAStatus | undefined} />
        </span>

        {/* Upload image */}
        {(deckId && assetKey) && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleImageUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-400/30 transition-colors"
              title="Upload image to this section"
            >
              {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Upload
            </button>
          </>
        )}

        {/* Add item */}
        {onAddItem && (
          <button
            onClick={onAddItem}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-400/30 transition-colors"
            title="Add item to this section"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}

        {/* Add Section */}
        {allowAddSection && (
          <button
            onClick={() => setShowAddSection(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-400/30 transition-colors"
            title="Insert a new section after this one"
          >
            <LayoutTemplate className="w-3 h-3" />
            Add Section
          </button>
        )}

        {/* AI Rewrite */}
        <button
          onClick={() => setShowAiPanel(v => !v)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors ${showAiPanel ? 'bg-purple-500/30 border-purple-400/50 text-purple-200' : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-400/30'}`}
          title="Use AI to rewrite this section"
        >
          <Sparkles className="w-3 h-3" />
          AI Write
        </button>

        {/* Delete / Hide section */}
        <button
          onClick={() => toggleSection(sectionId)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors ${hidden ? 'bg-yellow-400/30 hover:bg-yellow-400/50 border-yellow-400/40' : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-400/30'}`}
          title={hidden ? 'Show section' : 'Hide section from client'}
        >
          {hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {hidden ? 'Show' : 'Hide'}
        </button>

        {/* Delete section */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 transition-colors"
          title="Delete this entire section"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>

      {/* ─── Delete Confirmation Modal ─────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Section</h3>
            </div>
            <p className="text-white/70 text-sm mb-6">
              Are you sure you want to delete <span className="font-semibold text-white">"{label}"</span>? This will remove all content and uploaded images for this section.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSection}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                Delete Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Section Modal ─────────────────────────────────────────────── */}
      {showAddSection && (
        <AddSectionModal
          insertAfterSectionId={sectionId}
          onClose={() => setShowAddSection(false)}
        />
      )}

      {/* ─── AI Rewrite panel ─────────────────────────────────────────────── */}
      {showAiPanel && (
        <div className="mb-2 p-3 rounded-xl bg-purple-900/40 border border-purple-400/30 backdrop-blur-xl space-y-2">
          <p className="text-xs text-purple-300 font-medium">✨ AI will rewrite the content of <span className="text-white">{label}</span></p>
          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="Optional: Give AI instructions (e.g. 'Make it more concise', 'Focus on ROI wins', 'Keep it under 3 sentences')"
            className="w-full bg-black/40 border border-purple-400/40 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-purple-400 resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAiRewrite}
              disabled={isAiWriting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isAiWriting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {isAiWriting ? 'Writing...' : 'Rewrite with AI'}
            </button>
            <button
              onClick={() => { setShowAiPanel(false); setAiPrompt(''); }}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
          {/* Show AI rewrite result if available */}
          {overrides[`${sectionId}.aiRewrite`] && (
            <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-white/50 mb-1">AI rewritten content (saved):</p>
              <p className="text-sm text-white/80">{overrides[`${sectionId}.aiRewrite`]}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Section content ──────────────────────────────────────────────── */}
      <div className={`transition-opacity duration-200 ${hidden ? 'opacity-30 pointer-events-none select-none' : ''}`}>
        {children}
      </div>

      {/* ─── Uploaded images display ──────────────────────────────────────── */}
      {overrides[`${sectionId}.images`] && (() => {
        const imgs: string[] = JSON.parse(overrides[`${sectionId}.images`] || '[]');
        if (!imgs.length) return null;
        return (
          <div className="mt-6 px-8">
            <div className="max-w-6xl mx-auto">
              {isEditMode && <p className="text-xs text-white/40 mb-3">Uploaded images for this section:</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {imgs.map((url, i) => (
                  <div key={i} className="relative group rounded-2xl overflow-hidden border border-white/10 bg-black/30">
                    {isEditMode && (
                      <button
                        onClick={async () => {
                          const updated = imgs.filter((_, idx) => idx !== i);
                          await updateOverride(`${sectionId}.images`, JSON.stringify(updated));
                        }}
                        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <img src={url} alt={`Upload ${i + 1}`} className="w-full object-contain rounded-2xl" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
