import { EventEmitter } from 'node:events';
import { expect, test } from 'vitest';
import { renderReviewDocument, presentReview } from '../../src/main/review-window.js';

test('review document escapes hostile input and offers no scripting or external content', () => {
  const html = renderReviewDocument('{"objective":"<img src=x onerror=alert(1)>"}', 'https://review.invalid/confirm/token');
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).not.toContain('<img');
  expect(html).toContain("default-src 'none'");
  expect(html).toContain('does not authorize execution');
  expect(html).toContain('overflow');
});

test('Decision review displays the full bounded question in a scrollable isolated document', () => {
  const question = 'long question '.repeat(60);
  const html = renderReviewDocument(JSON.stringify({ question }), 'https://review.invalid/confirm/token', 'Decision');
  expect(html).toContain('Review Decision');
  expect(html).toContain(question);
  expect(html).toContain('overflow:auto');
  expect(html).toContain("default-src 'none'");
});

test('only an exact approval navigation accepts; closing or other navigation fails closed', async () => {
  class Contents extends EventEmitter { setWindowOpenHandler() { return undefined; } }
  class Window extends EventEmitter {
    webContents = new Contents();
    url = '';
    closed = false;
    async loadURL(url: string) { this.url = url; }
    show() {}
    close() { this.closed = true; this.emit('closed'); }
    isDestroyed() { return this.closed; }
  }
  const child = new Window();
  const pending = presentReview('{"objective":"Review"}', 'token', () => child);
  const other = { preventDefault() {} };
  child.webContents.emit('will-navigate', other, 'https://review.invalid/confirm/other');
  expect(child.closed).toBe(false);
  let prevented = false;
  child.webContents.emit('will-navigate', { preventDefault() { prevented = true; } }, 'https://review.invalid/confirm/token');
  expect(prevented).toBe(true);
  expect(await pending).toBe(true);
  const closed = new Window();
  const cancelled = presentReview('{}', 'another', () => closed);
  closed.close();
  expect(await cancelled).toBe(false);
});

test('fails closed when loading the review window fails', async () => {
  class Contents extends EventEmitter { setWindowOpenHandler() { return undefined; } }
  class Window extends EventEmitter {
    webContents = new Contents();
    destroyed = false;
    async loadURL() { throw new Error('load failed'); }
    show() {}
    close() { this.destroyed = true; this.emit('closed'); }
    isDestroyed() { return this.destroyed; }
  }
  const child = new Window();
  expect(await presentReview('{}', 'token', () => child)).toBe(false);
  expect(child.destroyed).toBe(true);
  expect(await presentReview('{}', '../escape', () => { throw new Error('should not open'); })).toBe(false);
});
