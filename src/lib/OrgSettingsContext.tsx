import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgSettings {
  org_id: string;
  account_status: 'active' | 'disabled';
  modules_enabled: Record<string, boolean>;
  ai_enabled: boolean;
  ai_monthly_limit: number;
  ai_used_this_month: number;
  ai_bonus_credits: number;
}

// All modules default to enabled — preserves existing behaviour when no
// org_settings row exists yet for an organisation.
const ALL_MODULES_ON: Record<string, boolean> = {
  tenders: true,
  projects: true,
  maintenance: true,
  'site-forms': true,
  snagging: true,
  actions: true,
  testing: true,
  reports: true,
};

const DEFAULT_ORG_SETTINGS: OrgSettings = {
  org_id: '',
  account_status: 'active',
  modules_enabled: ALL_MODULES_ON,
  ai_enabled: true,
  ai_monthly_limit: 50,
  ai_used_this_month: 0,
  ai_bonus_credits: 0,
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface OrgSettingsState {
  orgSettings: OrgSettings;
  // Returns true if the module key is enabled at the org level.
  // Defaults to true when org_settings row does not exist.
  isModuleEnabled: (moduleKey: string) => boolean;
  loading: boolean;
}

const OrgSettingsContext = createContext<OrgSettingsState | null>(null);

export function OrgSettingsProvider({
  orgId,
  children,
}: {
  orgId: string | null;
  children: ReactNode;
}) {
  const [orgSettings, setOrgSettings] = useState<OrgSettings>(DEFAULT_ORG_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setOrgSettings(DEFAULT_ORG_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);

    supabase
      .from('org_settings')
      .select('org_id,account_status,modules_enabled,ai_enabled,ai_monthly_limit,ai_used_this_month,ai_bonus_credits')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[VYSITE] OrgSettingsContext load error:', error.message);
          // On error, default to fully enabled so users are not accidentally locked out
          setOrgSettings({ ...DEFAULT_ORG_SETTINGS, org_id: orgId });
        } else if (data) {
          setOrgSettings({
            org_id: data.org_id,
            account_status: data.account_status ?? 'active',
            modules_enabled: { ...ALL_MODULES_ON, ...(data.modules_enabled ?? {}) },
            ai_enabled: data.ai_enabled ?? true,
            ai_monthly_limit: data.ai_monthly_limit ?? 50,
            ai_used_this_month: data.ai_used_this_month ?? 0,
            ai_bonus_credits: data.ai_bonus_credits ?? 0,
          });
        } else {
          // No row — org has not been configured yet; default everything to on
          setOrgSettings({ ...DEFAULT_ORG_SETTINGS, org_id: orgId });
        }
        setLoading(false);
      });
  }, [orgId]);

  function isModuleEnabled(moduleKey: string): boolean {
    return orgSettings.modules_enabled[moduleKey] !== false;
  }

  return (
    <OrgSettingsContext.Provider value={{ orgSettings, isModuleEnabled, loading }}>
      {children}
    </OrgSettingsContext.Provider>
  );
}

export function useOrgSettings(): OrgSettingsState {
  const ctx = useContext(OrgSettingsContext);
  if (!ctx) throw new Error('useOrgSettings must be used within OrgSettingsProvider');
  return ctx;
}
