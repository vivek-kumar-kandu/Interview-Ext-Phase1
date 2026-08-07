import { useState, useEffect } from 'react';
import { RouteKey } from '../config/routes';
import { ThemeMode } from '../config/theme';
import { safeChromeStorage } from '../core/chrome';
import { STORAGE_KEYS } from '../core/constants';

export interface UIState {
  currentRoute: RouteKey;
  themeMode: ThemeMode;
  isFloatingWidgetVisible: boolean;
  isSidePanelOpen: boolean;
  toastMessage?: { type: 'success' | 'error' | 'info'; message: string };
}

let subscribers: Array<() => void> = [];
let state: UIState = {
  currentRoute: 'dashboard',
  themeMode: 'dark',
  isFloatingWidgetVisible: true,
  isSidePanelOpen: false,
};

const notify = () => subscribers.forEach((cb) => cb());

export const uiStore = {
  get: () => state,
  setRoute: (route: RouteKey) => {
    state = { ...state, currentRoute: route };
    notify();
  },
  setTheme: (theme: ThemeMode) => {
    state = { ...state, themeMode: theme };
    safeChromeStorage.set(STORAGE_KEYS.THEME, theme);
    notify();
  },
  toggleFloatingWidget: () => {
    state = { ...state, isFloatingWidgetVisible: !state.isFloatingWidgetVisible };
    notify();
  },
  setToast: (toast?: UIState['toastMessage']) => {
    state = { ...state, toastMessage: toast };
    notify();
  },
  subscribe: (callback: () => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter((cb) => cb !== callback);
    };
  },
};

export const useUIStore = () => {
  const [currentUIState, setCurrentUIState] = useState(uiStore.get());

  useEffect(() => {
    return uiStore.subscribe(() => {
      setCurrentUIState(uiStore.get());
    });
  }, []);

  return {
    ...currentUIState,
    setRoute: uiStore.setRoute,
    setTheme: uiStore.setTheme,
    toggleFloatingWidget: uiStore.toggleFloatingWidget,
    setToast: uiStore.setToast,
  };
};
