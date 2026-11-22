/* global Buffer */
/* eslint-disable no-unused-vars -- callback parameter names describe the Electron window port. */
type Event = { preventDefault(): void };
type WindowPort = {
  webContents: {
    on(event: 'will-navigate' | 'will-redirect' | 'will-attach-webview', listener: (event: Event, url: string) => void): unknown;
    setWindowOpenHandler(handler: () => { action: 'deny' }): unknown;
  };
  once(event: 'closed' | 'ready-to-show', listener: () => void): unknown;
  loadURL(url: string): Promise<unknown>;
  show(): void;
  close(): void;
  isDestroyed(): boolean;
};

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderReviewDocument(review: string, target: string, kind: 'Proposal' | 'Decision' = 'Proposal'): string {
  if (!/^https:\/\/review\.invalid\/confirm\/[a-z0-9-]{1,128}$/i.test(target)) throw new Error('Invalid review target');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Review ${kind}</title><style>body{font:16px sans-serif;margin:24px} pre{white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;max-height:65vh;border:1px solid #777;padding:12px} a{display:inline-block;padding:12px}</style></head>
<body><h1>Review ${kind}</h1><p>This acknowledgement does not authorize execution. Review all fields below.</p>
<pre>${escapeHtml(review)}</pre><a href="${target}">I reviewed these fields</a><p>Close this window to cancel.</p></body></html>`;
}

export function presentReview(review: string, token: string, factory: () => WindowPort, kind: 'Proposal' | 'Decision' = 'Proposal'): Promise<boolean> {
  const target = 'https://review.invalid/confirm/' + token;
  let html: string;
  try { html = renderReviewDocument(review, target, kind); } catch { return Promise.resolve(false); }
  return new Promise(resolve => {
    let child: WindowPort;
    try { child = factory(); } catch { resolve(false); return; }
    let accepted = false;
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(accepted); } };
    child.once('closed', finish);
    child.once('ready-to-show', () => { if (!child.isDestroyed()) child.show(); });
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    child.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      if (url === target && !settled) { accepted = true; child.close(); }
    });
    child.webContents.on('will-redirect', event => event.preventDefault());
    child.webContents.on('will-attach-webview', event => event.preventDefault());
    const data = 'data:text/html;charset=utf-8;base64,' + Buffer.from(html, 'utf8').toString('base64');
    void child.loadURL(data).catch(() => { accepted = false; if (!child.isDestroyed()) child.close(); finish(); });
  });
}
