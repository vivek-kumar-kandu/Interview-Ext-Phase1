export const APP_NAME = 'InterviewOS';
export const APP_SLOGAN = 'AI Interview Layer for Any Hiring Platform';

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  ACTIVE_SESSION: 'active_session',
  THEME: 'theme_mode',
  CHAT_HISTORY: 'chat_history',
  FEEDBACK_REPORTS: 'feedback_reports',
} as const;

export const MESSAGES = {
  START_INTERVIEW: 'START_INTERVIEW',
  END_INTERVIEW: 'END_INTERVIEW',
  SUBMIT_ANSWER: 'SUBMIT_ANSWER',
  GET_NEXT_QUESTION: 'GET_NEXT_QUESTION',
  TOGGLE_FLOATING_WIDGET: 'TOGGLE_FLOATING_WIDGET',
  OPEN_SIDEPANEL: 'OPEN_SIDEPANEL',
  GET_TAB_COUNT: 'GET_TAB_COUNT',
  TAB_COUNT_UPDATED: 'TAB_COUNT_UPDATED',
  PING: 'PING',
  PONG: 'PONG',
} as const;

export const DEFAULT_TIMEOUT_MS = 15000;
