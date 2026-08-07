import { apiClient } from './client';
import { API_CONFIG } from '../config/api';
import { HealthCheckResponse } from '../types/api';
import { env } from '../core/env';

export const healthApi = {
  checkHealth: async () => {
    if (env.enableMockApi) {
      return {
        success: true,
        data: {
          status: 'healthy' as const,
          version: env.appVersion,
          uptimeSeconds: 3600,
        },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.get<HealthCheckResponse>(API_CONFIG.endpoints.health);
  },
};
