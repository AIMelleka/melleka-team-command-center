import { createContext, useContext, useState, useRef, ReactNode, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type QAStatus = 'GREEN' | 'YELLOW' | 'RED';

interface HistoryEntry {
  overrides: Record<string, string>;
  hiddenSections: string[];
}

interface DeckEditContextType {
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  overrides: Record<string, string>;
  hiddenSections: string[];
  isSaving: boolean;
  isDirty: boolean;
  dirtyCount: number;
  updateOverride: (key: string, value: string) => void;
  removeOverride: (key: string) => void;
  toggleSection: (sectionId: string) => void;
  isSectionHidden: (sectionId: string) => boolean;
  publishChanges: () => Promise<boolean>;
  discardChanges: () => void;
  deckId: string;
  sectionNotes: Record<string, QAStatus>;
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const DeckEditContext = createContext<DeckEditContextType | null>(null);

export const DeckEditProvider = ({
  children,
  deckId,
  isEditMode,
  setIsEditMode,
  initialOverrides = {},
  initialHiddenSections = [],
  initialSectionNotes = {},
  onPublished,
}: {
  children: ReactNode;
  deckId: string;
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  initialOverrides?: Record<string, string>;
  initialHiddenSections?: string[];
  initialSectionNotes?: Record<string, QAStatus>;
  onPublished?: () => void;
}) => {
  const { toast } = useToast();

  // "Saved" state — what's actually in the DB
  const [savedOverrides, setSavedOverrides] = useState<Record<string, string>>(() => ({ ...initialOverrides }));
  const [savedHiddenSections, setSavedHiddenSections] = useState<string[]>(() => [...initialHiddenSections]);

  // "Working" state — includes local unsaved changes
  const [overrides, setOverrides] = useState<Record<string, string>>(() => ({ ...initialOverrides }));
  const [hiddenSections, setHiddenSections] = useState<string[]>(() => [...initialHiddenSections]);
  const [isSaving, setIsSaving] = useState(false);

  // Track dirty
  const [touchedOverrideKeys, setTouchedOverrideKeys] = useState<Set<string>>(new Set());
  const [hiddenSectionsTouched, setHiddenSectionsTouched] = useState(false);

  const isDirty = touchedOverrideKeys.size > 0 || hiddenSectionsTouched;
  const dirtyCount = touchedOverrideKeys.size + (hiddenSectionsTouched ? 1 : 0);

  // ── Undo/Redo history ─────────────────────────────────────────────────────
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  // Ref to skip pushing to history when applying undo/redo
  const skipHistoryRef = useRef(false);

  const pushHistory = useCallback(() => {
    if (skipHistoryRef.current) return;
    setUndoStack(prev => [...prev.slice(-49), { overrides: { ...overrides }, hiddenSections: [...hiddenSections] }]);
    setRedoStack([]);
  }, [overrides, hiddenSections]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const entry = newStack.pop()!;
      // Push current state to redo
      setRedoStack(r => [...r, { overrides: { ...overrides }, hiddenSections: [...hiddenSections] }]);
      // Apply the undo entry
      skipHistoryRef.current = true;
      setOverrides(entry.overrides);
      setHiddenSections(entry.hiddenSections);
      // Mark dirty
      setTouchedOverrideKeys(new Set(Object.keys(entry.overrides)));
      setHiddenSectionsTouched(true);
      setTimeout(() => { skipHistoryRef.current = false; }, 0);
      return newStack;
    });
  }, [overrides, hiddenSections]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const entry = newStack.pop()!;
      // Push current state to undo
      setUndoStack(u => [...u, { overrides: { ...overrides }, hiddenSections: [...hiddenSections] }]);
      // Apply
      skipHistoryRef.current = true;
      setOverrides(entry.overrides);
      setHiddenSections(entry.hiddenSections);
      setTouchedOverrideKeys(new Set(Object.keys(entry.overrides)));
      setHiddenSectionsTouched(true);
      setTimeout(() => { skipHistoryRef.current = false; }, 0);
      return newStack;
    });
  }, [overrides, hiddenSections]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  // Refs for publish
  const overridesRef = useRef(overrides);
  const hiddenSectionsRef = useRef(hiddenSections);
  const touchedCountRef = useRef(0);
  useEffect(() => { overridesRef.current = overrides; }, [overrides]);
  useEffect(() => { hiddenSectionsRef.current = hiddenSections; }, [hiddenSections]);
  useEffect(() => { touchedCountRef.current = touchedOverrideKeys.size; }, [touchedOverrideKeys]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Local-only mutations ──────────────────────────────────────────────────
  const updateOverride = useCallback((key: string, value: string) => {
    pushHistory();
    setOverrides(prev => ({ ...prev, [key]: value }));
    setTouchedOverrideKeys(prev => new Set(prev).add(key));
  }, [pushHistory]);

  const removeOverride = useCallback((key: string) => {
    pushHistory();
    setOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setTouchedOverrideKeys(prev => new Set(prev).add(key));
  }, [pushHistory]);

  const toggleSection = useCallback((sectionId: string) => {
    pushHistory();
    setHiddenSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
    setHiddenSectionsTouched(true);
  }, [pushHistory]);

  const isSectionHidden = useCallback((sectionId: string) => {
    return hiddenSections.includes(sectionId);
  }, [hiddenSections]);

  // ── Keyboard shortcuts for undo/redo ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isEditMode) return;
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (isMod && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditMode, undo, redo]);

  // ── Atomic publish ────────────────────────────────────────────────────────
  const publishChanges = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('decks')
        .select('content')
        .eq('id', deckId)
        .single();

      if (error) throw error;

      const current = (data?.content as Record<string, unknown>) || {};
      const currentOverrides = overridesRef.current;
      const currentHidden = hiddenSectionsRef.current;
      const merged = {
        ...current,
        overrides: { ...currentOverrides },
        hiddenSections: [...currentHidden],
      };

      const { error: updateError } = await supabase
        .from('decks')
        .update({ content: merged as any, updated_at: new Date().toISOString() })
        .eq('id', deckId);

      if (updateError) throw updateError;

      const editCount = touchedCountRef.current;
      setSavedOverrides({ ...currentOverrides });
      setSavedHiddenSections([...currentHidden]);

      setTouchedOverrideKeys(new Set());
      setHiddenSectionsTouched(false);
      // Clear undo/redo after publish
      setUndoStack([]);
      setRedoStack([]);

      onPublished?.();
      toast({ title: '✅ All changes saved!', description: `${editCount} edit(s) published successfully.` });
      return true;
    } catch (err) {
      console.error('Failed to publish deck changes:', err);
      toast({
        title: 'Save failed',
        description: 'Your changes could not be saved. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [deckId, toast, onPublished]);

  // ── Discard local changes ─────────────────────────────────────────────────
  const discardChanges = useCallback(() => {
    setOverrides({ ...savedOverrides });
    setHiddenSections([...savedHiddenSections]);
    setTouchedOverrideKeys(new Set());
    setHiddenSectionsTouched(false);
    setUndoStack([]);
    setRedoStack([]);
    toast({ title: 'Changes discarded' });
  }, [savedOverrides, savedHiddenSections, toast]);

  return (
    <DeckEditContext.Provider value={{
      isEditMode, setIsEditMode,
      overrides, hiddenSections, isSaving,
      isDirty, dirtyCount,
      updateOverride, removeOverride, toggleSection, isSectionHidden,
      publishChanges, discardChanges,
      deckId,
      sectionNotes: initialSectionNotes,
      undo, redo, canUndo, canRedo,
    }}>
      {children}
    </DeckEditContext.Provider>
  );
};

export const useDeckEdit = () => {
  const ctx = useContext(DeckEditContext);
  if (!ctx) throw new Error('useDeckEdit must be used within DeckEditProvider');
  return ctx;
};
