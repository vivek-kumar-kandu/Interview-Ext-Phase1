import { isChromeExtension } from '../core/chrome';
import { logger } from '../core/logger';

export interface ExtensionMessage<T = unknown> {
  type: string;
  payload?: T;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export const sendRuntimeMessage = async <TPayload, TResponse>(
  type: string,
  payload?: TPayload
): Promise<ExtensionResponse<TResponse>> => {
  if (isChromeExtension()) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          logger.error(`Runtime message error [${type}]:`, chrome.runtime.lastError);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: true });
        }
      });
    });
  }

  logger.info(`[Web Fallback] Runtime message sent: ${type}`, payload);
  return { success: true };
};
