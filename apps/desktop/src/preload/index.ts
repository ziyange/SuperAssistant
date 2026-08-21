import { contextBridge, ipcRenderer } from 'electron';
import type { OnboardingProjection, SuperAssistantDesktopApi } from '../shared/ipc-contract.js';

const api: SuperAssistantDesktopApi = {
  getOnboarding: () => ipcRenderer.invoke('onboarding:get', {}),
  setOnboarding: (projection: OnboardingProjection) => ipcRenderer.invoke('onboarding:set', projection),
  getTask: (taskId) => ipcRenderer.invoke('task:get', { taskId }),
  listTasks: () => ipcRenderer.invoke('task:list', {}),
  getArtifact: (input) => ipcRenderer.invoke('artifact:get', input)
  ,getDecision: (decisionId) => ipcRenderer.invoke('decision:get', { decisionId })
  ,listDecisions: (taskId) => ipcRenderer.invoke('decision:list', { taskId })
  ,listHistory: (input) => ipcRenderer.invoke('history:list', input)
  ,listProjectChanges: (input) => ipcRenderer.invoke('project-change:list', input)
  ,listAcceptance: (taskId) => ipcRenderer.invoke('acceptance:list', { taskId })
};

contextBridge.exposeInMainWorld('superAssistant', Object.freeze(api));
