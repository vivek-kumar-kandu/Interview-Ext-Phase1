import { useState, useEffect } from 'react';
import { safeChromeStorage } from '../core/chrome';
import { STORAGE_KEYS } from '../core/constants';

export interface AppSettings {
  autoTranscription: boolean;
  aiCoPilotSensitivity: 'conservative' | 'balanced' | 'aggressive';
  showFloatingWidget: boolean;
  soundAlerts: boolean;
  apiEndpointCustom: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoTranscription: true,
  aiCoPilotSensitivity: 'balanced',
  showFloatingWidget: true,
  soundAlerts: true,
  apiEndpointCustom: '',
};

let subscribers: Array<() => void> = [];
let currentSettings: AppSettings = DEFAULT_SETTINGS;

const notify = () => subscribers.forEach((cb) => cb());

export const settingsStore = {
  get: () => currentSettings,
  updateSettings: (newSettings: Partial<AppSettings>) => {
    currentSettings = { ...currentSettings, ...newSettings };
    safeChromeStorage.set(STORAGE_KEYS.SETTINGS, currentSettings);
    notify();
  },
  subscribe: (callback: () => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter((cb) => cb !== callback);
    };
  },
};

export const useSettingsStore = () => {
  const [settings, setSettingsState] = useState<AppSettings>(settingsStore.get());

  useEffect(() => {
    safeChromeStorage.get<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS).then((saved) => {
      currentSettings = saved;
      setSettingsState(saved);
    });

    return settingsStore.subscribe(() => {
      setSettingsState(settingsStore.get());
    });
  }, []);

  return {
    settings,
    updateSettings: settingsStore.updateSettings,
  };
};
