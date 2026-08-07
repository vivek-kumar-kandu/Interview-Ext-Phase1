import { useState, useEffect } from 'react';
import { interviewApi, InterviewApiResponse } from '../api/interview';
import { Candidate } from '../types/candidate';
import { BackendFeedback, JobAnalysisSummary, ProgressMetrics } from '../types/feedback';
import { logger } from '../core/logger';

export interface ChatTurnMessage {
  id: string;
  sender: 'interviewer' | 'candidate';
  text: string;
  timestamp: string;
  whyAsked?: string;
}

export interface InterviewStoreState {
  sessionId: string;
  messages: ChatTurnMessage[];
  isLoading: boolean;
  isDone: boolean;
  feedback: BackendFeedback | null;
  candidateProfile: Candidate | null;
  matchScore: number;
  readinessScore: number;
  requiredSkills: string[];
  candidateSkills: string[];
  missingSkills: string[];
  jobSummary: JobAnalysisSummary | null;
  progress: ProgressMetrics | null;
  thinkingStage: number; // 0 = idle, 1-5 = animated thinking stages
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
    targetRole: 'AI Engineer',
    keySkills: ['FastAPI', 'LangGraph', 'Python', 'React'],
  },
  matchScore: 92,
  readinessScore: 88,
  requiredSkills: ['FastAPI', 'Docker', 'LangGraph', 'Redis'],
  candidateSkills: ['FastAPI', 'LangGraph', 'Python'],
  missingSkills: ['Docker', 'Redis'],
  jobSummary: {
    company: 'OpenAI',
    role: 'AI Engineer',
    detectedSkills: ['FastAPI', 'Docker', 'LangGraph', 'Redis'],
    matchScore: 92,
    readinessScore: 88,
    requiredSkills: ['FastAPI', 'Docker', 'LangGraph', 'Redis'],
    candidateSkills: ['FastAPI', 'LangGraph', 'Python'],
    missingSkills: ['Docker', 'Redis'],
  },
  progress: {
    questionsCount: 1,
    totalQuestions: 8,
    topicsCovered: ['FastAPI'],
    remainingTopics: ['LangGraph', 'RAG Architecture', 'Docker Containerization', 'Redis Caching & State'],
    roadmapProgress: [
      { index: 1, topic: 'FastAPI', status: 'completed', day: 7 },
      { index: 2, topic: 'LangGraph', status: 'active', day: 10 },
      { index: 3, topic: 'RAG Architecture', status: 'pending', day: 13 },
      { index: 4, topic: 'Docker Containerization', status: 'pending', day: 21 },
      { index: 5, topic: 'Redis Caching & State', status: 'pending', day: 28 },
    ],
  },
  thinkingStage: 0,
};

const notify = () => subscribers.forEach((cb) => cb());

const simulateThinkingTimeline = async () => {
  for (let stage = 1; stage <= 5; stage++) {
    state = { ...state, thinkingStage: stage };
    notify();
    await new Promise((res) => setTimeout(res, 250));
  }
};

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
      thinkingStage: 1,
    };
    notify();

    await simulateThinkingTimeline();

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
        whyAsked: data.whyAsked,
      };

      state = {
        ...state,
        isLoading: false,
        thinkingStage: 0,
        isDone: data.done,
        feedback: data.feedback || null,
        messages: [greetingMessage],
        matchScore: data.matchScore ?? state.matchScore,
        readinessScore: data.readinessScore ?? state.readinessScore,
        requiredSkills: data.requiredSkills || state.requiredSkills,
        candidateSkills: data.candidateSkills || state.candidateSkills,
        missingSkills: data.missingSkills || state.missingSkills,
        progress: data.progress || state.progress,
        jobSummary: data.jobSummary || state.jobSummary,
      };
      logger.info('Interviewer Greeting:', data.reply);
    } catch (e) {
      logger.error('Failed to start interview:', e);
      state = { ...state, isLoading: false, thinkingStage: 0 };
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
      thinkingStage: 1,
    };
    notify();

    await simulateThinkingTimeline();

    try {
      const data: InterviewApiResponse = await interviewApi.postInterview({
        sessionId: state.sessionId,
        message: userMessage,
      });

      if (data.done) {
        logger.info('Interview Finished!');
        state = {
          ...state,
          isLoading: false,
          thinkingStage: 0,
          isDone: true,
          feedback: data.feedback || null,
          matchScore: data.matchScore ?? state.matchScore,
          readinessScore: data.readinessScore ?? state.readinessScore,
          progress: data.progress || state.progress,
        };
      } else {
        const interviewerMsg: ChatTurnMessage = {
          id: `msg_int_${Date.now()}`,
          sender: 'interviewer',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          whyAsked: data.whyAsked,
        };

        state = {
          ...state,
          isLoading: false,
          thinkingStage: 0,
          messages: [...state.messages, interviewerMsg],
          matchScore: data.matchScore ?? state.matchScore,
          readinessScore: data.readinessScore ?? state.readinessScore,
          requiredSkills: data.requiredSkills || state.requiredSkills,
          candidateSkills: data.candidateSkills || state.candidateSkills,
          missingSkills: data.missingSkills || state.missingSkills,
          progress: data.progress || state.progress,
        };
        logger.info('Next Question:', data.reply);
      }
    } catch (e) {
      logger.error('Failed to send candidate response:', e);
      state = { ...state, isLoading: false, thinkingStage: 0 };
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

