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
