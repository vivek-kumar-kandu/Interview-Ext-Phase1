import { logger } from '../core/logger';
import { registerContentListener } from '../messaging/content';
import { MESSAGES } from '../core/constants';

logger.info('InterviewOS Content Script injected on page:', window.location.href);

// Content script messaging listener
registerContentListener((message, sendResponse) => {
  if (message.type === MESSAGES.TOGGLE_FLOATING_WIDGET) {
    logger.info('Toggling floating widget injection');
    sendResponse({ success: true });
  }
  return true;
});
