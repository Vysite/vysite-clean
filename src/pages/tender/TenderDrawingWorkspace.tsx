import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Ruler, Check, X, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBTenderDrawing, DBTenderDrawingCalibration, CalibrationPoint, CalibrationMethod } from './drawingTypes';
import { PRESET_SCALES } from './drawingTypes';

interface Props {
  drawing: DBTenderDrawing;
  tenderId: string;
  onClose: () => void;
}

type RenderState = 'idle' | 'loading' | 'rendered' | 'error';

export default function TenderDrawingWorkspace({ drawing, tenderId, onClose }: Props) {
  const store = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<unknown>(null);
  const currentPageRef = useRef(1);

  const [currentPage, setCurrentPage] = useState(drawing.current_page || 1);
  const [totalPages, setTotalPages] = useState(drawing.page_count || 1);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [renderState, setRenderState] = useState<RenderState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, setSignedUrl] = useState<string | null>(null);
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMethod>('none');
  const [calibPoints, setCalibPoints] = useState<CalibrationPoint[]>([]);
  const [knownDistance, setKnownDistance] = useState('');
  const [calibUnit, setCalibUnit] = useState('m');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [pageCalibration, setPageCalibration] = useState<DBTenderDrawingCalibration | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [pdfViewport, setPdfViewport] = useState<{ width: number; height: number } | null>(null);

  // Load calibrations for this drawing
  useEffect(() => {
    store.loadTenderDrawingCalibrations(drawing.id);
  }, [drawing.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find calibration for current page
  useEffect(() => {
    const cal = store.tenderDrawingCalibrations.find(c => c.drawing_id === drawing.id && c.page_number === currentPage);
    setPageCalibration(cal ?? null);
    if (cal) {
      setCalibrationMode(cal.method);
      if (cal.method === 'preset') setSelectedPreset(cal.scale_ratio ?? '');
      if (cal.method === 'manual') setCalibPoints(cal.calibration_points ?? []);
    } else {
      setCalibrationMode('none');
      setSelectedPreset('');
      setCalibPoints([]);
    }
  }, [store.tenderDrawingCalibrations, drawing.id, currentPage]);

  // Get signed URL and load PDF
  useEffect(() => {
    let cancelled = false;
    setRenderState('loading');
    setErrorMsg(null);

    (async () => {
      try {
        const url = await store.getTenderDrawingSignedUrl(drawing.storage_path);
        if (cancelled) return;
        if (!url) {
          setErrorMsg('Failed to get signed URL for drawing.');
          setRenderState('error');
          return;
        }
        setSignedUrl(url);

        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        currentPageRef.current = Math.min(currentPage, pdf.numPages);
        setCurrentPage(prev => Math.min(prev, pdf.numPages));

        await renderPage(pdf, currentPageRef.current, zoom);
        if (!cancelled) setRenderState('rendered');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setErrorMsg(`Failed to load PDF: ${msg}`);
        setRenderState('error');
      }
    })();

    return () => { cancelled = true; };
  }, [drawing.storage_path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render when page or zoom changes
  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage(pdfDocRef.current, currentPage, zoom);
    }
  }, [currentPage, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist current page (debounced — single update on change)
  useEffect(() => {
    if (currentPage !== drawing.current_page && currentPage > 0) {
      store.updateTenderDrawing({ id: drawing.id, current_page: currentPage, updated_at: new Date().toISOString() });
    }
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderPage = useCallback(async (pdf: any, pageNum: number, zoomLevel: number) => {
    if (!canvasRef.current) return;
    setRenderState('loading');
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      setPdfViewport({ width: viewport.width, height: viewport.height });

      const scale = zoomLevel;
      const scaledViewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;

      await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
      setRenderState('rendered');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMsg(`Failed to render page: ${msg}`);
      setRenderState('error');
    }
  }, []);

  const handlePrevPage = () => {
    if (currentPage > 1) { setPan({ x: 0, y: 0 }); setCurrentPage(p => p - 1); }
  };
  const handleNextPage = () => {
    if (currentPage < totalPages) { setPan({ x: 0, y: 0 }); setCurrentPage(p => p + 1); }
  };
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 8));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleFit = () => { setZoom(1.0); setPan({ x: 0, y: 0 }); };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (showCalibration && calibrationMode === 'manual') return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  };
  const handleMouseUp = () => setIsPanning(false);

  // Manual calibration point selection
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!showCalibration || calibrationMode !== 'manual') return;
    if (!canvasRef.current || !pdfViewport) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    // Convert to normalized coordinates (0.0 - 1.0)
    const normX = clickX / rect.width;
    const normY = clickY / rect.height;
    setCalibPoints(prev => {
      if (prev.length >= 2) return [{ x: normX, y: normY }];
      return [...prev, { x: normX, y: normY }];
    });
  };

  // Calculate pixel distance between two normalized points
  const calcPixelDistance = (pts: CalibrationPoint[], viewport: { width: number; height: number }): number => {
    if (pts.length < 2) return 0;
    const dx = (pts[1].x - pts[0].x) * viewport.width * zoom;
    const dy = (pts[1].y - pts[0].y) * viewport.height * zoom;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Save preset calibration
  const savePresetCalibration = async () => {
    if (!selectedPreset) return;
    const preset = PRESET_SCALES.find(p => p.ratio === selectedPreset);
    if (!preset) return;
    const scaleFactor = preset.value / 1000; // mm at paper / mm real-world simplification; will be refined
    const cal: DBTenderDrawingCalibration = {
      id: pageCalibration?.id ?? crypto.randomUUID(),
      org_id: store.currentOrgId ?? '',
      tender_id: tenderId,
      drawing_id: drawing.id,
      page_number: currentPage,
      method: 'preset',
      scale_ratio: preset.ratio,
      scale_value: preset.value,
      unit: calibUnit,
      reference_distance: null,
      pixel_distance: null,
      scale_factor: scaleFactor,
      calibration_points: null,
      created_at: pageCalibration?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await store.upsertTenderDrawingCalibration(cal);
    setPageCalibration(cal);
  };

  // Save manual calibration
  const saveManualCalibration = async () => {
    if (calibPoints.length < 2 || !knownDistance || !pdfViewport) return;
    const dist = parseFloat(knownDistance);
    if (!dist || dist <= 0) return;
    const pixelDist = calcPixelDistance(calibPoints, pdfViewport);
    if (pixelDist <= 0) return;
    // scale_factor = real-world units per normalized coordinate unit
    // normalized distance = pixelDist / (viewport.width * zoom) — but we use both dims
    // For simplicity: scale_factor = knownDistance / pixelDist (units per pixel at current zoom)
    // Then for measurements: realDistance = pixelDistance * scale_factor
    // But we want it zoom-independent: normalize pixel distance
    const normDist = pixelDist / zoom;
    const scaleFactor = dist / normDist;

    const cal: DBTenderDrawingCalibration = {
      id: pageCalibration?.id ?? crypto.randomUUID(),
      org_id: store.currentOrgId ?? '',
      tender_id: tenderId,
      drawing_id: drawing.id,
      page_number: currentPage,
      method: 'manual',
      scale_ratio: null,
      scale_value: null,
      unit: calibUnit,
      reference_distance: dist,
      pixel_distance: pixelDist / zoom,
      scale_factor: scaleFactor,
      calibration_points: calibPoints,
      created_at: pageCalibration?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await store.upsertTenderDrawingCalibration(cal);
    setPageCalibration(cal);
  };

  const clearCalibration = () => {
    setCalibPoints([]);
    setKnownDistance('');
    setCalibrationMode('none');
    setSelectedPreset('');
  };

  return (
    <div className="fixed inset-0 bg-[#0d1628] z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a] shrink-0 bg-[#1a2236]">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors shrink-0">
            <ArrowLeft size={14} />Back
          </button>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{drawing.drawing_number && `${drawing.drawing_number} — `}{drawing.title}</p>
            <p className="text-[10px] text-slate-500">Rev {drawing.revision} · {drawing.discipline} · {drawing.file_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Page navigation */}
          <div className="flex items-center gap-1 px-2">
            <button onClick={handlePrevPage} disabled={currentPage <= 1} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-slate-400 font-mono whitespace-nowrap">{currentPage} / {totalPages}</span>
            <button onClick={handleNextPage} disabled={currentPage >= totalPages} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] disabled:opacity-30 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          {/* Zoom controls */}
          <div className="flex items-center gap-1 px-2 border-l border-[#1e2d4a]">
            <button onClick={handleZoomOut} disabled={zoom <= 0.25} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] disabled:opacity-30 transition-colors">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-slate-400 font-mono w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
            <button onClick={handleZoomIn} disabled={zoom >= 8} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] disabled:opacity-30 transition-colors">
              <ZoomIn size={16} />
            </button>
            <button onClick={handleFit} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] transition-colors" title="Fit / Reset">
              <Maximize size={16} />
            </button>
          </div>
          {/* Calibration toggle */}
          <button
            onClick={() => setShowCalibration(!showCalibration)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showCalibration ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#1e2d4a] hover:text-white'}`}
          >
            <Ruler size={14} />Calibrate
          </button>
        </div>
      </div>

      {/* Calibration panel */}
      {showCalibration && (
        <div className="px-4 py-3 border-b border-[#1e2d4a] bg-[#1a2236] shrink-0">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Method:</span>
              <button
                onClick={() => { setCalibrationMode('preset'); setCalibPoints([]); }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${calibrationMode === 'preset' ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#1e2d4a]'}`}
              >Preset Scale</button>
              <button
                onClick={() => { setCalibrationMode('manual'); setSelectedPreset(''); }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${calibrationMode === 'manual' ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#1e2d4a]'}`}
              >Manual Distance</button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Unit:</span>
              <select value={calibUnit} onChange={e => setCalibUnit(e.target.value)} className="px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none">
                <option value="m">m</option>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
              </select>
            </div>

            {/* Preset scale selection */}
            {calibrationMode === 'preset' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Scale:</span>
                {PRESET_SCALES.map(s => (
                  <button
                    key={s.ratio}
                    onClick={() => setSelectedPreset(s.ratio)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${selectedPreset === s.ratio ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#1e2d4a]'}`}
                  >{s.label}</button>
                ))}
                <button
                  onClick={savePresetCalibration}
                  disabled={!selectedPreset}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 transition-colors"
                ><Check size={12} />Save</button>
              </div>
            )}

            {/* Manual calibration */}
            {calibrationMode === 'manual' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">
                  {calibPoints.length === 0 && 'Click point A on the drawing'}
                  {calibPoints.length === 1 && 'Click point B on the drawing'}
                  {calibPoints.length === 2 && 'Enter known distance and save'}
                </span>
                {calibPoints.length === 2 && (
                  <>
                    <input
                      type="number"
                      value={knownDistance}
                      onChange={e => setKnownDistance(e.target.value)}
                      placeholder="Known distance"
                      step="any"
                      className="w-28 px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none focus:border-[#f97316]/50"
                    />
                    <span className="text-xs text-slate-500">{calibUnit}</span>
                    <button
                      onClick={saveManualCalibration}
                      disabled={!knownDistance}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 transition-colors"
                    ><Check size={12} />Save</button>
                  </>
                )}
                {(calibPoints.length > 0 || knownDistance) && (
                  <button onClick={clearCalibration} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] hover:bg-[#1e2d4a] transition-colors">
                    <X size={12} />Reset
                  </button>
                )}
              </div>
            )}

            {/* Current calibration status */}
            {pageCalibration && pageCalibration.method !== 'none' && (
              <div className="text-xs text-emerald-400 font-semibold ml-auto">
                Page {currentPage} calibrated: {pageCalibration.method === 'preset' ? pageCalibration.scale_ratio : `${pageCalibration.reference_distance}${pageCalibration.unit} manual`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF canvas area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative bg-[#0a1020] flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : (showCalibration && calibrationMode === 'manual' ? 'crosshair' : 'grab') }}
      >
        {renderState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
          </div>
        )}

        {renderState === 'error' && (
          <div className="flex flex-col items-center justify-center text-center px-6">
            <AlertCircle size={32} className="text-red-400 mb-3" />
            <p className="text-sm text-red-300 mb-2">{errorMsg}</p>
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors">Back to Drawings</button>
          </div>
        )}

        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transition: isPanning ? 'none' : 'transform 0.05s',
          }}
          onClick={handleCanvasClick}
        >
          <canvas ref={canvasRef} className="shadow-2xl" />

          {/* Calibration point markers */}
          {showCalibration && calibrationMode === 'manual' && calibPoints.map((pt, i) => {
            if (!canvasRef.current) return null;
            const canvas = canvasRef.current;
            const left = pt.x * canvas.offsetWidth;
            const top = pt.y * canvas.offsetHeight;
            return (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: `${left - 8}px`,
                  top: `${top - 8}px`,
                }}
              >
                <div className={`w-4 h-4 rounded-full border-2 ${i === 0 ? 'bg-emerald-500 border-emerald-300' : 'bg-[#f97316] border-orange-300'} flex items-center justify-center`}>
                  <span className="text-[8px] font-bold text-white">{i === 0 ? 'A' : 'B'}</span>
                </div>
              </div>
            );
          })}

          {/* Line between calibration points */}
          {showCalibration && calibrationMode === 'manual' && calibPoints.length === 2 && canvasRef.current && (
            <svg
              className="absolute pointer-events-none top-0 left-0"
              width={canvasRef.current.offsetWidth}
              height={canvasRef.current.offsetHeight}
              style={{ position: 'absolute', left: 0, top: 0 }}
            >
              <line
                x1={calibPoints[0].x * canvasRef.current.offsetWidth}
                y1={calibPoints[0].y * canvasRef.current.offsetHeight}
                x2={calibPoints[1].x * canvasRef.current.offsetWidth}
                y2={calibPoints[1].y * canvasRef.current.offsetHeight}
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
