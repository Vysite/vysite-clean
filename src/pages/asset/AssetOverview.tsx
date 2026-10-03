import { useMemo } from 'react';
import { Package, CheckCircle2, AlertTriangle, Wrench, ArrowRight, MapPin } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBAsset } from './types';
import { ASSET_STATUS_COLORS } from './types';

interface Props {
  onSwitchToAssets: () => void;
  onSelectAsset: (a: DBAsset) => void;
}

export default function AssetOverview({ onSwitchToAssets, onSelectAsset }: Props) {
  const store = useAppStore();
  const assets = store.assets;
  const sites = store.assetSites;
  const buildings = store.assetBuildings;
  const locations = store.assetLocations;

  const stats = useMemo(() => {
    const active = assets.filter(a => a.status === 'Active').length;
    const outOfService = assets.filter(a => a.status === 'Out of Service').length;
    const underRepair = assets.filter(a => a.status === 'Under Repair').length;
    const decommissioned = assets.filter(a => a.status === 'Decommissioned').length;
    return { total: assets.length, active, outOfService, underRepair, decommissioned };
  }, [assets]);

  const recentAssets = useMemo(() => assets.slice(0, 5), [assets]);

  function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Package; color: string }) {
    return (
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon size={14} className={color} />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Total Assets" value={stats.total} icon={Package} color="text-[#f97316]" />
        <KpiCard label="Active" value={stats.active} icon={CheckCircle2} color="text-emerald-400" />
        <KpiCard label="Out of Service" value={stats.outOfService} icon={AlertTriangle} color="text-amber-400" />
        <KpiCard label="Under Repair" value={stats.underRepair} icon={Wrench} color="text-orange-400" />
        <KpiCard label="Decommissioned" value={stats.decommissioned} icon={Package} color="text-slate-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-[#f97316]" />
            <h3 className="text-sm font-bold text-white">Location Hierarchy</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-slate-400">Sites</span><span className="text-slate-200 font-semibold">{sites.length}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-400">Buildings</span><span className="text-slate-200 font-semibold">{buildings.length}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-400">Locations</span><span className="text-slate-200 font-semibold">{locations.length}</span></div>
          </div>
        </div>

        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Recently Updated Assets</h3>
            <button onClick={onSwitchToAssets} className="flex items-center gap-1 text-xs font-semibold text-[#f97316] hover:text-orange-400 transition-colors">
              View All <ArrowRight size={12} />
            </button>
          </div>
          {recentAssets.length === 0 ? (
            <p className="text-xs text-slate-600 italic py-4">No assets registered yet.</p>
          ) : (
            <div className="space-y-1">
              {recentAssets.map(a => {
                const site = sites.find(s => s.id === a.site_id);
                return (
                  <button key={a.id} onClick={() => onSelectAsset(a)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#0d1628] transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0">
                      <Package size={14} className="text-[#f97316]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{a.name}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{a.asset_tag}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ASSET_STATUS_COLORS[a.status as keyof typeof ASSET_STATUS_COLORS] ?? 'bg-slate-700 text-slate-400'}`}>{a.status}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
