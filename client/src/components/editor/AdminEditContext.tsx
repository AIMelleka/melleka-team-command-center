import { createContext, useContext, useState, ReactNode } from 'react';

interface AdminEditContextType {
  isEditMode: boolean;
  isAdminVerified: boolean;
  pendingChanges: Record<string, unknown>;
  setIsEditMode: (value: boolean) => void;
  verifyAdmin: (pin: string) => boolean;
  logout: () => void;
  updateContent: (path: string, value: unknown) => void;
  getChanges: () => Record<string, unknown>;
  clearChanges: () => void;
  hasChanges: boolean;
}

const AdminEditContext = createContext<AdminEditContextType | null>(null);

// Simple PIN for admin access - in production, this would be server-validated
const ADMIN_PIN = '1234';

export const AdminEditProvider = ({ children }: { children: ReactNode }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});

  const verifyAdmin = (pin: string): boolean => {
    if (pin === ADMIN_PIN) {
      setIsAdminVerified(true);
      setIsEditMode(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdminVerified(false);
    setIsEditMode(false);
    setPendingChanges({});
  };

  const updateContent = (path: string, value: unknown) => {
    setPendingChanges(prev => ({
      ...prev,
      [path]: value
    }));
  };

  const getChanges = () => pendingChanges;

  const clearChanges = () => setPendingChanges({});

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <AdminEditContext.Provider
      value={{
        isEditMode,
        isAdminVerified,
        pendingChanges,
        setIsEditMode,
        verifyAdmin,
        logout,
        updateContent,
        getChanges,
        clearChanges,
        hasChanges
      }}
    >
      {children}
    </AdminEditContext.Provider>
  );
};

export const useAdminEdit = () => {
  const context = useContext(AdminEditContext);
  if (!context) {
    throw new Error('useAdminEdit must be used within AdminEditProvider');
  }
  return context;
};
