import { useState, useRef, useEffect } from 'react';
import { useAdminEdit } from './AdminEditContext';
import { Pencil, Check, X } from 'lucide-react';

interface EditableTextProps {
  value: string;
  path: string;
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div';
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
}

export const EditableText = ({
  value,
  path,
  as: Component = 'span',
  className = '',
  style,
  multiline = false,
  placeholder = 'Click to edit...'
}: EditableTextProps) => {
  const { isEditMode, pendingChanges, savedOverrides, contentData, updateContent } = useAdminEdit();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Resolve dot-path against contentData (e.g. "hero.title" → contentData.hero.title)
  const resolveContentPath = (): string | undefined => {
    const keys = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = contentData;
    for (const key of keys) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return typeof current === 'string' ? current : undefined;
  };

  // Priority: pending changes → saved overrides → DB content → hardcoded prop default
  // Safely coerce to string — proposal JSON may contain objects for fields expected to be strings
  const contentValue = resolveContentPath();
  const rawValue = (pendingChanges[path] as string) ?? (savedOverrides[path] as string) ?? contentValue ?? value;
  const displayValue = (typeof rawValue === 'string') ? rawValue : (rawValue == null ? '' : String(rawValue));

  useEffect(() => {
    // Only sync when NOT actively editing — prevents overwriting user's in-progress typing
    if (!isEditing) {
      setEditValue(displayValue);
    }
  }, [displayValue, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    // Always persist the edit — comparing against the prop `value` could miss
    // cases where the display comes from savedOverrides or pendingChanges
    updateContent(path, editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(displayValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditMode) {
    return <Component className={className} style={style}>{displayValue}</Component>;
  }

  if (isEditing) {
    const inputClassName = `w-full bg-white/10 border border-primary/50 rounded px-2 py-1 outline-none focus:border-primary ${className}`;
    
    return (
      <div className="relative inline-flex items-center gap-1 w-full">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`${inputClassName} min-h-[80px] resize-y`}
            style={style}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClassName}
            style={style}
          />
        )}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={handleSave}
            className="p-1 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
            title="Save"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
            title="Cancel"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  const hasChange = path in pendingChanges;

  return (
    <div
      className={`group relative inline cursor-pointer rounded transition-all duration-200 hover:outline hover:outline-2 hover:outline-dashed hover:outline-blue-400/60 hover:bg-blue-400/5 ${hasChange ? 'ring-2 ring-yellow-400/50 ring-offset-1' : ''}`}
      onClick={() => setIsEditing(true)}
      title="Click to edit"
    >
      <Component
        className={className}
        style={style}
      >
        {displayValue || <span className="opacity-50">{placeholder}</span>}
        <Pencil className="w-3 h-3 text-blue-400 inline-block ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity align-middle" />
      </Component>
    </div>
  );
};
