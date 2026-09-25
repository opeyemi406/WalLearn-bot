import fs from "fs";
import path from "path";

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

export interface UserProfile {
  subjectCode: string; // e.g. "pcl301", "bch201" for Walrus namespace
  subjectDisplay: string; // e.g. "PCL301 - Clinical Pharmacokinetics"
}

const PROFILES_FILE = path.resolve(process.cwd(), "data/user-profiles.json");

function loadProfiles(): Map<number, UserProfile> {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROFILES_FILE, "utf8"));
      return new Map(Object.entries(data).map(([k, v]) => [Number(k), v as UserProfile]));
    }
  } catch (e) {
    console.error("Failed to load user profiles:", e);
  }
  return new Map();
}

function saveProfiles(profiles: Map<number, UserProfile>) {
  try {
    const obj: Record<string, UserProfile> = {};
    for (const [k, v] of profiles.entries()) {
      obj[String(k)] = v;
    }
    fs.mkdirSync(path.dirname(PROFILES_FILE), { recursive: true });
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error("Failed to save user profiles:", e);
  }
}

export interface PendingSlide {
  text: string;
  fileName: string;
}

export const sessions = new Map<number, QuizSession>();
export const pendingSlides = new Map<number, PendingSlide>();
const userProfiles = loadProfiles();
export const awaitingSubject = new Set<number>();

export function hasUserSubject(chatId: number): boolean {
  return userProfiles.has(chatId);
}

export function getUserSubject(chatId: number): string {
  const profile = userProfiles.get(chatId);
  return profile?.subjectCode || "general";
}

export function getUserSubjectDisplay(chatId: number): string {
  const profile = userProfiles.get(chatId);
  return profile?.subjectDisplay || "General Studies";
}

export function parseSubjectInput(input: string): { code: string; display: string } {
  const trimmed = input.trim();
  // Match "CODE - Title" or "CODE: Title" or "CODE Title"
  const match = trimmed.match(/^([a-zA-Z]{2,5}\s*\d{2,4})[\s:\-–—]+(.*)$/i);
  if (match) {
    const rawCode = match[1].replace(/\s+/g, "").toLowerCase();
    const title = match[2].trim();
    return {
      code: rawCode,
      display: `${match[1].toUpperCase().replace(/\s+/g, "")} - ${title}`,
    };
  }

  // Standalone code like "PCL301" or "BIO101"
  const codeMatch = trimmed.match(/^([a-zA-Z]{2,5}\s*\d{2,4})$/i);
  if (codeMatch) {
    const code = codeMatch[1].replace(/\s+/g, "").toLowerCase();
    return {
      code,
      display: code.toUpperCase(),
    };
  }

  // Fallback slug for general names
  const cleanSlug = trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 24);
  return {
    code: cleanSlug || "general",
    display: trimmed,
  };
}

export function setUserSubject(chatId: number, rawInput: string): UserProfile {
  const parsed = parseSubjectInput(rawInput);
  const profile: UserProfile = {
    subjectCode: parsed.code,
    subjectDisplay: parsed.display,
  };
  userProfiles.set(chatId, profile);
  saveProfiles(userProfiles);
  awaitingSubject.delete(chatId);
  return profile;
}
