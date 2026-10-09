// Fetches the official VYSITE logo and returns it as a base64 data URL so it
// renders inside blob:-based print tabs where relative/absolute HTTP paths fail.
// Cached after the first successful fetch.
let _logoCache: string | null = null;

export async function vysiteLogoDataUrl(): Promise<string> {
  if (_logoCache) return _logoCache;
  try {
    const res = await fetch('/VYSITE_Logo_Long.png');
    if (!res.ok) throw new Error(`logo fetch failed: ${res.status}`);
    const blob = await res.blob();
    _logoCache = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return _logoCache;
  } catch {
    return ''; // callers handle empty string — no broken img icon
  }
}

// Opens a self-contained HTML string in a new browser tab and auto-triggers the
// browser's native print dialog inside that tab. The current page is never touched,
// so React state, Supabase auth listeners, and focus/visibility events are
// completely unaffected.
export function openPrintTab(html: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  if (tab) {
    tab.addEventListener('afterprint', () => URL.revokeObjectURL(url), { once: true });
  } else {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

// Opens a blank print tab synchronously (within the user-gesture) and returns a
// controller that lets you write the final HTML into it after async work completes.
// This avoids the browser popup-blocker that triggers when window.open is called
// after awaits.  The tab shows a loading page immediately, then gets replaced.
export interface PrintTabController {
  tab: Window | null;
  setHTML: (html: string) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function openPrintTabLoading(): PrintTabController {
  const loadingHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Preparing export…</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wrap{text-align:center}.spin{width:40px;height:40px;border:3px solid #1e2d4a;border-top-color:#f97316;border-radius:50%;animation:sp 0.8s linear infinite;margin:0 auto 16px}@keyframes sp{to{transform:rotate(360deg)}}
.label{color:#94a3b8;font-size:14px;font-weight:600}</style></head>
<body><div class="wrap"><div class="spin"></div><div class="label">Preparing PDF export…</div></div></body></html>`;
  const blob = new Blob([loadingHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  let currentUrl = url;

  const setHTML = (html: string) => {
    if (!tab || tab.closed) return;
    const newBlob = new Blob([html], { type: 'text/html' });
    const newUrl = URL.createObjectURL(newBlob);
    tab.location.href = newUrl;
    URL.revokeObjectURL(currentUrl);
    currentUrl = newUrl;
    tab.addEventListener('afterprint', () => URL.revokeObjectURL(newUrl), { once: true });
  };

  const close = () => {
    if (tab && !tab.closed) tab.close();
    URL.revokeObjectURL(currentUrl);
  };

  const isOpen = () => !!tab && !tab.closed;

  if (!tab) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return { tab, setHTML, close, isOpen };
}

// Fetches full site form records in controlled chunks (limited concurrency).
// Returns results in the same order as the input IDs.  Uses a single Supabase
// .in() query per chunk (default 25 IDs) rather than N sequential queries.
//
// onProgress is called after each chunk completes with (loaded, total).
// If any ID fails to fetch, it is reported in the errors array with the ID
// and reason — it is never silently skipped.
export interface BatchFetchResult<T> {
  records: T[];
  errors: { id: string; reason: string }[];
}

export async function batchFetchSiteForms<T>(
  ids: string[],
  fetchChunk: (chunkIds: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  onProgress?: (loaded: number, total: number) => void,
  chunkSize = 25,
): Promise<BatchFetchResult<T>> {
  const records: T[] = [];
  const errors: { id: string; reason: string }[] = [];
  const idToIndex = new Map<string, number>();
  const fetchedMap = new Map<string, T>();

  for (let i = 0; i < ids.length; i++) idToIndex.set(ids[i], i);

  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunkIds = ids.slice(start, start + chunkSize);
    const { data, error } = await fetchChunk(chunkIds);
    if (error) {
      for (const id of chunkIds) {
        errors.push({ id, reason: error.message });
      }
    } else if (data) {
      for (const row of data) {
        const rowId = (row as unknown as { id?: string }).id;
        if (rowId) fetchedMap.set(rowId, row);
      }
      for (const id of chunkIds) {
        if (!fetchedMap.has(id)) {
          errors.push({ id, reason: 'Record not found or inaccessible' });
        }
      }
    }
    if (onProgress) onProgress(Math.min(start + chunkSize, ids.length), ids.length);
  }

  for (const id of ids) {
    const rec = fetchedMap.get(id);
    if (rec) records.push(rec);
  }

  return { records, errors };
}

// Wraps arbitrary body HTML in a full print-ready document shell.
export function buildPrintDocument(title: string, styles: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:white;padding:40px;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{margin:0;size:A4}
    ${styles}
    @media print{body{padding:24px}}
  </style>
</head>
<body>
${body}
<script>window.onload=function(){window.print();};<\/script>
</body>
</html>`;
}
