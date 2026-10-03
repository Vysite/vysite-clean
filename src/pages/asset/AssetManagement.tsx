import { useState, useEffect } from 'react';
import { Package, List, MapPin, BarChart3, ArrowLeft, Loader2 } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import AssetRegister from './AssetRegister';
import AssetDetail from './AssetDetail';
import SitesLocations from './SitesLocations';
import AssetOverview from './AssetOverview';
import type { DBAsset } from './types';

type Tab = 'overview' | 'assets' | 'sites';

export default function AssetManagement() {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedAsset, setSelectedAsset] = useState<DBAsset | null>(null);

  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    store.loadAssetData().then(() => setDataLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedAsset) {
    return (
      <div className="p-4 lg:p-6">
        <AssetDetail
          asset={selectedAsset}
          onBack={() => setSelectedAsset(null)}
          onAssetUpdated={(updated) => setSelectedAsset(updated)}
        />
      </div>
    );
  }

  const tabCls = (t: Tab) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
      tab === t ? 'text-[#f97316] border-[#f97316]' : 'text-slate-500 border-transparent hover:text-slate-300'
    }`;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
            <Package size={20} className="text-[#f97316]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Asset Management</h2>
            <p className="text-sm text-slate-500">Permanent asset register & location hierarchy</p>
          </div>
        </div>
      </div>

      {!dataLoaded ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={24} className="text-[#f97316] animate-spin mb-3" />
          <p className="text-sm text-slate-500">Loading Asset Management...</p>
        </div>
      ) : null}

      {dataLoaded && (
        <>
      <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 mb-5 overflow-x-auto">
        <button className={tabCls('overview')} onClick={() => setTab('overview')}>
          <BarChart3 size={15} />Overview
        </button>
        <button className={tabCls('assets')} onClick={() => setTab('assets')}>
          <List size={15} />Assets
        </button>
        <button className={tabCls('sites')} onClick={() => setTab('sites')}>
          <MapPin size={15} />Sites & Locations
        </button>
      </div>

      {tab === 'overview' && <AssetOverview onSwitchToAssets={() => setTab('assets')} onSelectAsset={(a) => setSelectedAsset(a)} />}
      {tab === 'assets' && <AssetRegister onSelectAsset={(a) => setSelectedAsset(a)} />}
      {tab === 'sites' && <SitesLocations />}
        </>
      )}
    </div>
  );
}
