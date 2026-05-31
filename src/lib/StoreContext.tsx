import { createContext, useContext, useMemo } from 'react';
import type { AppStore, PermissionKey } from './store';
import { resolvePermissions } from './store';

export const StoreContext = createContext<AppStore | null>(null);

export function useAppStore(): AppStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAppStore must be used within StoreContext.Provider');
  return ctx;
}

// Returns the resolved permission map for the current user.
// Returns all-false when no user is loaded yet.
export function usePermissions(): Record<PermissionKey, boolean> {
  const store = useAppStore();
  return useMemo(() => {
    if (!store.currentUser) return {} as Record<PermissionKey, boolean>;
    return resolvePermissions(store.currentUser);
  }, [store.currentUser]);
}
