import { apiClientInstance } from '../lib/axios';

export const apiClient = {
  get: async <T>(url: string): Promise<T> => {
    const response = await apiClientInstance.get<T>(url);
    return response.data;
  },

  post: async <T, TData = unknown>(url: string, data?: TData): Promise<T> => {
    const response = await apiClientInstance.post<T>(url, data);
    return response.data;
  },
};
