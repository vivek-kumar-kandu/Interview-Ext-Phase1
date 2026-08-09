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

// Helper to count other browser tabs in the current window
const calculateOtherTabCount = (): Promise<number> => {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      resolve(0);
      return;
    }
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs) {
        resolve(0);
        return;
      }
      const count = Math.max(0, tabs.length - 1);
      resolve(count);
    });
  });
};

// Broadcast current tab count to extension UI views (e.g. sidepanel)
const notifyTabCountChanged = async () => {
  const otherTabCount = await calculateOtherTabCount();
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      type: MESSAGES.TAB_COUNT_UPDATED,
      payload: { otherTabCount }
    }).catch(() => {
      // Receiver may not be open, ignore errors silently
    });
  }
};

// Register Chrome tab lifecycle listeners for real-time tab state monitoring
if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onCreated.addListener(() => { notifyTabCountChanged(); });
  chrome.tabs.onRemoved.addListener(() => { notifyTabCountChanged(); });
  chrome.tabs.onUpdated.addListener(() => { notifyTabCountChanged(); });
  chrome.tabs.onActivated.addListener(() => { notifyTabCountChanged(); });
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

    case MESSAGES.GET_TAB_COUNT:
      calculateOtherTabCount().then((count) => {
        sendResponse({ success: true, data: { otherTabCount: count } });
      });
      return true;

    default:
      sendResponse({ success: true, message: `Unhandled background message: ${message.type}` });
  }
  return true;
});
