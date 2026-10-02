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
  subjectDisplay: string; // e.g. "PCL301 - Evaluation of Drug Toxicity"
  pastCourses?: string[];
}

export interface PendingSlide {
  text: string;
  fileName: string;
  courseCode: string;
}

const PROFILES_FILE = path.resolve(process.cwd(), "data/user-profiles.json");
const LEDGER_FILE = path.resolve(process.cwd(), "data/mistakes-ledger.json");

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

export const sessions = new Map<number, QuizSession>();
export const pendingSlides = new Map<number, PendingSlide>();
const userProfiles = loadProfiles();
export const awaitingSubject = new Set<number>();

export function getPastCourseCodesForUser(chatId: number): string[] {
  const codes = new Set<string>();

  // 1. Current profile subject & pastCourses history
  const profile = userProfiles.get(chatId);
  if (profile?.subjectCode && /^[a-z]{2,5}\d{2,4}$/i.test(profile.subjectCode)) {
    codes.add(profile.subjectCode.toLowerCase());
  }
  if (profile?.pastCourses) {
    for (const c of profile.pastCourses) {
      if (/^[a-z]{2,5}\d{2,4}$/i.test(c)) {
        codes.add(c.toLowerCase());
      }
    }
  }

  // 2. Records in local ledger for this user
  try {
    if (fs.existsSync(LEDGER_FILE)) {
      const records: Array<{ chatId?: number; namespace?: string }> = JSON.parse(
        fs.readFileSync(LEDGER_FILE, "utf8")
      );
      for (const r of records) {
        if (r.chatId === chatId && r.namespace && /^[a-z]{2,5}\d{2,4}$/i.test(r.namespace)) {
          codes.add(r.namespace.toLowerCase());
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return Array.from(codes);
}

export function hasUserSubject(chatId: number): boolean {
  return userProfiles.has(chatId);
}

export function getUserSubject(chatId: number): string {
  const profile = userProfiles.get(chatId);
  return profile?.subjectCode || "";
}

export function getUserSubjectDisplay(chatId: number): string {
  const profile = userProfiles.get(chatId);
  return profile?.subjectDisplay || "None (Not set yet)";
}

export function parseSubjectInput(input: string): { code: string; display: string } {
  let trimmed = input.trim();
  // Strip duplicate course codes like "PCL 301 - PCL 301 Evaluation..."
  trimmed = trimmed.replace(/^([a-zA-Z]{2,5}\s*\d{2,4})[\s:\-–—]+([a-zA-Z]{2,5}\s*\d{2,4})[\s:\-–—]*/i, "$1 - ");

  // 1. Match standard format: "CODE - Title" or "CODE: Title" or "CODE Title"
  const match = trimmed.match(/^([a-zA-Z]{2,5}\s*\d{2,4})[\s:\-–—]+(.*)$/i);
  if (match) {
    const rawCode = match[1].replace(/\s+/g, "").toLowerCase();
    let title = match[2].trim();
    title = title.replace(/^([a-zA-Z]{2,5}\s*\d{2,4})[\s:\-–—]*/i, "").trim();
    return {
      code: rawCode,
      display: title ? `${match[1].toUpperCase().replace(/\s+/g, "")} - ${title}` : match[1].toUpperCase().replace(/\s+/g, ""),
    };
  }

  // 2. Standalone code like "PCL301" or "BIO101"
  const codeMatch = trimmed.match(/^([a-zA-Z]{2,5}\s*\d{2,4})$/i);
  if (codeMatch) {
    const code = codeMatch[1].replace(/\s+/g, "").toLowerCase();
    return {
      code,
      display: code.toUpperCase(),
    };
  }

  // 3. Check if course code appears anywhere inside the text (e.g. "drill on PCL301" or "Toxicity in PCL 301")
  const anyCode = trimmed.match(/\b([a-zA-Z]{2,5}\s*\d{2,4})\b/i);
  if (anyCode) {
    const rawCode = anyCode[1].replace(/\s+/g, "").toLowerCase();
    const cleanCode = anyCode[1].toUpperCase().replace(/\s+/g, "");
    let title = trimmed.replace(anyCode[0], "").replace(/^[\s:\-–—]+|[\s:\-–—]+$/g, "").trim();
    return {
      code: rawCode,
      display: title ? `${cleanCode} - ${title}` : cleanCode,
    };
  }

  // 4. Fallback slug for freeform topic names
  const cleanSlug = trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 24);
  return {
    code: cleanSlug || "general",
    display: trimmed,
  };
}

export function isValidCourseInput(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length < 2) return false;
  // Reject menu selection attempts like A, B, C, D or 1, 2, 3
  if (/^(?:option\s*)?[a-d]$/i.test(trimmed) || /^[0-9]$/.test(trimmed)) return false;
  // Reject conversational greetings or commands
  if (/^(hi|hello|hey|start|help|menu|clear|reset|study|prep|yes|no|ok|sure|option)$/i.test(trimmed)) return false;

  const hasCoursePattern = /[a-zA-Z]{2,5}\s*\d{2,4}/i.test(trimmed);
  const isMeaningfulTitle = trimmed.length >= 4 && /[a-zA-Z]/.test(trimmed);
  return hasCoursePattern || isMeaningfulTitle;
}

export function isValidTopicInput(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length < 3) return false;
  // Reject menu selection numbers like 1, 2, 3 or option 1/2/3
  if (/^(?:option\s*)?[1-4]$/i.test(trimmed)) return false;
  // Reject menu options like A, B, C, D
  if (/^(?:option\s*)?[a-d]$/i.test(trimmed)) return false;
  // Reject single words like "topic", "slide", "slides"
  if (/^(topic|slide|slides|option|select|menu|help|start|quiz|study|yes|no)$/i.test(trimmed)) return false;
  // Must contain letters
  return /[a-zA-Z]{2,}/.test(trimmed);
}

export function setUserSubject(chatId: number, rawInput: string): UserProfile {
  let parsed = parseSubjectInput(rawInput);
  const isGenericCode = parsed.code === "general" || !/^[a-z]{2,5}\d{2,4}$/i.test(parsed.code);

  // If the user's input was just a topic without a course code, inherit from current active session
  if (isGenericCode) {
    const existing = userProfiles.get(chatId);
    if (existing && /^[a-z]{2,5}\d{2,4}$/i.test(existing.subjectCode)) {
      parsed = {
        code: existing.subjectCode,
        display: `${existing.subjectCode.toUpperCase()} - ${parsed.display}`,
      };
    }
  }

  // If changing to a different course code, purge cached slides and active quiz sessions
  const oldProfile = userProfiles.get(chatId);
  if (oldProfile && oldProfile.subjectCode.toLowerCase() !== parsed.code.toLowerCase()) {
    pendingSlides.delete(chatId);
    sessions.delete(chatId);
  }

  const existingPast = oldProfile?.pastCourses || [];
  const cleanCode = parsed.code.toLowerCase();
  const pastCourses = [...existingPast];
  if (/^[a-z]{2,5}\d{2,4}$/i.test(cleanCode) && !pastCourses.includes(cleanCode)) {
    pastCourses.push(cleanCode);
  }

  const profile: UserProfile = {
    subjectCode: parsed.code,
    subjectDisplay: parsed.display,
    pastCourses,
  };

  userProfiles.set(chatId, profile);
  saveProfiles(userProfiles);
  awaitingSubject.delete(chatId);
  return profile;
}

export function clearUserProfile(chatId: number) {
  const oldProfile = userProfiles.get(chatId);
  userProfiles.delete(chatId);
  if (oldProfile?.pastCourses && oldProfile.pastCourses.length > 0) {
    userProfiles.set(chatId, {
      subjectCode: "",
      subjectDisplay: "",
      pastCourses: oldProfile.pastCourses,
    });
  }
  saveProfiles(userProfiles);
  sessions.delete(chatId);
  pendingSlides.delete(chatId);
  awaitingStudyTopic.delete(chatId);
  userActiveTopic.delete(chatId);
  awaitingRestoreCourse.delete(chatId);
  awaitingAnalyzeCourse.delete(chatId);
  awaitingPastQuestions.delete(chatId);
  awaitingQuizCount.delete(chatId);
  awaitingStartChoice.delete(chatId);
  awaitingMenuChoice.delete(chatId);
  awaitingBriefingCourse.delete(chatId);
  awaitingSubject.add(chatId);
}

// Prompt listeners & interactive flow states
export const awaitingStartChoice = new Set<number>();
export const awaitingMenuChoice = new Set<number>();
export const awaitingQuizCount = new Set<number>();
export const awaitingRestoreCourse = new Set<number>();
export const awaitingAnalyzeCourse = new Set<number>();
export const awaitingBriefingCourse = new Set<number>();
export const awaitingPastQuestions = new Map<number, string>(); // chatId -> courseCode
export const awaitingStudyTopic = new Map<number, string>(); // chatId -> courseCode
export const userActiveTopic = new Map<number, string>(); // chatId -> topicName

export function clearAwaitingStates(chatId: number) {
  awaitingStartChoice.delete(chatId);
  awaitingMenuChoice.delete(chatId);
  awaitingQuizCount.delete(chatId);
  awaitingRestoreCourse.delete(chatId);
  awaitingAnalyzeCourse.delete(chatId);
  awaitingBriefingCourse.delete(chatId);
}

const EXAM_STYLES_FILE = path.resolve(process.cwd(), "data/exam-styles.json");

function loadExamStyles(): Record<string, string> {
  try {
    if (fs.existsSync(EXAM_STYLES_FILE)) {
      return JSON.parse(fs.readFileSync(EXAM_STYLES_FILE, "utf8"));
    }
  } catch (e) {
    // ignore
  }
  return {};
}

function saveExamStyles(data: Record<string, string>) {
  try {
    fs.mkdirSync(path.dirname(EXAM_STYLES_FILE), { recursive: true });
    fs.writeFileSync(EXAM_STYLES_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save exam styles:", e);
  }
}

export function getExamStyle(courseCode: string, chatId?: number): string | null {
  const styles = loadExamStyles();
  const cleanCode = courseCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Try user-specific first
  if (chatId) {
    const userKey = `u${chatId}_${cleanCode}`;
    if (styles[userKey]) return styles[userKey];
  }
  return styles[cleanCode] || null;
}

export function setExamStyle(courseCode: string, styleText: string, chatId?: number): void {
  const styles = loadExamStyles();
  const cleanCode = courseCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = chatId ? `u${chatId}_${cleanCode}` : cleanCode;
  styles[key] = styleText;
  styles[cleanCode] = styleText;
  saveExamStyles(styles);
}

