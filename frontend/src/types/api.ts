export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  uptimeSeconds: number;
}
