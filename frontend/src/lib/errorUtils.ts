/**
 * Safe Error Formatter for InterviewOS UI Components
 * Prevents [object Object] and crash bugs by gracefully unwrapping error objects.
 */
export function formatErrorMessage(err: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!err) return fallbackMessage;

  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (trimmed && trimmed !== '[object Object]') {
      return trimmed;
    }
    return fallbackMessage;
  }

  if (typeof err === 'object') {
    const obj = err as any;

    // Axios or API response structure
    if (obj.response?.data?.message && typeof obj.response.data.message === 'string') {
      return obj.response.data.message;
    }

    if (obj.response?.data?.error && typeof obj.response.data.error === 'string') {
      return obj.response.data.error;
    }

    if (obj.response?.data?.detail && typeof obj.response.data.detail === 'string') {
      return obj.response.data.detail;
    }

    // Standard Error object message
    if (obj.message && typeof obj.message === 'string' && obj.message !== '[object Object]') {
      return obj.message;
    }

    // Custom errorMessage field
    if (obj.errorMessage && typeof obj.errorMessage === 'string') {
      return obj.errorMessage;
    }

    // Attempt JSON stringify if valid object
    try {
      const str = JSON.stringify(obj);
      if (str && str !== '{}' && str !== '[]') {
        return str;
      }
    } catch {
      // Ignore stringify error
    }
  }

  return fallbackMessage;
}
