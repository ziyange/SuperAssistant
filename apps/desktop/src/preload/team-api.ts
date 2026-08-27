import { ipcRenderer } from 'electron';
import type { IpcResponse } from '../shared/ipc-contract.js';
export interface TeamDesktopApi { getWorkspace(workspaceId: string): Promise<IpcResponse>; }
export const teamApi: TeamDesktopApi = Object.freeze({ getWorkspace: (workspaceId: string) => ipcRenderer.invoke('team:workspace', { workspaceId }) });
