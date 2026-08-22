import { expect, test } from 'vitest';
import { createDomainTemplate } from '../src/domain-template.js';

test('pins a classified domain Template version and separates intent from facts', () => {
  expect(createDomainTemplate({ templateId: 'operations', version: '1.0.0', functionVersion: '1.0.0', dataClassification: 'INTERNAL', mode: 'ANALYSIS' })).toEqual({ templateId: 'operations', version: '1.0.0', functionVersion: '1.0.0', dataClassification: 'INTERNAL', mode: 'ANALYSIS' });
});

test('rejects an unclassified template or automatic action mode', () => {
  expect(() => createDomainTemplate({ templateId: 'hr', version: '1.0.0', functionVersion: '1.0.0', dataClassification: 'UNKNOWN', mode: 'ACTION' })).toThrow('DOMAIN_TEMPLATE_INVALID');
});
