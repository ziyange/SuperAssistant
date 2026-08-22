export interface DomainTemplate {
  readonly templateId: string;
  readonly version: string;
  readonly functionVersion: string;
  readonly dataClassification: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE';
  readonly mode: 'ANALYSIS';
}

export function createDomainTemplate(input: Readonly<{ templateId: string; version: string; functionVersion: string; dataClassification: string; mode: string }>): Readonly<DomainTemplate> {
  if (!/^[a-z0-9-]+$/.test(input.templateId) || !/^\d+\.\d+\.\d+$/.test(input.version) || !/^\d+\.\d+\.\d+$/.test(input.functionVersion) || !['PUBLIC', 'INTERNAL', 'SENSITIVE'].includes(input.dataClassification) || input.mode !== 'ANALYSIS') throw new Error('DOMAIN_TEMPLATE_INVALID');
  return Object.freeze(input as DomainTemplate);
}
