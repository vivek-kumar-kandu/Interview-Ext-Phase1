import { isChromeExtension } from '../core/chrome';
import { logger } from '../core/logger';
import { ExtensionResponse } from './runtime';

export const sendTabMessage = async <TPayload, TResponse>(
  tabId: number,
  type: string,
  payload?: TPayload
): Promise<ExtensionResponse<TResponse>> => {
  if (isChromeExtension()) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          logger.error(`Tab message error [Tab: ${tabId}, Type: ${type}]:`, chrome.runtime.lastError);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: true });
        }
      });
    });
  }

  logger.info(`[Web Fallback] Tab message sent to Tab ${tabId}: ${type}`, payload);
  return { success: true };
};
