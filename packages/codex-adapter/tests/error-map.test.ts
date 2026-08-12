import { expect, test } from 'vitest';
import { mapDiscoveryError } from '../src/error-map.js';
test('redacts upstream error detail', () => expect(mapDiscoveryError(new Error('Authorization: Bearer secret')).message).not.toMatch(/secret|bearer/i));
