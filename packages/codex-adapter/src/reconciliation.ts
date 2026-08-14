export async function reconcileExecution(observe: () => Promise<{ status: 'NOT_STARTED' | 'ACTIVE' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'INDETERMINATE' }>): Promise<{ state: string; dispatchable: boolean }> {
  const result = await observe();
  return result.status === 'INDETERMINATE' ? { state: 'RECONCILING', dispatchable: false } : { state: result.status, dispatchable: false };
}
