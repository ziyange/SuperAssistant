export interface AgentTemplateVersion {
  templateId: string;
  version: string;
  name: string;
  functionVersions: readonly Readonly<{ functionId: string; version: string }>[];
}

export function createAgentTemplateVersion(input: AgentTemplateVersion): Readonly<AgentTemplateVersion> {
  return Object.freeze({ ...input, functionVersions: Object.freeze(input.functionVersions.map((item) => Object.freeze({ ...item }))) });
}
