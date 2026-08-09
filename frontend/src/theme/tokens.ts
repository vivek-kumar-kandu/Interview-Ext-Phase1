import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export const tokens = {
  colors,
  typography,
  spacing,
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    '3xl': '1.5rem',
    full: '9999px',
  },
  shadows: {
    glass: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
    glowIndigo: '0 0 24px rgba(99, 102, 241, 0.35)',
    glowViolet: '0 0 24px rgba(139, 92, 246, 0.35)',
    glowCyan: '0 0 24px rgba(6, 182, 212, 0.35)',
    glowEmerald: '0 0 24px rgba(16, 185, 129, 0.35)',
  },
};

