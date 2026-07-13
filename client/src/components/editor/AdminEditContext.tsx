import { createContext, useContext, useState, ReactNode } from 'react';

export interface CustomProposalSection {
  id: string;
  type: 'text-block' | 'stats' | 'feature-list' | 'testimonial' | 'cta-block';
  title: string;
  content: Record<string, unknown>;
}

interface AdminEditContextType {
  isEditMode: boolean;
  isAdminVerified: boolean;
  pendingChanges: Record<string, unknown>;
  savedOverrides: Record<string, unknown>;
  contentData: Record<string, unknown>;
  initContentData: (data: Record<string, unknown>) => void;
  setIsEditMode: (value: boolean) => void;
  verifyAdmin: (pin: string) => boolean;
  logout: () => void;
  updateContent: (path: string, value: unknown) => void;
  getChanges: () => Record<string, unknown>;
  clearChanges: () => void;
  discardChanges: () => void;
  hasChanges: boolean;
  // Hidden sections
  hiddenSections: string[];
  hideSection: (id: string) => void;
  showSection: (id: string) => void;
  isSectionHidden: (id: string) => boolean;
  initHiddenSections: (sections: string[]) => void;
  // Custom sections
  customSections: CustomProposalSection[];
  addCustomSection: (section: CustomProposalSection) => void;
  removeCustomSection: (id: string) => void;
  updateCustomSection: (id: string, field: string, value: unknown) => void;
  initCustomSections: (sections: CustomProposalSection[]) => void;
  // Section ordering
  sectionOrder: string[];
  setSectionOrder: (order: string[]) => void;
  initSectionOrder: (order: string[]) => void;
}

const AdminEditContext = createContext<AdminEditContextType | null>(null);

// Simple PIN for admin access - in production, this would be server-validated
const ADMIN_PIN = '1234';

export const AdminEditProvider = ({ children }: { children: ReactNode }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});
  const [savedOverrides, setSavedOverrides] = useState<Record<string, unknown>>({});
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<CustomProposalSection[]>([]);
  const [sectionOrder, setSectionOrderState] = useState<string[]>([]);
  const [contentData, setContentData] = useState<Record<string, unknown>>({});

  const initContentData = (data: Record<string, unknown>) => {
    setContentData(data);
  };

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
    setSavedOverrides({});
  };

  const updateContent = (path: string, value: unknown) => {
    setPendingChanges(prev => ({
      ...prev,
      [path]: value
    }));
  };

  const getChanges = () => {
    const changes = { ...pendingChanges };
    // Include hidden sections and custom sections in changes
    if (hiddenSections.length > 0) {
      changes['_hiddenSections'] = hiddenSections;
    }
    if (customSections.length > 0) {
      changes['_customSections'] = customSections;
    }
    if (sectionOrder.length > 0) {
      changes['_sectionOrder'] = sectionOrder;
    }
    return changes;
  };

  const clearChanges = () => {
    // Move pending changes to saved overrides so EditableText still shows saved values
    setSavedOverrides(prev => ({ ...prev, ...pendingChanges }));
    setPendingChanges({});
  };

  const discardChanges = () => {
    // Truly discard — clear pending without preserving in overrides
    setPendingChanges({});
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  // Hidden sections
  const hideSection = (id: string) => {
    setHiddenSections(prev => prev.includes(id) ? prev : [...prev, id]);
    // Mark as a pending change so the save button appears
    setPendingChanges(prev => ({ ...prev, _hiddenSections: true }));
  };

  const showSection = (id: string) => {
    setHiddenSections(prev => prev.filter(s => s !== id));
    setPendingChanges(prev => ({ ...prev, _hiddenSections: true }));
  };

  const isSectionHidden = (id: string) => hiddenSections.includes(id);

  const initHiddenSections = (sections: string[]) => {
    setHiddenSections(sections);
  };

  // Custom sections
  const addCustomSection = (section: CustomProposalSection) => {
    setCustomSections(prev => [...prev, section]);
    setPendingChanges(prev => ({ ...prev, _customSections: true }));
  };

  const removeCustomSection = (id: string) => {
    setCustomSections(prev => prev.filter(s => s.id !== id));
    setPendingChanges(prev => ({ ...prev, _customSections: true }));
  };

  const updateCustomSection = (id: string, field: string, value: unknown) => {
    setCustomSections(prev => prev.map(s =>
      s.id === id ? { ...s, content: { ...s.content, [field]: value } } : s
    ));
    setPendingChanges(prev => ({ ...prev, _customSections: true }));
  };

  const initCustomSections = (sections: CustomProposalSection[]) => {
    setCustomSections(sections);
  };

  // Section ordering
  const setSectionOrder = (order: string[]) => {
    setSectionOrderState(order);
    setPendingChanges(prev => ({ ...prev, _sectionOrder: true }));
  };

  const initSectionOrder = (order: string[]) => {
    setSectionOrderState(order);
  };

  return (
    <AdminEditContext.Provider
      value={{
        isEditMode,
        isAdminVerified,
        pendingChanges,
        savedOverrides,
        contentData,
        initContentData,
        setIsEditMode,
        verifyAdmin,
        logout,
        updateContent,
        getChanges,
        clearChanges,
        discardChanges,
        hasChanges,
        hiddenSections,
        hideSection,
        showSection,
        isSectionHidden,
        initHiddenSections,
        customSections,
        addCustomSection,
        removeCustomSection,
        updateCustomSection,
        initCustomSections,
        sectionOrder,
        setSectionOrder,
        initSectionOrder
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
