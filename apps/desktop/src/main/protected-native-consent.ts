import { BrowserWindow, dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { presentReview } from './review-window.js';

const rendererUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '../renderer/index.html')).href;
let trustedMainWindow: BrowserWindow | undefined;

/** Called only by the main composition root after it creates the application window. */
export function bindProtectedConsentWindow(window: BrowserWindow): void {
  if (trustedMainWindow && trustedMainWindow !== window && !trustedMainWindow.isDestroyed()) throw new Error('Main window already bound');
  trustedMainWindow = window;
  window.once('closed', () => { if (trustedMainWindow === window) trustedMainWindow = undefined; });
}

/** Main-owned native review followed by an explicit authorization choice. */
export async function presentProtectedConsent(review: string): Promise<boolean> {
  const parent = BrowserWindow.getFocusedWindow();
  if (!parent || parent !== trustedMainWindow || parent.isDestroyed() || parent.webContents.getURL() !== rendererUrl) return false;
  try {
    const acknowledged = await presentReview(review, randomUUID(), () => new BrowserWindow({
      parent, modal: true, show: false, width: 850, height: 700, autoHideMenuBar: true,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webviewTag: false }
    }));
    if (!acknowledged || parent.isDestroyed() || parent.webContents.getURL() !== rendererUrl) return false;
    const answer = await dialog.showMessageBox(parent, {
      type: 'question',
      message: 'Authorize this reviewed Proposal?',
      detail: 'The exact reviewed Proposal will be queued. Closing or cancelling does not authorize it.',
      buttons: ['Authorize', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true
    });
    return answer.response === 0 && !parent.isDestroyed() && parent.webContents.getURL() === rendererUrl;
  } catch { return false; }
}

/** Native request only; confirmation does not prove interruption or termination. */
export async function presentProtectedCancellation(review: string, taskId: string): Promise<boolean> {
  if (typeof review !== 'string' || review.length < 1 || review.length > 8192
    || typeof taskId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(taskId)) return false;
  const parent = BrowserWindow.getFocusedWindow();
  if (!parent || parent !== trustedMainWindow || parent.isDestroyed() || parent.webContents.getURL() !== rendererUrl) return false;
  try {
    const acknowledged = await presentReview(review, randomUUID(), () => new BrowserWindow({
      parent, modal: true, show: false, width: 850, height: 700, autoHideMenuBar: true,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webviewTag: false }
    }), 'Proposal');
    if (!acknowledged || parent.isDestroyed() || parent.webContents.getURL() !== rendererUrl) return false;
    const answer = await dialog.showMessageBox(parent, {
      type: 'question', message: 'Cancel this running task?',
      detail: `Task: ${taskId}\nThe request does not confirm that execution or its process tree has stopped.`,
      buttons: ['Request cancellation', 'Keep running'], defaultId: 1, cancelId: 1, noLink: true
    });
    return answer.response === 0 && !parent.isDestroyed() && parent.webContents.getURL() === rendererUrl;
  } catch { return false; }
}
