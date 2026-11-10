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

export function isTrustedIpcSender(senderUrl: string, applicationUrl: string, sameWebContents: boolean, mainFrame: boolean): boolean {
  if (!sameWebContents || !mainFrame) return false;
  try {
    const sender = new URL(senderUrl);
    const application = new URL(applicationUrl);
    return sender.protocol === 'file:' && application.protocol === 'file:' && sender.href === application.href;
  } catch {
    return false;
  }
}

export function isAllowedNavigation(target: string, applicationOrigin: string): boolean {
  try {
    const targetUrl = new URL(target);
    const allowedUrl = new URL(applicationOrigin);
    if (targetUrl.protocol !== allowedUrl.protocol) return false;
    return targetUrl.protocol === 'file:' ? targetUrl.href === allowedUrl.href : targetUrl.origin === allowedUrl.origin;
  } catch {
    return false;
  }
}
