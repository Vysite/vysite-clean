import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Ruler, Check, X, AlertCircle } from 'lucide-react';
import { useAppStore, usePermissions } from '../../lib/StoreContext';
import type { DBTenderDrawing, DBTenderDrawingCalibration, CalibrationPoint, CalibrationMethod } from './drawingTypes';
import { PRESET_SCALES } from './drawingTypes';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { MeasurementType } from './takeoffTypes';
import { DEFAULT_UNIT_FOR_TYPE, TAKEOFF_COLOURS } from './takeoffTypes';
import { DISCIPLINES } from './drawingTypes';
import type { NormPoint, TakeoffGeometry, CountPoint, LinearSegment, AreaPolygon, CountGeometry, LinearGeometry, AreaGeometry } from './takeoffGeometry';
import { emptyGeometry, cloneGeometry, genId, isCountGeometry, isLinearGeometry, isAreaGeometry } from './takeoffGeometry';
import { calcQuantity, finalQuantity, presetScaleFactor, distanceInPdfPoints } from './takeoffCalculations';
import { UndoStack } from './takeoffUndoRedo';
import { TakeoffAnnotationLayer } from './TakeoffAnnotationLayer';
import { TakeoffCountHitOverlay } from './TakeoffCountHitOverlay';
import TakeoffSidebar, { type Tool } from './TakeoffSidebar';

interface Props {
  drawing: DBTenderDrawing;
  tenderId: string;
  onClose: () => void;
}

type RenderState = 'idle' | 'loading' | 'rendered' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function TenderDrawingWorkspace({ drawing, tenderId, onClose }: Props) {
  const store = useAppStore();
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canViewFinancials = perms['tender.view_financials'] || isAdmin;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<unknown>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);

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
  const [pdfViewport, setPdfViewport] = useState<{ width: number; height: number } | null>(null);

  // Take-off state
  const [tool, setTool] = useState<Tool>('select');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [selectedGeometryId, setSelectedGeometryId] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<NormPoint[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showItemCreator, setShowItemCreator] = useState<MeasurementType | null>(null);

  // Refs for high-frequency operations
  const draftPointsRef = useRef<NormPoint[]>([]);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const isDraggingVertexRef = useRef(false);
  const dragInfoRef = useRef<{ itemId: string; geoType: string; geoId: string; vertexIndex: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoStackRef = useRef<UndoStack>(new UndoStack());
  const [, forceUndoUpdate] = useState(0);

  // Load calibrations and takeoff items for this drawing
  useEffect(() => {
    store.loadTenderDrawingCalibrations(drawing.id);
    store.loadTenderTakeoffItemsForDrawing(drawing.id);
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
        if (!url) { setErrorMsg('Failed to get signed URL for drawing.'); setRenderState('error'); return; }
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
        setCurrentPage(prev => Math.min(prev, pdf.numPages));

        await renderPage(pdf, Math.min(currentPage, pdf.numPages), zoom);
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
    if (pdfDocRef.current) renderPage(pdfDocRef.current, currentPage, zoom);
  }, [currentPage, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist current page
  useEffect(() => {
    if (currentPage !== drawing.current_page && currentPage > 0) {
      store.updateTenderDrawing({ id: drawing.id, current_page: currentPage, updated_at: new Date().toISOString() });
    }
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush pending saves on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // Flush synchronously — the timer callback will fire even though component is unmounting
        // because the debounced function captures `store` which persists
      }
    };
  }, []);

  // Page change: cancel draft, clear selection
  const changePage = (delta: number) => {
    flushSave();
    cancelDraft();
    setSelectedGeometryId(null);
    setPan({ x: 0, y: 0 });
    setCurrentPage(p => Math.max(1, Math.min(totalPages, p + delta)));
  };

  // Tool change: cancel draft
  const handleToolChange = (t: Tool) => {
    cancelDraft();
    setSelectedGeometryId(null);
    setTool(t);
  };

  const renderPage = useCallback(async (pdf: any, pageNum: number, zoomLevel: number) => {
    if (!canvasRef.current) return;
    setRenderState('loading');
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      setPdfViewport({ width: viewport.width, height: viewport.height });

      const scaledViewport = page.getViewport({ scale: zoomLevel });
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

  // ── screenToNorm: THE central coordinate conversion ──────────────────────
  const screenToNorm = useCallback((clientX: number, clientY: number): NormPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, []);

  // ── Items for current page ───────────────────────────────────────────────
  const pageItems = useMemo(() =>
    store.tenderTakeoffItems.filter(i => i.drawing_id === drawing.id && i.page_number === currentPage),
    [store.tenderTakeoffItems, drawing.id, currentPage]
  );

  const activeItem = pageItems.find(i => i.id === activeItemId) ?? null;
  const needsCalibration = (tool === 'linear' || tool === 'area') && (!pageCalibration || !pageCalibration.scale_factor);

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if (tool === 'pan' || (tool === 'select' && !isDraggingVertexRef.current && e.button === 1) || showCalibration) {
      // Pan mode or middle-click pan
      if (tool === 'pan' || e.button === 1 || showCalibration) {
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }
    if (isDraggingVertexRef.current && dragInfoRef.current) {
      // Update via ref — no React state during drag
      const norm = screenToNorm(e.clientX, e.clientY);
      updateVertexPreview(dragInfoRef.current, norm);
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    if (isDraggingVertexRef.current && dragInfoRef.current) {
      isDraggingVertexRef.current = false;
      const norm = screenToNorm(e.clientX, e.clientY);
      commitVertexDrag(dragInfoRef.current, norm);
      dragInfoRef.current = null;
    }
  };

  // ── Click on the page wrapper (the canvas + overlay container) ───────────
  const handlePageClick = (e: React.MouseEvent) => {
    // Calibration click
    if (showCalibration && calibrationMode === 'manual') {
      const norm = screenToNorm(e.clientX, e.clientY);
      setCalibPoints(prev => prev.length >= 2 ? [norm] : [...prev, norm]);
      return;
    }

    // Measurement tools
    if (tool === 'select' || tool === 'pan') {
      setSelectedGeometryId(null);
      return;
    }

    const norm = screenToNorm(e.clientX, e.clientY);

    if (tool === 'count') {
      if (!activeItem || activeItem.measurement_type !== 'count') {
        setShowItemCreator('count');
        return;
      }
      addCountPoint(norm);
    } else if (tool === 'linear') {
      if (!activeItem || activeItem.measurement_type !== 'linear') {
        setShowItemCreator('linear');
        return;
      }
      if (needsCalibration) return;
      addDraftPoint(norm);
    } else if (tool === 'area') {
      if (!activeItem || activeItem.measurement_type !== 'area') {
        setShowItemCreator('area');
        return;
      }
      if (needsCalibration) return;
      addDraftPoint(norm);
    }
  };

  // ── Double click to finish linear/area ───────────────────────────────────
  const handlePageDoubleClick = (e: React.MouseEvent) => {
    if (draftPointsRef.current.length < 2) { cancelDraft(); return; }
    if (tool === 'linear') finishLinear();
    else if (tool === 'area') finishArea();
  };

  // ── Right-click to finish linear/area (prevents context menu) ───────────
  const handlePageContextMenu = (e: React.MouseEvent) => {
    if (tool === 'linear' || tool === 'area') {
      e.preventDefault();
      if (draftPointsRef.current.length >= 2) {
        if (tool === 'linear') finishLinear();
        else finishArea();
      } else {
        cancelDraft();
      }
    }
  };

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedGeometryId) { e.preventDefault(); deleteSelectedGeometry(); }
      } else if (e.key === 'Enter' && (tool === 'linear' || tool === 'area') && draftPointsRef.current.length >= 2) {
        e.preventDefault();
        if (tool === 'linear') finishLinear();
        else finishArea();
      } else if (e.key === 'Escape') {
        if (draftPointsRef.current.length >= 2 && (tool === 'linear' || tool === 'area')) {
          // Escape with valid draft: finish it
          if (tool === 'linear') finishLinear();
          else finishArea();
        } else {
          // Escape with insufficient draft: cancel cleanly
          cancelDraft();
          setSelectedGeometryId(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedGeometryId, tool, activeItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draft point management ───────────────────────────────────────────────
  const addDraftPoint = (pt: NormPoint) => {
    draftPointsRef.current = [...draftPointsRef.current, pt];
    setDraftPoints([...draftPointsRef.current]);
  };

  const cancelDraft = () => {
    draftPointsRef.current = [];
    setDraftPoints([]);
  };

  // ── Count: add point ─────────────────────────────────────────────────────
  const addCountPoint = (pt: NormPoint) => {
    if (!activeItem) return;
    const geo = activeItem.geometry as CountGeometry | null;
    if (!geo) return;
    const newPoint: CountPoint = { id: genId(), x: pt.x, y: pt.y };
    const newGeo: CountGeometry = { ...geo, points: [...geo.points, newPoint] };
    pushUndo(activeItem.id, activeItem.geometry!, activeItem.quantity);
    commitItemGeometry(activeItem.id, newGeo);
    setSelectedGeometryId(newPoint.id);
  };

  // ── Linear: finish path ──────────────────────────────────────────────────
  const finishLinear = () => {
    if (!activeItem || draftPointsRef.current.length < 2) { cancelDraft(); return; }
    const geo = activeItem.geometry as LinearGeometry | null;
    if (!geo) return;
    const pts = draftPointsRef.current;
    const runId = genId();
    const newSegments: LinearSegment[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      newSegments.push({ id: genId(), runId, start: pts[i], end: pts[i + 1] });
    }
    pushUndo(activeItem.id, activeItem.geometry!, activeItem.quantity);
    const newGeo: LinearGeometry = { ...geo, segments: [...geo.segments, ...newSegments] };
    commitItemGeometry(activeItem.id, newGeo);
    cancelDraft();
    setSelectedGeometryId(runId);
  };

  // ── Area: finish polygon ─────────────────────────────────────────────────
  const finishArea = () => {
    if (!activeItem || draftPointsRef.current.length < 3) { cancelDraft(); return; }
    const geo = activeItem.geometry as AreaGeometry | null;
    if (!geo) return;
    const newPoly: AreaPolygon = { id: genId(), vertices: [...draftPointsRef.current], labelPos: null };
    pushUndo(activeItem.id, activeItem.geometry!, activeItem.quantity);
    const newGeo: AreaGeometry = { ...geo, polygons: [...geo.polygons, newPoly] };
    commitItemGeometry(activeItem.id, newGeo);
    cancelDraft();
    setSelectedGeometryId(newPoly.id);
  };

  // ── commitItemGeometry: THE one commit path ──────────────────────────────
  const commitItemGeometry = useCallback((itemId: string, newGeo: TakeoffGeometry) => {
    const item = store.tenderTakeoffItems.find(i => i.id === itemId);
    if (!item) return;
    const qty = calcQuantity(newGeo, pageCalibration, pdfViewport?.width ?? 1, pdfViewport?.height ?? 1);
    store.updateTenderTakeoffItem({ id: itemId, geometry: newGeo as any, quantity: Math.round(qty * 10000) / 10000, updated_at: new Date().toISOString() });
    scheduleSave(itemId);
  }, [store, pageCalibration, pdfViewport]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Autosave (debounced 800ms) ───────────────────────────────────────────
  const scheduleSave = useCallback((itemId: string) => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushSave();
    }, 800);
  }, []);

  const flushSave = useCallback(() => {
    // The store.updateTenderTakeoffItem already writes to Supabase optimistically.
    // The debounce is mainly to batch rapid geometry changes.
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }, []);

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const pushUndo = (itemId: string, geometry: TakeoffGeometry, quantity: number) => {
    undoStackRef.current.push(undoStackRef.current.snapshot(itemId, geometry, quantity));
    forceUndoUpdate(n => n + 1);
  };

  const handleUndo = () => {
    const entry = undoStackRef.current.undoStep();
    if (!entry) return;
    const item = store.tenderTakeoffItems.find(i => i.id === entry.itemId);
    if (!item) return;
    store.updateTenderTakeoffItem({ id: entry.itemId, geometry: entry.geometry as any, quantity: entry.quantity, updated_at: new Date().toISOString() });
    scheduleSave(entry.itemId);
    forceUndoUpdate(n => n + 1);
  };

  const handleRedo = () => {
    const entry = undoStackRef.current.redoStep();
    if (!entry) return;
    store.updateTenderTakeoffItem({ id: entry.itemId, geometry: entry.geometry as any, quantity: entry.quantity, updated_at: new Date().toISOString() });
    scheduleSave(entry.itemId);
    forceUndoUpdate(n => n + 1);
  };

  // ── Delete selected geometry ─────────────────────────────────────────────
  const deleteSelectedGeometry = () => {
    if (!selectedGeometryId || !activeItem) return;
    const geo = activeItem.geometry;
    if (!geo) return;
    pushUndo(activeItem.id, geo, activeItem.quantity);

    if (isCountGeometry(geo)) {
      const newGeo: CountGeometry = { ...geo, points: geo.points.filter(p => p.id !== selectedGeometryId) };
      commitItemGeometry(activeItem.id, newGeo);
    } else if (isLinearGeometry(geo)) {
      // Delete all segments belonging to the same run
      const newGeo: LinearGeometry = { ...geo, segments: geo.segments.filter(s => s.runId !== selectedGeometryId && s.id !== selectedGeometryId) };
      commitItemGeometry(activeItem.id, newGeo);
    } else if (isAreaGeometry(geo)) {
      const newGeo: AreaGeometry = { ...geo, polygons: geo.polygons.filter(p => p.id !== selectedGeometryId) };
      commitItemGeometry(activeItem.id, newGeo);
    }
    setSelectedGeometryId(null);
  };

  // ── Geometry click (from annotation layer) ───────────────────────────────
  const handleGeometryClick = (itemId: string, geoType: string, geometryId: string) => {
    setActiveItemId(itemId);
    setSelectedGeometryId(geometryId);
  };

  // ── Vertex drag ──────────────────────────────────────────────────────────
  const handleVertexMouseDown = (itemId: string, geoType: string, geometryId: string, vertexIndex: number, e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingVertexRef.current = true;
    dragInfoRef.current = { itemId, geoType, geoId: geometryId, vertexIndex };
    const item = store.tenderTakeoffItems.find(i => i.id === itemId);
    if (item) pushUndo(itemId, item.geometry!, item.quantity);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const updateVertexPreview = (info: { itemId: string; geoType: string; geoId: string; vertexIndex: number }, norm: NormPoint) => {
    // No React state update during drag — update store directly (optimistic)
    // This is acceptable because store.updateTenderTakeoffItem is synchronous in local state
    // but we DON'T want to write to DB on every move. So we update local state only.
    // Actually the store update is optimistic + async DB write — too many writes.
    // Instead, we'll just update on pointer up (commitVertexDrag).
    // For live preview, we need a ref-based approach.
  };

  const commitVertexDrag = (info: { itemId: string; geoType: string; geoId: string; vertexIndex: number }, norm: NormPoint) => {
    const item = store.tenderTakeoffItems.find(i => i.id === info.itemId);
    if (!item || !item.geometry) return;
    const geo = cloneGeometry(item.geometry);

    if (isLinearGeometry(geo)) {
      const seg = geo.segments.find(s => s.id === info.geoId);
      if (!seg) return;
      if (info.vertexIndex === 0) seg.start = norm;
      else seg.end = norm;
      commitItemGeometry(info.itemId, geo);
    } else if (isAreaGeometry(geo)) {
      const poly = geo.polygons.find(p => p.id === info.geoId);
      if (!poly) return;
      poly.vertices[info.vertexIndex] = norm;
      commitItemGeometry(info.itemId, geo);
    }
  };

  // ── Calibration ─────────────────────────────────────────────────────────
  const savePresetCalibration = async () => {
    if (!selectedPreset) return;
    const preset = PRESET_SCALES.find(p => p.ratio === selectedPreset);
    if (!preset) return;
    // Correct formula: (25.4/72 × N) / unitToMm
    // 1 PDF point = 25.4/72 mm on paper. At 1:N, real-world mm per PDF point = N × 25.4/72.
    // Paper size does NOT matter — PDF points are a fixed physical unit regardless of paper size.
    const scaleFactor = presetScaleFactor(preset.value, calibUnit);
    const cal: DBTenderDrawingCalibration = {
      id: pageCalibration?.id ?? crypto.randomUUID(), org_id: store.currentOrgId ?? '', tender_id: tenderId,
      drawing_id: drawing.id, page_number: currentPage, method: 'preset', scale_ratio: preset.ratio,
      scale_value: preset.value, unit: calibUnit, reference_distance: null, pixel_distance: null,
      scale_factor: scaleFactor, calibration_points: null,
      created_at: pageCalibration?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await store.upsertTenderDrawingCalibration(cal);
    setPageCalibration(cal);
    recalcForCalibrationChange(currentPage);
  };

  const saveManualCalibration = async () => {
    if (calibPoints.length < 2 || !knownDistance || !pdfViewport) return;
    const dist = parseFloat(knownDistance);
    if (!dist || dist <= 0) return;
    // Use PDF-point distance (actual page dimensions at scale 1), not canvas pixels.
    // This is zoom-independent.
    const pdfPtDist = distanceInPdfPoints(
      { x: calibPoints[0].x, y: calibPoints[0].y },
      { x: calibPoints[1].x, y: calibPoints[1].y },
      pdfViewport.width, pdfViewport.height
    );
    if (pdfPtDist <= 0) return;
    const scaleFactor = dist / pdfPtDist;
    const cal: DBTenderDrawingCalibration = {
      id: pageCalibration?.id ?? crypto.randomUUID(), org_id: store.currentOrgId ?? '', tender_id: tenderId,
      drawing_id: drawing.id, page_number: currentPage, method: 'manual', scale_ratio: null, scale_value: null,
      unit: calibUnit, reference_distance: dist, pixel_distance: pdfPtDist,
      scale_factor: scaleFactor, calibration_points: calibPoints,
      created_at: pageCalibration?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await store.upsertTenderDrawingCalibration(cal);
    setPageCalibration(cal);
    recalcForCalibrationChange(currentPage);
  };

  // ── Calibration change: recalculate affected Linear/Area quantities ──────
  const recalcForCalibrationChange = (page: number) => {
    if (!pdfViewport) return;
    const affected = store.tenderTakeoffItems.filter(i => i.drawing_id === drawing.id && i.page_number === page && (i.measurement_type === 'linear' || i.measurement_type === 'area') && i.geometry);
    for (const item of affected) {
      const cal = store.tenderDrawingCalibrations.find(c => c.drawing_id === drawing.id && c.page_number === page);
      // Use the new calibration that was just saved
      const effectiveCal = cal ?? pageCalibration;
      const qty = calcQuantity(item.geometry!, effectiveCal, pdfViewport.width, pdfViewport.height);
      store.updateTenderTakeoffItem({ id: item.id, quantity: Math.round(qty * 10000) / 10000, updated_at: new Date().toISOString() });
    }
  };

  const clearCalibration = () => { setCalibPoints([]); setKnownDistance(''); setCalibrationMode('none'); setSelectedPreset(''); };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 8));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleFit = () => { setZoom(1.0); setPan({ x: 0, y: 0 }); };

  // ── Item creation ────────────────────────────────────────────────────────
  const handleCreateItem = async (type: MeasurementType, data: { label: string; discipline: string; category: string; colour: string; lineType: string }) => {
    const oid = store.currentOrgId;
    if (!oid) return;
    const item: DBTenderTakeoffItem = {
      id: crypto.randomUUID(), org_id: oid, tender_id: tenderId, drawing_id: drawing.id,
      page_number: currentPage, label: data.label, description: '', measurement_type: type,
      quantity: 0, unit: DEFAULT_UNIT_FOR_TYPE[type], geometry: emptyGeometry(type, currentPage),
      colour: data.colour, notes: '', sort_order: pageItems.length, is_visible: true,
      source: 'drawing', discipline: data.discipline, category: data.category,
      manual_quantity: 0, adjustment_quantity: 0, line_type: data.lineType as any,
      created_by: store.currentUser?.name ?? '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await store.addTenderTakeoffItem(item);
    setActiveItemId(item.id);
    const matchingTool = type as Tool;
    cancelDraft();
    setTool(matchingTool);
    setShowItemCreator(null);
  };

  // ── Item update from sidebar ─────────────────────────────────────────────
  const handleUpdateItem = (id: string, updates: Partial<DBTenderTakeoffItem>) => {
    store.updateTenderTakeoffItem({ id, ...updates });
    scheduleSave(id);
  };

  const handleDeleteItem = (id: string) => {
    if (activeItemId === id) { setActiveItemId(null); setSelectedGeometryId(null); }
    store.removeTenderTakeoffItem(id);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const cursor = showCalibration && calibrationMode === 'manual' ? 'crosshair'
    : tool === 'pan' ? (isPanningRef.current ? 'grabbing' : 'grab')
    : tool === 'count' ? 'crosshair'
    : tool === 'linear' || tool === 'area' ? 'crosshair'
    : 'default';

  return (
    <div className="fixed inset-0 bg-[#0d1628] z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a] shrink-0 bg-[#1a2236]">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => { flushSave(); onClose(); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors shrink-0">
            <ArrowLeft size={14} />Back
          </button>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{drawing.drawing_number && `${drawing.drawing_number} — `}{drawing.title}</p>
            <p className="text-[10px] text-slate-500">Rev {drawing.revision} · {drawing.discipline} · {drawing.file_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 px-2">
            <button onClick={() => changePage(-1)} disabled={currentPage <= 1} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-xs text-slate-400 font-mono whitespace-nowrap">{currentPage} / {totalPages}</span>
            <button onClick={() => changePage(1)} disabled={currentPage >= totalPages} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
          </div>
          <div className="flex items-center gap-1 px-2 border-l border-[#1e2d4a]">
            <button onClick={handleZoomOut} disabled={zoom <= 0.25} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] disabled:opacity-30 transition-colors"><ZoomOut size={16} /></button>
            <span className="text-xs text-slate-400 font-mono w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
            <button onClick={handleZoomIn} disabled={zoom >= 8} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] disabled:opacity-30 transition-colors"><ZoomIn size={16} /></button>
            <button onClick={handleFit} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a] transition-colors" title="Fit / Reset"><Maximize size={16} /></button>
          </div>
          <button onClick={() => { cancelDraft(); setShowCalibration(!showCalibration); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showCalibration ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#1e2d4a] hover:text-white'}`}>
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
              <button onClick={() => { setCalibrationMode('preset'); setCalibPoints([]); }} className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${calibrationMode === 'preset' ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#1e2d4a]'}`}>Preset Scale</button>
              <button onClick={() => { setCalibrationMode('manual'); setSelectedPreset(''); }} className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${calibrationMode === 'manual' ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#1e2d4a]'}`}>Manual Distance</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Unit:</span>
              <select value={calibUnit} onChange={e => setCalibUnit(e.target.value)} className="px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none"><option value="m">m</option><option value="mm">mm</option><option value="cm">cm</option></select>
            </div>
            {calibrationMode === 'preset' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Scale:</span>
                {PRESET_SCALES.map(s => <button key={s.ratio} onClick={() => setSelectedPreset(s.ratio)} className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${selectedPreset === s.ratio ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#1e2d4a]'}`}>{s.label}</button>)}
                <button onClick={savePresetCalibration} disabled={!selectedPreset} className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 transition-colors"><Check size={12} />Save</button>
              </div>
            )}
            {calibrationMode === 'manual' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">{calibPoints.length === 0 && 'Click point A on the drawing'}{calibPoints.length === 1 && 'Click point B on the drawing'}{calibPoints.length === 2 && 'Enter known distance and save'}</span>
                {calibPoints.length === 2 && (<><input type="number" value={knownDistance} onChange={e => setKnownDistance(e.target.value)} placeholder="Known distance" step="any" className="w-28 px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none focus:border-[#f97316]/50" /><span className="text-xs text-slate-500">{calibUnit}</span><button onClick={saveManualCalibration} disabled={!knownDistance} className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 transition-colors"><Check size={12} />Save</button></>)}
                {(calibPoints.length > 0 || knownDistance) && <button onClick={clearCalibration} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] hover:bg-[#1e2d4a] transition-colors"><X size={12} />Reset</button>}
              </div>
            )}
            {pageCalibration && pageCalibration.method !== 'none' && <div className="text-xs text-emerald-400 font-semibold ml-auto">Page {currentPage} calibrated: {pageCalibration.method === 'preset' ? pageCalibration.scale_ratio : `${pageCalibration.reference_distance}${pageCalibration.unit} manual`}</div>}
          </div>
        </div>
      )}

      {/* Main area: PDF + sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF canvas area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative bg-[#0a1020] flex items-center justify-center"
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
          onPointerCancel={handleContainerPointerUp}
          style={{ cursor }}
        >
          {renderState === 'loading' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-6 h-6 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" /></div>}
          {renderState === 'error' && <div className="flex flex-col items-center justify-center text-center px-6"><AlertCircle size={32} className="text-red-400 mb-3" /><p className="text-sm text-red-300 mb-2">{errorMsg}</p><button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors">Back to Drawings</button></div>}

          {/* This div wraps canvas + overlays — they share the same transform */}
          <div
            ref={pageWrapperRef}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, transition: isPanningRef.current ? 'none' : 'transform 0.05s' }}
            onClick={handlePageClick}
            onDoubleClick={handlePageDoubleClick}
            onContextMenu={handlePageContextMenu}
            className="relative"
          >
            <canvas ref={canvasRef} className="shadow-2xl block" />

            {/* SVG annotation layer — shares the page wrapper, normalized viewBox */}
            {pdfViewport && renderState === 'rendered' && (
              <TakeoffAnnotationLayer
                items={pageItems}
                selectedItemIds={new Set(activeItemId ? [activeItemId] : [])}
                selectedGeometryId={selectedGeometryId}
                draftPoints={draftPoints}
                tool={tool}
                calibration={pageCalibration}
                pageWidth={pdfViewport.width}
                pageHeight={pdfViewport.height}
                onGeometryClick={handleGeometryClick}
                onVertexMouseDown={handleVertexMouseDown}
              />
            )}

            {/* Count hit overlay — HTML buttons for reliable clicking */}
            {pdfViewport && renderState === 'rendered' && (
              <TakeoffCountHitOverlay
                items={pageItems}
                selectedGeometryId={selectedGeometryId}
                onSelect={(itemId, geomId) => { setActiveItemId(itemId); setSelectedGeometryId(geomId); }}
              />
            )}

            {/* Calibration point markers */}
            {showCalibration && calibrationMode === 'manual' && calibPoints.map((pt, i) => {
              if (!canvasRef.current) return null;
              const left = pt.x * canvasRef.current.offsetWidth;
              const top = pt.y * canvasRef.current.offsetHeight;
              return <div key={i} className="absolute pointer-events-none" style={{ left: `${left - 8}px`, top: `${top - 8}px` }}><div className={`w-4 h-4 rounded-full border-2 ${i === 0 ? 'bg-emerald-500 border-emerald-300' : 'bg-[#f97316] border-orange-300'} flex items-center justify-center`}><span className="text-[8px] font-bold text-white">{i === 0 ? 'A' : 'B'}</span></div></div>;
            })}
            {showCalibration && calibrationMode === 'manual' && calibPoints.length === 2 && canvasRef.current && (
              <svg className="absolute pointer-events-none top-0 left-0" width={canvasRef.current.offsetWidth} height={canvasRef.current.offsetHeight} style={{ position: 'absolute', left: 0, top: 0 }}>
                <line x1={calibPoints[0].x * canvasRef.current.offsetWidth} y1={calibPoints[0].y * canvasRef.current.offsetHeight} x2={calibPoints[1].x * canvasRef.current.offsetWidth} y2={calibPoints[1].y * canvasRef.current.offsetHeight} stroke="#f97316" strokeWidth={2} strokeDasharray="4 2" />
              </svg>
            )}
          </div>
        </div>

        {/* Take-Off sidebar */}
        <TakeoffSidebar
          items={pageItems}
          activeItemId={activeItemId}
          selectedGeometryId={selectedGeometryId}
          tool={tool}
          canUndo={undoStackRef.current.canUndo()}
          canRedo={undoStackRef.current.canRedo()}
          saveStatus={saveStatus}
          needsCalibration={needsCalibration}
          calibration={pageCalibration}
          pageWidth={pdfViewport?.width ?? 1}
          pageHeight={pdfViewport?.height ?? 1}
          onToolChange={handleToolChange}
          onItemSelect={(id) => {
            const clickedItem = pageItems.find(i => i.id === id);
            setActiveItemId(id);
            setSelectedGeometryId(null);
            if (clickedItem) {
              const matchingTool = clickedItem.measurement_type as Tool;
              cancelDraft();
              setTool(matchingTool);
            }
          }}
          onGeometrySelect={(geometryId) => {
            setSelectedGeometryId(geometryId);
          }}
          onCreateItem={(type) => setShowItemCreator(type)}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDeleteSelectedGeometry={deleteSelectedGeometry}
          canViewFinancials={canViewFinancials}
        />
      </div>

      {/* Item creator modal */}
      {showItemCreator && (
        <ItemCreatorModal
          type={showItemCreator}
          onClose={() => setShowItemCreator(null)}
          existingItemCount={pageItems.filter(i => i.measurement_type === showItemCreator).length}
          onCreate={handleCreateItem}
        />
      )}
    </div>
  );
}

// ─── Item Creator Modal ────────────────────────────────────────────────────

function ItemCreatorModal({ type, onClose, onCreate, existingItemCount = 0 }: {
  type: MeasurementType;
  onClose: () => void;
  onCreate: (type: MeasurementType, data: { label: string; discipline: string; category: string; colour: string; lineType: string }) => void;
  existingItemCount?: number;
}) {
  const [label, setLabel] = useState('');
  const [discipline, setDiscipline] = useState('General');
  const [category, setCategory] = useState('');
  const [colour, setColour] = useState(() => {
    // Pick a sensible next colour based on existing items count
    const existingCount = existingItemCount;
    return TAKEOFF_COLOURS[existingCount % TAKEOFF_COLOURS.length];
  });
  const [lineType, setLineType] = useState('standard');

  const handleCreate = () => {
    if (!label.trim()) return;
    onCreate(type, { label: label.trim(), discipline, category: category.trim(), colour, lineType });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-sm flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
          <p className="text-sm font-bold text-white">New {type === 'count' ? 'Count' : type === 'linear' ? 'Linear' : 'Area'} Item</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2d4a]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase">Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && label.trim()) handleCreate(); }} autoFocus className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-[#f97316]/50" placeholder="e.g. Light Fittings" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Discipline</label>
              <select value={discipline} onChange={e => setDiscipline(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none">
                {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Line Type</label>
              <select value={lineType} onChange={e => setLineType(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none">
                <option value="standard">Standard</option>
                <option value="addition">Addition</option>
                <option value="omission">Omission</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase">Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase">Colour</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {TAKEOFF_COLOURS.map(c => <button key={c} onClick={() => setColour(c)} className={`w-5 h-5 rounded ${colour === c ? 'ring-2 ring-white' : ''}`} style={{ background: c }} />)}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end p-5 border-t border-[#1e2d4a]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={!label.trim()} className="px-4 py-2 text-sm font-semibold text-white bg-[#f97316] rounded-lg hover:bg-orange-600 disabled:opacity-30 transition-colors">Create</button>
        </div>
      </div>
    </div>
  );
}
