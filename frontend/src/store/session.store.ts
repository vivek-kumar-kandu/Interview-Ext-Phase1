import { useState, useEffect } from 'react';
import { InterviewSession } from '../types/session';
import { safeChromeStorage } from '../core/chrome';
import { STORAGE_KEYS } from '../core/constants';

let subscribers: Array<() => void> = [];
let currentSession: InterviewSession | null = null;

const notify = () => subscribers.forEach((cb) => cb());

export const sessionStore = {
  get: () => currentSession,
  setSession: (session: InterviewSession | null) => {
    currentSession = session;
    safeChromeStorage.set(STORAGE_KEYS.ACTIVE_SESSION, session);
    notify();
  },
  subscribe: (callback: () => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter((cb) => cb !== callback);
    };
  },
};

export const useSessionStore = () => {
  const [session, setSessionState] = useState<InterviewSession | null>(sessionStore.get());

  useEffect(() => {
    // Initial sync from chrome storage
    safeChromeStorage.get<InterviewSession | null>(STORAGE_KEYS.ACTIVE_SESSION, null).then((saved) => {
      if (saved) {
        currentSession = saved;
        setSessionState(saved);
      }
    });

    return sessionStore.subscribe(() => {
      setSessionState(sessionStore.get());
    });
  }, []);

  return {
    session,
    setSession: sessionStore.setSession,
  };
};
