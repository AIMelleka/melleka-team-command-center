import { ReactNode, useState } from 'react';
import { useAdminEdit } from './AdminEditContext';
import { GripVertical, Trash2, Eye, EyeOff, Settings } from 'lucide-react';

interface EditableContainerProps {
  children: ReactNode;
  sectionId: string;
  sectionName: string;
  className?: string;
  style?: React.CSSProperties;
  onDelete?: () => void;
  onVisibilityToggle?: (visible: boolean) => void;
  isHidden?: boolean;
}

export const EditableContainer = ({
  children,
  sectionId,
  sectionName,
  className = '',
  style,
  onDelete,
  onVisibilityToggle,
  isHidden = false
}: EditableContainerProps) => {
  const { isEditMode } = useAdminEdit();
  const [showControls, setShowControls] = useState(false);

  if (!isEditMode) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <div
      className={`relative group ${className} ${isHidden ? 'opacity-50' : ''}`}
      style={style}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Edit mode border indicator */}
      <div 
        className={`absolute inset-0 pointer-events-none border-2 border-dashed rounded-lg transition-all duration-200 ${
          showControls ? 'border-primary/60' : 'border-transparent'
        }`}
      />
      
      {/* Section controls toolbar */}
      <div 
        className={`absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card border border-border shadow-lg transition-all duration-200 z-50 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        {/* Drag handle */}
        <button
          className="p-1.5 rounded hover:bg-muted transition-colors cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        
        {/* Section label */}
        <span className="text-xs font-medium text-muted-foreground px-2 border-x border-border">
          {sectionName}
        </span>
        
        {/* Visibility toggle */}
        {onVisibilityToggle && (
          <button
            onClick={() => onVisibilityToggle(!isHidden)}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title={isHidden ? 'Show section' : 'Hide section'}
          >
            {isHidden ? (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Eye className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        )}
        
        {/* Settings */}
        <button
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title="Section settings"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
        
        {/* Delete */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
            title="Delete section"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        )}
      </div>
      
      {children}
    </div>
  );
};
