import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdAccount {
  id: string;
  name: string;
}

interface ClientContextValue {
  // Selected client
  selectedClient: string;
  setSelectedClient: (client: string) => void;

  // Linked ad accounts (from client_account_mappings — same source as Client Health)
  googleAccountId: string;
  googleAccountName: string;
  metaAccountId: string;
  metaAccountName: string;

  // Available account lists from Supermetrics
  googleAccounts: AdAccount[];
  metaAccounts: AdAccount[];
  accountsLoading: boolean;

  // Save both accounts for a client
  saveAccounts: (googleId: string, metaId: string) => Promise<void>;
  savingAccounts: boolean;
}

const ClientContext = createContext<ClientContextValue | null>(null);

const LS_KEY = 'melleka_active_client';

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [selectedClient, _setSelectedClient] = useState<string>(() => {
    return localStorage.getItem(LS_KEY) || '';
  });

  const [googleAccountId, setGoogleAccountId] = useState('');
  const [googleAccountName, setGoogleAccountName] = useState('');
  const [metaAccountId, setMetaAccountId] = useState('');
  const [metaAccountName, setMetaAccountName] = useState('');
  const [googleAccounts, setGoogleAccounts] = useState<AdAccount[]>([]);
  const [metaAccounts, setMetaAccounts] = useState<AdAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [savingAccounts, setSavingAccounts] = useState(false);

  const setSelectedClient = useCallback((client: string) => {
    _setSelectedClient(client);
    localStorage.setItem(LS_KEY, client);
  }, []);

  // Load Supermetrics account lists once on mount
  useEffect(() => {
    setAccountsLoading(true);
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    };
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-supermetrics`;
    Promise.all([
      fetch(url, { method: 'POST', headers, body: JSON.stringify({ action: 'list-accounts', dataSource: 'google_ads' }) }).then(r => r.json()),
      fetch(url, { method: 'POST', headers, body: JSON.stringify({ action: 'list-accounts', dataSource: 'meta_ads' }) }).then(r => r.json()),
    ])
      .then(([gData, mData]) => {
        setGoogleAccounts(gData?.accounts?.google_ads || []);
        setMetaAccounts(mData?.accounts?.meta_ads || []);
      })
      .catch(() => { setGoogleAccounts([]); setMetaAccounts([]); })
      .finally(() => setAccountsLoading(false));
  }, []);

  // When client changes, load their linked accounts from client_account_mappings
  useEffect(() => {
    if (!selectedClient) {
      setGoogleAccountId('');
      setGoogleAccountName('');
      setMetaAccountId('');
      setMetaAccountName('');
      return;
    }

    supabase
      .from('client_account_mappings')
      .select('platform, account_id, account_name')
      .eq('client_name', selectedClient)
      .then(({ data }) => {
        if (!data) return;
        const google = data.find(r => r.platform === 'google_ads' || r.platform === 'google');
        const meta = data.find(r => r.platform === 'meta_ads' || r.platform === 'meta');
        setGoogleAccountId(google?.account_id || '');
        setGoogleAccountName(google?.account_name || '');
        setMetaAccountId(meta?.account_id || '');
        setMetaAccountName(meta?.account_name || '');
      });
  }, [selectedClient]);

  // When account lists load, enrich names for already-set IDs
  useEffect(() => {
    if (googleAccountId && googleAccounts.length > 0) {
      const match = googleAccounts.find(a => a.id === googleAccountId);
      if (match) setGoogleAccountName(match.name);
    }
    if (metaAccountId && metaAccounts.length > 0) {
      const match = metaAccounts.find(a => a.id === metaAccountId);
      if (match) setMetaAccountName(match.name);
    }
  }, [googleAccounts, metaAccounts, googleAccountId, metaAccountId]);

  const saveAccounts = useCallback(async (googleId: string, metaId: string) => {
    if (!selectedClient) return;
    setSavingAccounts(true);
    try {

      if (googleId) {
        const googleName = googleAccounts.find(a => a.id === googleId)?.name || googleId;
        await supabase.from('client_account_mappings').upsert({
          client_name: selectedClient,
          platform: 'google_ads',
          account_id: googleId,
          account_name: googleName,
        }, { onConflict: 'client_name,platform' });
        setGoogleAccountId(googleId);
        setGoogleAccountName(googleName);
      }

      if (metaId) {
        const metaName = metaAccounts.find(a => a.id === metaId)?.name || metaId;
        await supabase.from('client_account_mappings').upsert({
          client_name: selectedClient,
          platform: 'meta_ads',
          account_id: metaId,
          account_name: metaName,
        }, { onConflict: 'client_name,platform' });
        setMetaAccountId(metaId);
        setMetaAccountName(metaName);
      }
    } finally {
      setSavingAccounts(false);
    }
  }, [selectedClient, googleAccounts, metaAccounts]);

  return (
    <ClientContext.Provider value={{
      selectedClient,
      setSelectedClient,
      googleAccountId,
      googleAccountName,
      metaAccountId,
      metaAccountName,
      googleAccounts,
      metaAccounts,
      accountsLoading,
      saveAccounts,
      savingAccounts,
    }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClient must be used within ClientProvider');
  return ctx;
}
