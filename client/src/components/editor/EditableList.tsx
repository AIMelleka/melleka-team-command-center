import { useState } from 'react';
import { useAdminEdit } from './AdminEditContext';
import { X, Plus, Pencil, Check } from 'lucide-react';

interface EditableListProps {
  items: string[];
  basePath: string;
  renderItem?: (item: string, index: number) => React.ReactNode;
  addLabel?: string;
  className?: string;
  itemClassName?: string;
}

export const EditableList = ({
  items,
  basePath,
  renderItem,
  addLabel = 'Add item',
  className = '',
  itemClassName = ''
}: EditableListProps) => {
  const { isEditMode, pendingChanges, updateContent } = useAdminEdit();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  // Get current items (pending changes or original)
  const currentItems = (pendingChanges[basePath] as string[]) ?? items;

  const handleDelete = (index: number) => {
    const updated = currentItems.filter((_, i) => i !== index);
    updateContent(basePath, updated);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(currentItems[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const updated = [...currentItems];
    updated[editingIndex] = editValue;
    updateContent(basePath, updated);
    setEditingIndex(null);
    setEditValue('');
  };

  const handleAdd = () => {
    if (!newValue.trim()) return;
    const updated = [...currentItems, newValue.trim()];
    updateContent(basePath, updated);
    setNewValue('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: 'edit' | 'add') => {
    if (e.key === 'Enter') {
      action === 'edit' ? handleSaveEdit() : handleAdd();
    }
    if (e.key === 'Escape') {
      if (action === 'edit') {
        setEditingIndex(null);
        setEditValue('');
      } else {
        setIsAdding(false);
        setNewValue('');
      }
    }
  };

  if (!isEditMode) {
    return (
      <div className={className}>
        {currentItems.map((item, i) => (
          <div key={i} className={itemClassName}>
            {renderItem ? renderItem(item, i) : item}
          </div>
        ))}
      </div>
    );
  }

  const hasChange = basePath in pendingChanges;

  return (
    <div className={`${className} ${hasChange ? 'ring-2 ring-yellow-400/50 ring-offset-1 rounded-lg' : ''}`}>
      {currentItems.map((item, i) => (
        <div key={i} className={`group/item relative flex items-center gap-2 ${itemClassName}`}>
          {editingIndex === i ? (
            <div className="flex-1 flex items-center gap-1">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'edit')}
                className="flex-1 bg-white/10 border border-primary/50 rounded px-2 py-1 text-sm outline-none focus:border-primary"
                autoFocus
              />
              <button
                onClick={handleSaveEdit}
                className="p-1 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                title="Save"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={() => { setEditingIndex(null); setEditValue(''); }}
                className="p-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1">
                {renderItem ? renderItem(item, i) : item}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(i)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3 h-3 text-primary" />
                </button>
                <button
                  onClick={() => handleDelete(i)}
                  className="p-1 rounded hover:bg-destructive/10 transition-colors"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      {isAdding ? (
        <div className="flex items-center gap-1 mt-2">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'add')}
            placeholder="Enter new item..."
            className="flex-1 bg-white/10 border border-primary/50 rounded px-2 py-1 text-sm outline-none focus:border-primary"
            autoFocus
          />
          <button
            onClick={handleAdd}
            className="p-1 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
            title="Add"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={() => { setIsAdding(false); setNewValue(''); }}
            className="p-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
            title="Cancel"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors border border-dashed border-primary/30"
        >
          <Plus className="w-3 h-3" />
          {addLabel}
        </button>
      )}
    </div>
  );
};
