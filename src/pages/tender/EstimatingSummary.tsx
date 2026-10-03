import React, { useEffect, useState, useMemo } from 'react';
import { FileImage, Ruler, Calculator, RefreshCw, TrendingUp, AlertCircle, CheckCircle2, Package, Wrench, ChevronDown, Download } from 'lucide-react';
import { useAppStore, usePermissions } from '../../lib/StoreContext';
import type { Tender } from '../../data/types';
import { finalQuantity, calcTakeoffCosts, signedTakeoffCosts } from './takeoffCalculations';
import { getSyncStatus } from './TakeoffEstimateSync';
import { computeEstimateSummary, calcLine, fmtNum, fmtC, fmtDeduction } from './estimateCalculations';
import { exportInternalSummary, exportExternalSummary } from './SummaryPDF';

interface Props {
  tender: Tender;
  onSwitchToTakeOff: () => void;
}

export default function EstimatingSummary({ tender, onSwitchToTakeOff }: Props) {
  const store = useAppStore();
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canViewFinancials = perms['tender.view_financials'] || isAdmin;

  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    Promise.all([
      store.loadTenderDrawings(tender.id),
      store.loadTenderTakeoffItems(tender.id),
    ]).then(() => {
      if (!cancelled) setDataLoading(false);
    });
    return () => { cancelled = true; };
  }, [tender.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showExportMenu, setShowExportMenu] = useState(false);

  const drawings = store.tenderDrawings.filter(d => d.tender_id === tender.id);
  const takeoffItems = store.tenderTakeoffItems.filter(i => i.tender_id === tender.id);
  const estimateItems = tender.estimateItems ?? [];

  const est = computeEstimateSummary(tender);

  // ── Take-Off calculations (reuse existing helpers) ──
  const takeoffSigned = takeoffItems.map(i => signedTakeoffCosts(i));
  const totalMaterial = takeoffSigned.reduce((s, c) => s + c.signedMaterialCost, 0);
  const totalLabour = takeoffSigned.reduce((s, c) => s + c.signedLabourCost, 0);
  const totalTakeoffCost = takeoffSigned.reduce((s, c) => s + c.signedTotalCost, 0);
  const totalLabourHours = takeoffItems.reduce((s, i) => s + calcTakeoffCosts(i).totalLabourHours, 0);

  const counted = takeoffItems.filter(i => i.measurement_type === 'count');
  const linear = takeoffItems.filter(i => i.measurement_type === 'linear');
  const area = takeoffItems.filter(i => i.measurement_type === 'area');
  const countTotal = counted.reduce((s, i) => s + finalQuantity(i), 0);
  const linearTotal = linear.reduce((s, i) => s + finalQuantity(i), 0);
  const areaTotal = area.reduce((s, i) => s + finalQuantity(i), 0);

  // ── Scope classification ──
  const stdItems = takeoffItems.filter(i => i.line_type === 'standard');
  const addItems = takeoffItems.filter(i => i.line_type === 'addition');
  const omitItems = takeoffItems.filter(i => i.line_type === 'omission');
  const stdCost = stdItems.reduce((s, i) => s + calcTakeoffCosts(i).totalCost, 0);
  const addCost = addItems.reduce((s, i) => s + calcTakeoffCosts(i).totalCost, 0);
  const omitCost = omitItems.reduce((s, i) => s + calcTakeoffCosts(i).totalCost, 0);

  // ── Discipline breakdown ──
  const disciplineMap = useMemo(() => {
    const m = new Map<string, { count: number; material: number; labour: number; total: number }>();
    for (const item of takeoffItems) {
      const d = item.discipline || 'Uncategorised';
      const existing = m.get(d) ?? { count: 0, material: 0, labour: 0, total: 0 };
      const signed = signedTakeoffCosts(item);
      existing.count++;
      existing.material += signed.signedMaterialCost;
      existing.labour += signed.signedLabourCost;
      existing.total += signed.signedTotalCost;
      m.set(d, existing);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [takeoffItems]);

  // ── Sync status ──
  const syncStatuses = takeoffItems.map(i => getSyncStatus(i, estimateItems));
  const syncedCount = syncStatuses.filter(s => s === 'synced').length;
  const notSyncedCount = syncStatuses.filter(s => s === 'not_synced').length;
  const changedCount = syncStatuses.filter(s => s === 'changed').length;
  const zeroQtyCount = syncStatuses.filter(s => s === 'zero_qty').length;
  const allSynced = takeoffItems.length > 0 && notSyncedCount === 0 && changedCount === 0;

  // ── Drawings with/without take-off ──
  const drawingIdsWithTakeoff = new Set(takeoffItems.map(i => i.drawing_id).filter(Boolean));
  const drawingsWithTakeoff = drawings.filter(d => drawingIdsWithTakeoff.has(d.id)).length;
  const drawingsWithoutTakeoff = drawings.length - drawingsWithTakeoff;
  const totalPages = drawings.reduce((s, d) => s + (d.page_count || 0), 0);

  // ── Estimate omissions/additions ──
  const estimateOmissions = estimateItems.filter(it => it.sourceLineType === 'omission');
  const estimateAdditions = estimateItems.filter(it => it.sourceLineType === 'addition');
  const estimateOmissionSale = estimateOmissions.reduce((s, it) => s + calcLine(it).saleTotal, 0);
  const estimateAdditionSale = estimateAdditions.reduce((s, it) => s + calcLine(it).saleTotal, 0);

  // ── KPI card component ──
  function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof FileImage; accent?: boolean }) {
    return (
      <div className={`rounded-xl border p-4 ${accent ? 'bg-[#0f172a] border-[#f97316]/30' : 'bg-[#1a2236] border-[#1e2d4a]'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon size={14} className={accent ? 'text-[#f97316]' : 'text-slate-500'} />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <p className={`text-lg font-bold ${accent ? 'text-white' : 'text-slate-200'}`}>{value}</p>
      </div>
    );
  }

  function Section({ title, icon: Icon, children }: { title: string; icon: typeof FileImage; children: React.ReactNode }) {
    return (
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon size={16} className="text-[#f97316]" />
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
        {children}
      </div>
    );
  }

  // ── Loading state ──
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Loading estimating summary...</p>
        </div>
      </div>
    );
  }

  const pdfData = { tender, drawings, takeoffItems, canViewFinancials };
  const logoUrl = store.settings?.logo_data_url;

  return (
    <div className="space-y-5">
      {/* ── Export control ── */}
      <div className="flex justify-end">
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
          >
            <Download size={14} />Export PDF<ChevronDown size={12} />
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-[#1a2236] border border-[#1e2d4a] rounded-lg shadow-xl py-1 min-w-[180px]">
                {canViewFinancials && (
                  <button
                    onClick={() => { setShowExportMenu(false); exportInternalSummary(pdfData, logoUrl); }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-[#0d1628] hover:text-[#f97316] transition-colors"
                  >
                    Internal Summary
                  </button>
                )}
                <button
                  onClick={() => { setShowExportMenu(false); exportExternalSummary(pdfData, logoUrl); }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-[#0d1628] hover:text-[#f97316] transition-colors"
                >
                  External Summary
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Drawings" value={String(drawings.length)} icon={FileImage} />
        <KpiCard label="Take-Off Items" value={String(takeoffItems.length)} icon={Ruler} />
        {canViewFinancials && <KpiCard label="Material Cost" value={fmtC(totalMaterial)} icon={Package} />}
        {canViewFinancials && <KpiCard label="Labour Cost" value={fmtC(totalLabour)} icon={Wrench} />}
        <KpiCard label="Total Labour" value={`${fmtNum(totalLabourHours)} hrs`} icon={Wrench} />
        {canViewFinancials && <KpiCard label="Estimate Cost" value={fmtC(est.includedCost)} icon={Calculator} />}
        {canViewFinancials && <KpiCard label="Tender Value" value={fmtC(est.tenderValueBeforeMcd)} icon={TrendingUp} />}
        {canViewFinancials && <KpiCard label="Final Tender Sum" value={fmtC(est.finalTenderSum)} icon={TrendingUp} accent />}
        {canViewFinancials && <KpiCard label="Margin" value={`${est.marginAfterMcd.toFixed(1)}%`} icon={TrendingUp} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Drawings Summary ── */}
        <Section title="Drawings" icon={FileImage}>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Drawings</span>
              <span className="text-slate-200 font-semibold">{drawings.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">With Take-Off</span>
              <span className="text-emerald-400 font-semibold">{drawingsWithTakeoff}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Without Take-Off</span>
              <span className="text-slate-500 font-semibold">{drawingsWithoutTakeoff}</span>
            </div>
            {totalPages > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total PDF Pages</span>
                <span className="text-slate-200 font-semibold">{totalPages}</span>
              </div>
            )}
            {drawings.length === 0 && (
              <p className="text-xs text-slate-600 italic py-2">No drawings uploaded yet.</p>
            )}
          </div>
        </Section>

        {/* ── Take-Off Summary ── */}
        <Section title="Take-Off" icon={Ruler}>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Items</span>
              <span className="text-slate-200 font-semibold">{takeoffItems.length}</span>
            </div>
            {counted.length > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Counted</span>
                <span className="text-[#f97316] font-semibold">{countTotal.toFixed(0)} nr</span>
              </div>
            )}
            {linear.length > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Linear</span>
                <span className="text-[#f97316] font-semibold">{linearTotal.toFixed(2)} m</span>
              </div>
            )}
            {area.length > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Area</span>
                <span className="text-[#f97316] font-semibold">{areaTotal.toFixed(2)} m²</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Labour</span>
              <span className="text-slate-200 font-semibold">{fmtNum(totalLabourHours)} hrs</span>
            </div>
            {canViewFinancials && (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Material Cost</span>
                  <span className="text-slate-200 font-semibold">{fmtC(totalMaterial)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Labour Cost</span>
                  <span className="text-slate-200 font-semibold">{fmtC(totalLabour)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#1e2d4a] pt-2">
                  <span className="text-slate-300 font-semibold">Net Take-Off Cost</span>
                  <span className="text-[#f97316] font-bold">{fmtC(totalTakeoffCost)}</span>
                </div>
              </>
            )}
            {takeoffItems.length === 0 && (
              <p className="text-xs text-slate-600 italic py-2">No take-off items yet.</p>
            )}
          </div>
        </Section>

        {/* ── Scope Classification ── */}
        <Section title="Scope / Commercial Classification" icon={AlertCircle}>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Standard</span>
              <span className="text-slate-200 font-semibold">{stdItems.length} items</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-emerald-400">Additions</span>
              <span className="text-emerald-400 font-semibold">{addItems.length} items</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-red-400">Omissions</span>
              <span className="text-red-400 font-semibold">{omitItems.length} items</span>
            </div>
            {canViewFinancials && takeoffItems.length > 0 && (
              <div className="border-t border-[#1e2d4a] pt-2 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Standard</span>
                  <span className="text-slate-200 font-mono">{fmtC(stdCost)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400">Additions</span>
                  <span className="text-emerald-400 font-mono">+{fmtC(addCost)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-red-400">Omissions</span>
                  <span className="text-red-400 font-mono">{fmtDeduction(omitCost)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#1e2d4a] pt-2">
                  <span className="text-slate-300 font-semibold">Net Take-Off</span>
                  <span className="text-[#f97316] font-bold">{fmtC(totalTakeoffCost)}</span>
                </div>
              </div>
            )}
            {takeoffItems.length === 0 && (
              <p className="text-xs text-slate-600 italic py-2">No take-off items to classify.</p>
            )}
          </div>
        </Section>

        {/* ── Sync Status ── */}
        <Section title="Take-Off → Estimate Sync" icon={RefreshCw}>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-emerald-400">Synced</span>
              <span className="text-emerald-400 font-semibold">{syncedCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Not Synced</span>
              <span className="text-slate-200 font-semibold">{notSyncedCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-amber-400">Changed</span>
              <span className="text-amber-400 font-semibold">{changedCount}</span>
            </div>
            {zeroQtyCount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Zero Quantity</span>
                <span className="text-slate-600 font-semibold">{zeroQtyCount}</span>
              </div>
            )}
            <div className="pt-2">
              {takeoffItems.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No take-off items to sync.</p>
              ) : allSynced ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 size={14} />
                  <span>All Take-Off items are up to date</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <AlertCircle size={14} />
                  <span>Take-Off changes require Estimate review</span>
                </div>
              )}
            </div>
            {takeoffItems.length > 0 && !allSynced && (
              <button
                onClick={onSwitchToTakeOff}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316]/10 hover:bg-[#f97316]/20 border border-[#f97316]/30 text-[#f97316] rounded-lg text-xs font-semibold transition-colors"
              >
                <Ruler size={12} />Review Take-Off
              </button>
            )}
          </div>
        </Section>
      </div>

      {/* ── Discipline Breakdown ── */}
      {disciplineMap.length > 0 && (
        <Section title="Trade / Discipline Breakdown" icon={Ruler}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2d4a]">
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase pb-2 px-2">Discipline</th>
                  <th className="text-right text-[10px] font-bold text-slate-600 uppercase pb-2 px-2">Items</th>
                  {canViewFinancials && <th className="text-right text-[10px] font-bold text-slate-600 uppercase pb-2 px-2">Material</th>}
                  {canViewFinancials && <th className="text-right text-[10px] font-bold text-slate-600 uppercase pb-2 px-2">Labour</th>}
                  {canViewFinancials && <th className="text-right text-[10px] font-bold text-slate-600 uppercase pb-2 px-2">Total</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0d1628]">
                {disciplineMap.map(([discipline, data]) => (
                  <tr key={discipline}>
                    <td className="py-2 px-2 text-xs text-slate-200 font-medium">{discipline}</td>
                    <td className="py-2 px-2 text-xs text-slate-400 text-right">{data.count}</td>
                    {canViewFinancials && <td className="py-2 px-2 text-xs text-slate-300 font-mono text-right">{fmtC(data.material)}</td>}
                    {canViewFinancials && <td className="py-2 px-2 text-xs text-slate-300 font-mono text-right">{fmtC(data.labour)}</td>}
                    {canViewFinancials && <td className="py-2 px-2 text-xs text-slate-200 font-mono text-right font-semibold">{fmtC(data.total)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Estimate Summary ── */}
      {canViewFinancials && (
        <Section title="Estimate" icon={Calculator}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Works</span>
                <span className="text-slate-200 font-mono">{fmtC(est.worksTotals.sale)}</span>
              </div>
              {est.prelimItems.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Preliminaries</span>
                  <span className="text-slate-200 font-mono">{fmtC(est.prelimTotals.sale)}</span>
                </div>
              )}
              {est.optionalIncluded.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Included Options</span>
                  <span className="text-slate-200 font-mono">{fmtC(est.optIncludedTotals.sale)}</span>
                </div>
              )}
              {est.allowanceItems.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Internal Allowances</span>
                  <span className="text-slate-200 font-mono">{fmtC(est.allowanceTotals.sale)}</span>
                </div>
              )}
              {estimateAdditions.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400">Additions</span>
                  <span className="text-emerald-400 font-mono">+{fmtC(estimateAdditionSale)}</span>
                </div>
              )}
              {estimateOmissions.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-red-400">Omissions</span>
                  <span className="text-red-400 font-mono">{fmtDeduction(estimateOmissionSale)}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs border-b border-[#1e2d4a] pb-2">
                <span className="text-slate-300 font-semibold">Total Included Cost</span>
                <span className="text-slate-200 font-mono">{fmtC(est.includedCost)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">Tender Value Before MCD</span>
                <span className="text-slate-200 font-mono font-semibold">{fmtC(est.tenderValueBeforeMcd)}</span>
              </div>
              {est.mcdType !== 'none' && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{est.mcdType === 'percentage' ? `MCD (${est.mcdPct}%)` : 'MCD'}</span>
                  <span className="text-red-400 font-mono">{fmtDeduction(est.mcdValue)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs bg-[#0f172a] rounded-lg px-3 py-2 border-t-2 border-[#f97316]">
                <span className="text-white font-bold">FINAL TENDER SUM</span>
                <span className="text-white font-mono font-bold">{fmtC(est.finalTenderSum)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Profit {est.mcdType !== 'none' ? 'After MCD' : ''}</span>
                <span className={`font-mono ${est.profitAfterMcd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtC(est.profitAfterMcd)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Margin {est.mcdType !== 'none' ? 'After MCD' : ''}</span>
                <span className={`font-mono ${est.marginAfterMcd >= 15 ? 'text-emerald-400' : est.marginAfterMcd >= 8 ? 'text-amber-400' : 'text-red-400'}`}>{est.marginAfterMcd.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          {estimateItems.length === 0 && (
            <p className="text-xs text-slate-600 italic py-2">No estimate items yet.</p>
          )}
        </Section>
      )}
    </div>
  );
}
