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
  const { isEditMode, pendingChanges, updateContent } = useAdminEdit();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Get the current display value (pending changes or original)
  const displayValue = (pendingChanges[path] as string) ?? value;

  useEffect(() => {
    setEditValue(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue !== value) {
      updateContent(path, editValue);
    }
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
    return <Component className={className} style={style}>{displayValue || placeholder}</Component>;
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
      className="group relative inline-block cursor-pointer"
      onClick={() => setIsEditing(true)}
    >
      <Component 
        className={`${className} ${hasChange ? 'ring-2 ring-yellow-400/50 ring-offset-1' : ''}`} 
        style={style}
      >
        {displayValue || <span className="opacity-50">{placeholder}</span>}
      </Component>
      <div className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="w-3.5 h-3.5 text-primary" />
      </div>
    </div>
  );
};
