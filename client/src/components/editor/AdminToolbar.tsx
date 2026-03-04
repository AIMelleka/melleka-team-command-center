import { useState } from 'react';
import { useAdminEdit } from './AdminEditContext';
import { Shield, ShieldCheck, Save, X, Undo, Plus, Palette, Layout, Eye, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface AdminToolbarProps {
  onSave: (changes: Record<string, unknown>) => Promise<void>;
  primaryColor?: string;
  isAdmin?: boolean; // Only show toolbar for authenticated admins
}

export const AdminToolbar = ({ onSave, primaryColor = '#7c3aed', isAdmin = false }: AdminToolbarProps) => {
  const { isEditMode, isAdminVerified, verifyAdmin, logout, hasChanges, getChanges, clearChanges } = useAdminEdit();
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Don't render anything if user is not an authenticated admin
  if (!isAdmin) {
    return null;
  }

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdmin(pin)) {
      toast.success('Admin mode activated');
      setShowPinInput(false);
      setPin('');
    } else {
      toast.error('Invalid PIN');
      setPin('');
    }
  };

  const handleSave = async () => {
    if (!hasChanges) {
      toast.info('No changes to save');
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(getChanges());
      clearChanges();
      toast.success('Changes saved successfully');
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    clearChanges();
    toast.info('Changes discarded');
  };

  // Not in edit mode - show the admin access button
  if (!isAdminVerified) {
    return (
      <>
        {/* Floating admin access button */}
        <button
          onClick={() => setShowPinInput(true)}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 group"
          style={{ backgroundColor: primaryColor }}
          title="Admin Edit Mode"
        >
          <Shield className="w-5 h-5 text-white" />
        </button>

        {/* PIN Input Modal */}
        {showPinInput && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${primaryColor}20` }}>
                  <Lock className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Admin Access</h3>
                  <p className="text-sm text-muted-foreground">Enter PIN to enable editing</p>
                </div>
              </div>
              
              <form onSubmit={handlePinSubmit}>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter PIN"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-center text-2xl tracking-widest mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                  maxLength={6}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowPinInput(false); setPin(''); }}
                    className="flex-1 px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Unlock
                  </button>
                </div>
              </form>
              
              <p className="text-xs text-muted-foreground text-center mt-4">
                Default PIN: 1234
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  // In edit mode - show the full toolbar
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border shadow-2xl">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left side - mode indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">Edit Mode Active</span>
            </div>
            {hasChanges && (
              <span className="text-sm text-yellow-500 animate-pulse">
                • Unsaved changes
              </span>
            )}
          </div>

          {/* Center - quick tools */}
          <div className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-muted">
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              title="Add Section"
            >
              <Plus className="w-4 h-4" />
              Add Section
            </button>
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              title="Change Colors"
            >
              <Palette className="w-4 h-4" />
              Colors
            </button>
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              title="Layout"
            >
              <Layout className="w-4 h-4" />
              Layout
            </button>
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          </div>

          {/* Right side - actions */}
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <button
                  onClick={handleDiscard}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Undo className="w-4 h-4" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Exit Edit Mode"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
