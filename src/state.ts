export interface Question {
  id: number;
  stem: string;
  options: Record<string, string>;
  correct: string;
  topic: string;
  traps?: Record<string, string>;
  fact: string;
}

export interface QuizSession {
  subject: string;
  questions: Question[];
  currentIndex: number;
  score: number;
  messageId?: number;
  startedAt: Date;
}

export const sessions = new Map<number, QuizSession>();
export const userSubjects = new Map<number, string>();

export function getUserSubject(chatId: number): string {
  return userSubjects.get(chatId) || "pcl301";
}

export function setUserSubject(chatId: number, subject: string) {
  userSubjects.set(chatId, subject.toLowerCase().trim());
}
