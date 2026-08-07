import { useState, useEffect } from 'react';
import { interviewApi, InterviewApiResponse } from '../api/interview';
import { Candidate } from '../types/candidate';
import { BackendFeedback } from '../types/feedback';
import { logger } from '../core/logger';

export interface ChatTurnMessage {
  id: string;
  sender: 'interviewer' | 'candidate';
  text: string;
  timestamp: string;
}

export interface InterviewStoreState {
  sessionId: string;
  messages: ChatTurnMessage[];
  isLoading: boolean;
  isDone: boolean;
  feedback: BackendFeedback | null;
  candidateProfile: Candidate | null;
}

let subscribers: Array<() => void> = [];
let state: InterviewStoreState = {
  sessionId: `session_${Date.now()}`,
  messages: [],
  isLoading: false,
  isDone: false,
  feedback: null,
  candidateProfile: {
    id: 'cand_01',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    targetRole: 'Senior Frontend Engineer',
    keySkills: ['React', 'TypeScript', 'Chrome Extension'],
  },
};

const notify = () => subscribers.forEach((cb) => cb());

export const interviewStore = {
  get: () => state,

  /**
   * Step 1: Start Interview (POST /api/interview with sessionId & candidate)
   */
  startInterview: async (customCandidate?: Candidate) => {
    const candidate = customCandidate || state.candidateProfile!;
    const sessionId = `session_${Date.now()}`;
    state = {
      ...state,
      sessionId,
      candidateProfile: candidate,
      isLoading: true,
      messages: [],
      isDone: false,
      feedback: null,
    };
    notify();

    try {
      const data: InterviewApiResponse = await interviewApi.postInterview({
        sessionId,
        candidate,
      });

      const greetingMessage: ChatTurnMessage = {
        id: `msg_${Date.now()}`,
        sender: 'interviewer',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      state = {
        ...state,
        isLoading: false,
        isDone: data.done,
        feedback: data.feedback || null,
        messages: [greetingMessage],
      };
      logger.info('Interviewer Greeting:', data.reply);
      logger.info('Is Interview Done?:', data.done);
    } catch (e) {
      logger.error('Failed to start interview:', e);
      state = { ...state, isLoading: false };
    }
    notify();
  },

  /**
   * Step 2: Send Candidate Response (POST /api/interview with sessionId & message)
   */
  sendCandidateResponse: async (userMessage: string) => {
    if (!userMessage.trim() || state.isLoading || state.isDone) return;

    const candidateMsg: ChatTurnMessage = {
      id: `msg_cand_${Date.now()}`,
      sender: 'candidate',
      text: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    state = {
      ...state,
      messages: [...state.messages, candidateMsg],
      isLoading: true,
    };
    notify();

    try {
      const data: InterviewApiResponse = await interviewApi.postInterview({
        sessionId: state.sessionId,
        message: userMessage,
      });

      if (data.done) {
        logger.info('Interview Finished!');
        logger.info('Final Feedback:', data.feedback);
        state = {
          ...state,
          isLoading: false,
          isDone: true,
          feedback: data.feedback || null,
        };
      } else {
        const interviewerMsg: ChatTurnMessage = {
          id: `msg_int_${Date.now()}`,
          sender: 'interviewer',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        state = {
          ...state,
          isLoading: false,
          messages: [...state.messages, interviewerMsg],
        };
        logger.info('Next Question:', data.reply);
      }
    } catch (e) {
      logger.error('Failed to send candidate response:', e);
      state = { ...state, isLoading: false };
    }
    notify();
  },

  subscribe: (callback: () => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter((cb) => cb !== callback);
    };
  },
};

export const useInterviewStore = () => {
  const [interviewState, setInterviewState] = useState(interviewStore.get());

  useEffect(() => {
    return interviewStore.subscribe(() => {
      setInterviewState(interviewStore.get());
    });
  }, []);

  return {
    ...interviewState,
    startInterview: interviewStore.startInterview,
    sendCandidateResponse: interviewStore.sendCandidateResponse,
  };
};
