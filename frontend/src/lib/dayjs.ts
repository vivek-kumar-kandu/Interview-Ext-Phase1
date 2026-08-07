/**
 * Date formatting helpers for session timestamps
 */
export const formatDate = (isoString?: string): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatTime = (isoString?: string): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDuration = (seconds?: number): string => {
  if (!seconds) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
