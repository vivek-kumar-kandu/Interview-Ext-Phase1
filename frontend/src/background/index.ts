import { logger } from '../core/logger';
import { registerBackgroundListener } from '../messaging/background';
import { MESSAGES } from '../core/constants';

logger.info('InterviewOS Service Worker Initialized');

// Handle extension icon click to open sidepanel if available
if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    logger.error('Failed to set panel behavior:', error);
  });
}

// Background event listener for incoming extension messaging
registerBackgroundListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case MESSAGES.PING:
      sendResponse({ success: true, data: MESSAGES.PONG });
      break;

    case MESSAGES.OPEN_SIDEPANEL:
      if (chrome.sidePanel && _sender.tab?.id) {
        chrome.sidePanel.open({ tabId: _sender.tab.id });
        sendResponse({ success: true });
      }
      break;

    default:
      sendResponse({ success: true, message: `Unhandled background message: ${message.type}` });
  }
  return true;
});
