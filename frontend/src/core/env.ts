/**
 * InterviewOS Environment Configuration
 * Centralized typed environment loader with fallbacks
 */
export interface EnvConfig {
  apiBaseUrl: string;
  enableMockApi: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  appVersion: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

export const env: EnvConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  enableMockApi: import.meta.env.VITE_ENABLE_MOCK_API === 'true',
  logLevel: (import.meta.env.VITE_LOG_LEVEL as EnvConfig['logLevel']) || 'debug',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  isDevelopment: import.meta.env.DEV ?? true,
  isProduction: import.meta.env.PROD ?? false,
};
