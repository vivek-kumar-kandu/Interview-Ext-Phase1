export type RouteKey = 'dashboard' | 'interview' | 'feedback' | 'settings';

export const ROUTES: Record<RouteKey, { path: string; title: string }> = {
  dashboard: { path: '/', title: 'Dashboard' },
  interview: { path: '/interview', title: 'Interview Session' },
  feedback: { path: '/feedback', title: 'Feedback & Reports' },
  settings: { path: '/settings', title: 'Settings' },
};
