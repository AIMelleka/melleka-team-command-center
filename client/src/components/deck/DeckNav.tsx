import { ArrowLeft, Calendar, BarChart3, Menu, X, PanelLeftClose, PanelLeftOpen, Pencil, Check, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useRef, useContext } from 'react';
import { LucideIcon } from 'lucide-react';
import { DeckEditContext } from '@/components/deck/DeckEditContext';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface DeckNavProps {
  items: NavItem[];
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  clientName: string;
  clientLogo?: string;
  brandColor: string;
  brandBackground?: string;
  brandTextPrimary?: string;
  brandTextSecondary?: string;
  dateRange: string;
  onBack?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isAdminMode?: boolean;
  isEditMode?: boolean;
  onLogoUpload?: (file: File) => void;
}

export const DeckNav = ({
  items,
  activeSection,
  onNavigate,
  clientName,
  clientLogo,
  brandColor,
  brandBackground = '#0a0a15',
  brandTextPrimary = '#ffffff',
  brandTextSecondary = '#a0a0b0',
  dateRange,
  onBack,
  collapsed = false,
  onToggleCollapse,
  isAdminMode = true,
  isEditMode = false,
  onLogoUpload,
}: DeckNavProps) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Consume DeckEditContext directly so nav label overrides persist without prop drilling
  const deckEditCtx = useContext(DeckEditContext);
  const navLabelOverrides = deckEditCtx?.overrides
    ? Object.fromEntries(
        Object.entries(deckEditCtx.overrides)
          .filter(([k]) => k.startsWith('nav.') && k.endsWith('.label'))
          .map(([k, v]) => [k.slice(4, -6), v])
      )
    : {};
  const onNavLabelChange = deckEditCtx
    ? (id: string, label: string) => deckEditCtx.updateOverride(`nav.${id}.label`, label)
    : undefined;
  const onNavLabelReset = deckEditCtx
    ? (id: string) => deckEditCtx.removeOverride(`nav.${id}.label`)
    : undefined;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingNavId, setEditingNavId] = useState<string | null>(null);
  const [editingNavDraft, setEditingNavDraft] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const isLightColor = (color: string): boolean => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };

  const textOnPrimary = isLightColor(brandColor) ? '#1a1a2e' : '#ffffff';

  const getLabel = (item: NavItem) => navLabelOverrides[item.id] || item.label;

  const handleNavigate = (sectionId: string) => {
    if (editingNavId) return; // don't navigate while editing
    onNavigate(sectionId);
    setMobileMenuOpen(false);
  };

  const startEditNav = (item: NavItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNavId(item.id);
    setEditingNavDraft(getLabel(item));
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveNavLabel = (id: string) => {
    if (editingNavDraft.trim() && onNavLabelChange) {
      onNavLabelChange(id, editingNavDraft.trim());
    }
    setEditingNavId(null);
  };

  const cancelNavEdit = () => setEditingNavId(null);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 backdrop-blur-xl border-b px-4 py-3" style={{ backgroundColor: `${brandBackground}f2`, borderColor: `${brandTextPrimary}0d` }}>
        <div className="flex items-center gap-2">
          {isAdminMode && onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} style={{ color: `${brandTextPrimary}b3` }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-lg font-bold truncate max-w-[200px]" style={{ color: brandTextPrimary }}>{clientName}</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ color: `${brandTextPrimary}b3` }}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 backdrop-blur-xl pt-16" style={{ backgroundColor: `${brandBackground}fa` }}>
          <nav className="p-4 space-y-2">
            {items.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                    activeSection === item.id ? "" : "hover:opacity-80"
                  )}
                  style={{
                    color: activeSection === item.id ? brandTextPrimary : brandTextSecondary,
                    backgroundColor: activeSection === item.id ? `${brandTextPrimary}1a` : undefined,
                  }}
                >
                  <IconComponent className="h-5 w-5" />
                  <span className="font-medium">{getLabel(item)}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 h-screen backdrop-blur-2xl z-40 transition-all duration-300",
          collapsed ? "w-16" : "w-72"
        )} 
        style={{ backgroundColor: `${brandBackground}f2`, borderRight: `1px solid ${brandTextPrimary}0d` }}
      >
        {/* Header */}
        <div className={cn("transition-all duration-300", collapsed ? "p-3" : "p-6")} style={{ borderBottom: `1px solid ${brandTextPrimary}0d` }}>
          {!collapsed && (
            <>
              {clientLogo ? (
                <div className="relative group mb-4">
                  <img 
                    src={clientLogo} 
                    alt={clientName}
                    className="h-10 w-auto object-contain"
                  />
                  {isEditMode && onLogoUpload && (
                    <>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onLogoUpload(f);
                          e.target.value = '';
                        }}
                      />
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                        title="Change logo"
                      >
                        <Camera className="h-4 w-4 text-white" />
                      </button>
                    </>
                  )}
                </div>
              ) : isEditMode && onLogoUpload ? (
                <div className="mb-4">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="nav-logo-upload"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onLogoUpload(f);
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="nav-logo-upload"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 text-white/50 text-xs cursor-pointer hover:border-white/40 hover:text-white/70 transition-colors"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Upload Logo
                  </label>
                </div>
              ) : (
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: brandColor }}
                >
                  <BarChart3 className="h-6 w-6" style={{ color: textOnPrimary }} />
                </div>
              )}
              <h1 className="text-xl font-bold truncate" style={{ color: brandTextPrimary }}>{clientName}</h1>
              <div className="flex items-center gap-2 mt-2 text-sm" style={{ color: brandTextSecondary }}>
                <Calendar className="h-4 w-4" />
                <span>{dateRange}</span>
              </div>
              {isEditMode && (
                <p className="mt-2 text-[10px] text-yellow-400/70 flex items-center gap-1">
                  <Pencil className="h-2.5 w-2.5" /> Click pencil icons to rename nav items
                </p>
              )}
            </>
          )}
          {collapsed && (
            <div className="flex justify-center">
              {clientLogo ? (
                <img src={clientLogo} alt={clientName} className="h-8 w-8 object-contain rounded" />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: brandColor }}>
                  <BarChart3 className="h-5 w-5" style={{ color: textOnPrimary }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-1">
            {items.map((item) => {
              const isActive = activeSection === item.id;
              const IconComponent = item.icon;
              const isEditing = editingNavId === item.id;
              const label = getLabel(item);
              const isRenamed = !!navLabelOverrides[item.id];
              
              return (
                <div
                  key={item.id}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl transition-all duration-200 text-left group",
                    collapsed ? "justify-center px-2 py-3" : "px-3 py-3",
                  )}
                  style={{
                    color: isActive ? brandTextPrimary : brandTextSecondary,
                    ...(isActive ? { 
                      background: `linear-gradient(90deg, ${brandColor}30 0%, transparent 100%)`,
                      borderLeft: collapsed ? undefined : `3px solid ${brandColor}`,
                    } : { borderLeft: collapsed ? undefined : '3px solid transparent' }),
                  }}
                >
                  {/* Icon + label / edit input */}
                  <button
                    onClick={() => handleNavigate(item.id)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                    title={collapsed ? label : undefined}
                  >
                    <span 
                      className={cn(
                        "transition-colors flex-shrink-0",
                        isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100"
                      )}
                      style={isActive ? { color: brandColor } : undefined}
                    >
                      <IconComponent className="h-5 w-5" />
                    </span>
                    
                    {!collapsed && !isEditing && (
                      <span className={cn("font-medium text-sm truncate flex-1", isRenamed && isEditMode && "text-yellow-300")}>
                        {label}
                      </span>
                    )}
                    {!collapsed && isEditing && (
                      <input
                        ref={editInputRef}
                        value={editingNavDraft}
                        onChange={e => setEditingNavDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); saveNavLabel(item.id); }
                          if (e.key === 'Escape') cancelNavEdit();
                        }}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 bg-black/60 border border-yellow-400/80 rounded px-2 py-0.5 outline-none text-white text-sm"
                      />
                    )}
                  </button>

                  {/* Edit Mode: rename controls */}
                  {!collapsed && isEditMode && !isEditing && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {/* Reset label — only shown when item has been renamed */}
                      {isRenamed && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavLabelReset?.(item.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20"
                          title="Reset to default label"
                        >
                          <X className="h-3 w-3 text-red-400" />
                        </button>
                      )}
                      <button
                        onClick={(e) => startEditNav(item, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-yellow-400/20"
                        title="Rename nav item"
                      >
                        <Pencil className="h-3 w-3 text-yellow-400" />
                      </button>
                    </div>
                  )}
                  {!collapsed && isEditing && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => saveNavLabel(item.id)}
                        className="p-1 rounded bg-green-500 hover:bg-green-600 text-white"
                        title="Save"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        onClick={cancelNavEdit}
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-white"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {!collapsed && isActive && !isEditing && (
                    <span 
                      className="ml-auto w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                      style={{ backgroundColor: brandColor }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Collapse toggle */}
        <div className="px-3 py-2" style={{ borderTop: `1px solid ${brandTextPrimary}0d` }}>
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full hover:opacity-80", collapsed ? "justify-center" : "justify-start")}
            style={{ color: brandTextSecondary }}
            onClick={onToggleCollapse}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : (
              <>
                <PanelLeftClose className="mr-2 h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>

        {/* Back button — admin only */}
        {isAdminMode && onBack && (
        <div className="px-3 py-3" style={{ borderTop: `1px solid ${brandTextPrimary}0d` }}>
          <Button 
            variant="ghost" 
            className={cn("w-full hover:opacity-80", collapsed ? "justify-center px-0" : "justify-start")}
            style={{ color: brandTextSecondary }}
            onClick={onBack}
            title={collapsed ? "Back to Builder" : undefined}
          >
            <ArrowLeft className={cn("h-4 w-4", collapsed ? "" : "mr-2")} />
            {!collapsed && "Back to Builder"}
          </Button>
        </div>
        )}
      </aside>
    </>
  );
};
