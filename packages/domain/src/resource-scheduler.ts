export interface ResourceRequest { attemptId: string; resources: readonly string[]; }
export interface GrantedResources { attemptId: string; fencingTokens: Readonly<Record<string, number>>; }

export function scheduleResources(requests: readonly ResourceRequest[]): Readonly<{ granted: readonly GrantedResources[]; blocked: readonly string[] }> {
  const owned = new Set<string>(); const tokens = new Map<string, number>(); const granted: GrantedResources[] = []; const blocked: string[] = [];
  for (const request of requests) {
    const resources = [...new Set(request.resources)].sort();
    if (resources.some((resource) => owned.has(resource))) { blocked.push(request.attemptId); continue; }
    const fencingTokens: Record<string, number> = {};
    for (const resource of resources) { const next = (tokens.get(resource) ?? 0) + 1; tokens.set(resource, next); owned.add(resource); fencingTokens[resource] = next; }
    granted.push({ attemptId: request.attemptId, fencingTokens });
  }
  return { granted, blocked };
}
