import { logger } from '../core/logger';
import { ExtensionMessage } from './runtime';

type ContentMessageHandler = (
  message: ExtensionMessage,
  sendResponse: (response?: unknown) => void
) => boolean | void;

export const registerContentListener = (handler: ContentMessageHandler) => {
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      logger.debug('Content script message received:', message);
      return handler(message, sendResponse);
    });
  }
};
