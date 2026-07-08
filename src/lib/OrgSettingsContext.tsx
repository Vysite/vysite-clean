import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgSettings {
  org_id: string;
  account_status: 'active' | 'disabled';
  account_type: 'trial' | 'paid' | 'internal';
  trial_expires_at: string | null;
  modules_enabled: Record<string, boolean>;
  ai_enabled: boolean;
  ai_monthly_limit: number;
  ai_used_this_month: number;
  ai_bonus_credits: number;
  // Stripe billing fields
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_name: string | null;
  billing_interval: string | null;
  current_period_end: string | null;
  subscription_status: string | null;
  // Free access override — bypasses trial/subscription checks entirely
  free_access_enabled: boolean;
  free_access_enabled_at: string | null;
  free_access_enabled_by: string | null;
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
  commercial: true,
};

const DEFAULT_ORG_SETTINGS: OrgSettings = {
  org_id: '',
  account_status: 'active',
  account_type: 'trial',
  trial_expires_at: null,
  modules_enabled: ALL_MODULES_ON,
  ai_enabled: true,
  ai_monthly_limit: 50,
  ai_used_this_month: 0,
  ai_bonus_credits: 0,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  plan_name: null,
  billing_interval: null,
  current_period_end: null,
  subscription_status: null,
  free_access_enabled: false,
  free_access_enabled_at: null,
  free_access_enabled_by: null,
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface OrgSettingsState {
  orgSettings: OrgSettings;
  isModuleEnabled: (moduleKey: string) => boolean;
  isTrialExpired: boolean;
  // True when free_access_enabled override is active — bypasses all subscription/trial gates
  isFreeAccessOverride: boolean;
  loading: boolean;
}

const OrgSettingsContext = createContext<OrgSettingsState | null>(null);

function computeIsTrialExpired(settings: OrgSettings): boolean {
  if (settings.account_type !== 'trial') return false;
  if (!settings.trial_expires_at) return false;
  return new Date(settings.trial_expires_at) < new Date();
}

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
      .select('org_id,account_status,account_type,trial_expires_at,modules_enabled,ai_enabled,ai_monthly_limit,ai_used_this_month,ai_bonus_credits,stripe_customer_id,stripe_subscription_id,plan_name,billing_interval,current_period_end,subscription_status,free_access_enabled,free_access_enabled_at,free_access_enabled_by')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[VYSITE] OrgSettingsContext load error:', error.message);
          setOrgSettings({ ...DEFAULT_ORG_SETTINGS, org_id: orgId });
        } else if (data) {
          setOrgSettings({
            org_id: data.org_id,
            account_status: data.account_status ?? 'active',
            account_type: data.account_type ?? 'trial',
            trial_expires_at: data.trial_expires_at ?? null,
            modules_enabled: { ...ALL_MODULES_ON, ...(data.modules_enabled ?? {}) },
            ai_enabled: data.ai_enabled ?? true,
            ai_monthly_limit: data.ai_monthly_limit ?? 50,
            ai_used_this_month: data.ai_used_this_month ?? 0,
            ai_bonus_credits: data.ai_bonus_credits ?? 0,
            stripe_customer_id: data.stripe_customer_id ?? null,
            stripe_subscription_id: data.stripe_subscription_id ?? null,
            plan_name: data.plan_name ?? null,
            billing_interval: data.billing_interval ?? null,
            current_period_end: data.current_period_end ?? null,
            subscription_status: data.subscription_status ?? null,
            free_access_enabled: data.free_access_enabled ?? false,
            free_access_enabled_at: data.free_access_enabled_at ?? null,
            free_access_enabled_by: data.free_access_enabled_by ?? null,
          });
        } else {
          setOrgSettings({ ...DEFAULT_ORG_SETTINGS, org_id: orgId });
        }
        setLoading(false);
      });
  }, [orgId]);

  function isModuleEnabled(moduleKey: string): boolean {
    return orgSettings.modules_enabled[moduleKey] !== false;
  }

  const isTrialExpired = computeIsTrialExpired(orgSettings);
  const isFreeAccessOverride = orgSettings.free_access_enabled === true;

  return (
    <OrgSettingsContext.Provider value={{ orgSettings, isModuleEnabled, isTrialExpired, isFreeAccessOverride, loading }}>
      {children}
    </OrgSettingsContext.Provider>
  );
}

export function useOrgSettings(): OrgSettingsState {
  const ctx = useContext(OrgSettingsContext);
  if (!ctx) throw new Error('useOrgSettings must be used within OrgSettingsProvider');
  return ctx;
}
