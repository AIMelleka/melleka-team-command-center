import { useState } from 'react';
import { X, GripVertical, RotateCcw } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAdminEdit, CustomProposalSection } from './AdminEditContext';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SectionReorderPanelProps {
  onClose: () => void;
  navItems: NavItem[];
  customSections: CustomProposalSection[];
  defaultOrder: string[];
  primaryColor?: string;
}

const SortableItem = ({ id, label, icon: Icon, primaryColor }: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; primaryColor: string }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        isDragging
          ? 'shadow-lg border-primary bg-card'
          : 'border-border bg-card/50 hover:bg-card'
      }`}
    >
      <button
        className="touch-none cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
        background: `color-mix(in srgb, ${primaryColor} 12%, transparent)`
      }}>
        <Icon className="w-4 h-4" style={{ color: primaryColor }} />
      </div>
      <span className="text-sm font-medium text-foreground flex-1">{label}</span>
    </div>
  );
};

export const SectionReorderPanel = ({
  onClose,
  navItems,
  customSections,
  defaultOrder,
  primaryColor = '#7c3aed',
}: SectionReorderPanelProps) => {
  const { sectionOrder, setSectionOrder } = useAdminEdit();

  // Build the full ordered list of items (nav + custom sections)
  const allItems: NavItem[] = [
    ...navItems,
    ...customSections.map(cs => ({
      id: cs.id,
      label: cs.title,
      icon: ({ className }: { className?: string }) => <span className={className}>+</span>,
    })),
  ];

  // Use effective order: saved order or default
  const effectiveOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;

  // Sort items by effective order, keeping items not in order at the end
  const getInitialOrder = () => {
    const ordered = [...allItems].sort((a, b) => {
      const aIdx = effectiveOrder.indexOf(a.id);
      const bIdx = effectiveOrder.indexOf(b.id);
      const aPos = aIdx >= 0 ? aIdx : effectiveOrder.length;
      const bPos = bIdx >= 0 ? bIdx : effectiveOrder.length;
      return aPos - bPos;
    });
    return ordered.map(item => item.id);
  };

  const [items, setItems] = useState<string[]>(getInitialOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems(prev => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleApply = () => {
    setSectionOrder(items);
    onClose();
  };

  const handleReset = () => {
    setItems(defaultOrder.filter(id => allItems.some(item => item.id === id)));
  };

  const itemMap = new Map(allItems.map(item => [item.id, item]));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Reorder Sections</h3>
            <p className="text-sm text-muted-foreground">Drag to rearrange section order</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Sortable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              {items.map(id => {
                const item = itemMap.get(id);
                if (!item) return null;
                return (
                  <SortableItem
                    key={id}
                    id={id}
                    label={item.label}
                    icon={item.icon}
                    primaryColor={primaryColor}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              Apply Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
