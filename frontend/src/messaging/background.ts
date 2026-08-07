import { logger } from '../core/logger';
import { ExtensionMessage } from './runtime';

type BackgroundMessageHandler = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

export const registerBackgroundListener = (handler: BackgroundMessageHandler) => {
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      logger.debug('Background message received:', message);
      return handler(message, sender, sendResponse);
    });
  }
};
