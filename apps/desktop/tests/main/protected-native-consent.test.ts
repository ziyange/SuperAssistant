import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeEach, expect, test, vi } from 'vitest';

const native = vi.hoisted(() => ({
  parent: { isDestroyed: vi.fn(), once: vi.fn(), webContents: { getURL: vi.fn() } },
  focused: vi.fn(),
  showMessageBox: vi.fn(),
  review: vi.fn(),
  created: [] as unknown[]
}));
vi.mock('electron', () => ({
  BrowserWindow: class {
    static getFocusedWindow = native.focused;
    constructor(options: unknown) { native.created.push(options); }
  },
  dialog: { showMessageBox: native.showMessageBox }
}));
vi.mock('../../src/main/review-window.js', () => ({ presentReview: native.review }));
import { bindProtectedConsentWindow, presentProtectedConsent } from '../../src/main/protected-native-consent.js';

const rendererUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '../../src/renderer/index.html')).href;

beforeEach(() => {
  vi.clearAllMocks();
  native.created.length = 0;
  native.focused.mockReturnValue(native.parent);
  native.parent.isDestroyed.mockReturnValue(false);
  native.parent.webContents.getURL.mockReturnValue(rendererUrl);
  bindProtectedConsentWindow(native.parent as unknown as Parameters<typeof bindProtectedConsentWindow>[0]);
  native.review.mockImplementation(async (_review: string, _token: string, create: () => unknown) => { create(); return true; });
  native.showMessageBox.mockResolvedValue({ response: 0 });
});

test('untrusted focused window cannot present or authorize a Proposal', async () => {
  native.parent.webContents.getURL.mockReturnValue('file:///untrusted.html');
  expect(await presentProtectedConsent('review')).toBe(false);
  expect(native.review).not.toHaveBeenCalled();
  expect(native.showMessageBox).not.toHaveBeenCalled();
});

test('a different window with the same renderer URL cannot authorize a Proposal', async () => {
  native.focused.mockReturnValue({ isDestroyed: () => false, webContents: { getURL: () => rendererUrl } });
  expect(await presentProtectedConsent('review')).toBe(false);
  expect(native.review).not.toHaveBeenCalled();
});

test('closing the review cannot authorize or show the authorization prompt', async () => {
  native.review.mockResolvedValue(false);
  expect(await presentProtectedConsent('review')).toBe(false);
  expect(native.showMessageBox).not.toHaveBeenCalled();
});

test('review acknowledgement alone is insufficient when authorization is cancelled', async () => {
  native.showMessageBox.mockResolvedValue({ response: 1 });
  expect(await presentProtectedConsent('complete review')).toBe(false);
  expect(native.review).toHaveBeenCalledOnce();
});

test('explicit authorization follows full review in a restricted modal window', async () => {
  expect(await presentProtectedConsent('complete review')).toBe(true);
  expect(native.review).toHaveBeenCalledOnce();
  expect(native.showMessageBox).toHaveBeenCalledOnce();
  expect(native.created).toEqual([expect.objectContaining({
    parent: native.parent, modal: true, show: false,
    webPreferences: expect.objectContaining({ sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webviewTag: false })
  })]);
});

test('navigation away while the confirmation is open invalidates consent', async () => {
  native.showMessageBox.mockImplementation(async () => {
    native.parent.webContents.getURL.mockReturnValue('file:///other.html');
    return { response: 0 };
  });
  expect(await presentProtectedConsent('complete review')).toBe(false);
});
