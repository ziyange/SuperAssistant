import { contextBridge, ipcRenderer } from 'electron';
import type { OnboardingProjection, SuperAssistantDesktopApi } from '../shared/ipc-contract.js';

const api: SuperAssistantDesktopApi = {
  getOnboarding: () => ipcRenderer.invoke('onboarding:get', {}),
  setOnboarding: (projection: OnboardingProjection) => ipcRenderer.invoke('onboarding:set', projection)
};

contextBridge.exposeInMainWorld('superAssistant', Object.freeze(api));
