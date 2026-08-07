import { logger } from './logger';

/**
 * Safe abstraction over chrome runtime, storage, and sidePanel APIs
 * Works in Chrome extension context and provides web fallbacks for local dev
 */
export const isChromeExtension = (): boolean => {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
};

export const safeChromeStorage = {
  get: async <T>(key: string, defaultValue: T): Promise<T> => {
    if (isChromeExtension()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            logger.error(`Storage get error for key "${key}":`, chrome.runtime.lastError);
            resolve(defaultValue);
          } else {
            resolve(result[key] !== undefined ? (result[key] as T) : defaultValue);
          }
        });
      });
    }
    // Web fallback
    try {
      const item = localStorage.getItem(`interviewos_${key}`);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch (e) {
      logger.warn(`Failed reading localStorage fallback for "${key}"`, e);
      return defaultValue;
    }
  },

  set: async <T>(key: string, value: T): Promise<void> => {
    if (isChromeExtension()) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            logger.error(`Storage set error for key "${key}":`, chrome.runtime.lastError);
          }
          resolve();
        });
      });
    }
    // Web fallback
    try {
      localStorage.setItem(`interviewos_${key}`, JSON.stringify(value));
    } catch (e) {
      logger.warn(`Failed setting localStorage fallback for "${key}"`, e);
    }
  },
};

export const safeOpenSidePanel = async (): Promise<void> => {
  if (isChromeExtension() && chrome.sidePanel) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch (e) {
      logger.error('Failed opening side panel', e);
    }
  } else {
    logger.info('Side panel open requested (Web mode simulation)');
  }
};
