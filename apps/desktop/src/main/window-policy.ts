/* global URL */
export type SecureWindowOptions = Readonly<{
  webPreferences: Readonly<{
    contextIsolation: true;
    sandbox: true;
    nodeIntegration: false;
    preload: string;
  }>;
}>;

export function createWindowOptions(preload: string): SecureWindowOptions {
  return { webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload } };
}

export function isAllowedNavigation(target: string, applicationOrigin: string): boolean {
  try {
    const targetUrl = new URL(target);
    const allowedUrl = new URL(applicationOrigin);
    if (targetUrl.protocol !== allowedUrl.protocol) return false;
    return targetUrl.protocol === 'file:' || targetUrl.origin === allowedUrl.origin;
  } catch {
    return false;
  }
}
