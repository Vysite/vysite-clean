import { createContext, useContext } from 'react';
import type { AppStore } from './store';

export const StoreContext = createContext<AppStore | null>(null);

export function useAppStore(): AppStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAppStore must be used within StoreContext.Provider');
  return ctx;
}
