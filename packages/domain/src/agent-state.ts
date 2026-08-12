export type ConnectionState = 'CONNECTED' | 'AUTH_REQUIRED' | 'UNAVAILABLE' | 'DISABLED';
export type AvailabilityState = 'AVAILABLE' | 'SATURATED' | 'PAUSED' | 'ERROR';
export interface AgentState { connection: ConnectionState; availability: AvailabilityState; }

export function isValidAgentState(connection: ConnectionState, availability: AvailabilityState): boolean {
  return connection === 'CONNECTED' || availability !== 'AVAILABLE';
}
export function effectiveAgentPresentation(state: AgentState): ConnectionState | AvailabilityState {
  return state.connection === 'CONNECTED' ? state.availability : state.connection;
}
