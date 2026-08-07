import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { API_CONFIG } from '../config/api';
import { logger } from '../core/logger';

export const apiClientInstance = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

apiClientInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: AxiosError) => {
    logger.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

apiClientInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    logger.error(`API Response Error [${error.response?.status}]:`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiClientInstance;
