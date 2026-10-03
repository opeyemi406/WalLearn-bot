import type { MistakeEntry } from "./types.js";

/**
 * Event-sourced memory format.
 *
 * Every state change is written to Walrus as one self-describing text line.
 * The learner's state (misses, streak, mastered) is rebuilt by replaying those
 * lines in time order, so a fresh container can recover everything from Walrus.
 */

const clean = (s: string | undefined) =>
  (s ?? "").replace(/[|\r\n]+/g, " ").replace(/\s+/g, " ").trim();

export function formatMistake(m: MistakeEntry, at: string): string {
  return `[MISTAKE] Topic: ${clean(m.topic)} | Question: ${clean(m.question)} | Error: ${clean(m.my_error)} | Fact: ${clean(m.correct)} | Severity: ${m.severity} | Misses: ${m.misses} | At: ${at}`;
}

export function formatProgress(topic: string, streak: number, at: string): string {
  return `[PROGRESS] Topic: ${clean(topic)} | Streak: ${streak}/3 | At: ${at}`;
}

export function formatMastered(topic: string, at: string): string {
  return `[MASTERED] Topic: ${clean(topic)} | 3-Streak Passes Confirmed | At: ${at}`;
}

export type MemoryEvent =
  | { kind: "mistake"; topic: string; question: string; error: string; fact: string; severity: "high" | "medium" | "low"; at: number; blobId?: string }
  | { kind: "progress"; topic: string; streak: number; at: number; blobId?: string }
  | { kind: "mastered"; topic: string; at: number; blobId?: string }
  | { kind: "fact"; text: string; at: number; blobId?: string };

// A field must be preceded by "]" or "|" so words like "Format:" inside text never match "At:".
function field(line: string, name: string): string {
  const m = line.match(new RegExp(`(?:\\]|\\|)\\s*${name}:\\s*([^|]*)`, "i"));
  return m ? m[1].trim() : "";
}

export function topicsMatch(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return false;
  if (x === y) return true;
  return x.length >= 6 && y.length >= 6 && (x.includes(y) || y.includes(x));
}

export function parseMemoryLine(line: string, blobId?: string): MemoryEvent | null {
  const text = line.trim();
  if (!text) return null;
  const at = Date.parse(field(text, "At")) || 0;

  if (text.startsWith("[MISTAKE]")) {
    const topic = field(text, "Topic");
    if (!topic) return null;
    const sev = field(text, "Severity").toLowerCase();
    return {
      kind: "mistake",
      topic,
      question: field(text, "Question"),
      error: field(text, "Error"),
      fact: field(text, "Fact"),
      severity: sev === "low" || sev === "medium" ? sev : "high",
      at,
      blobId,
    };
  }
  if (text.startsWith("[PROGRESS]")) {
    const topic = field(text, "Topic");
    const streak = parseInt(field(text, "Streak"), 10);
    if (!topic || Number.isNaN(streak)) return null;
    return { kind: "progress", topic, streak: Math.min(Math.max(streak, 0), 3), at, blobId };
  }
  if (text.startsWith("[MASTERED]")) {
    const topic = field(text, "Topic");
    return topic ? { kind: "mastered", topic, at, blobId } : null;
  }
  // [FACT], [EXAM_FACT], and plain facts extracted by MemWal analyze()
  return { kind: "fact", text, at, blobId };
}

export interface TopicState {
  topic: string;
  question: string;
  misconception: string;
  correctFact: string;
  severity: "high" | "medium" | "low";
  misses: number;
  streak: number;
  status: "confirmed" | "recovering" | "mastered";
  lastAt: number;
  blobId?: string;
}

export function replayEvents(events: MemoryEvent[]): {
  topics: Map<string, TopicState>;
  facts: Array<{ text: string; blobId?: string; at: number }>;
} {
  const sorted = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.at - b.e.at || a.i - b.i).map((x) => x.e);
  const topics = new Map<string, TopicState>();
  const facts: Array<{ text: string; blobId?: string; at: number }> = [];
  const seenFacts = new Set<string>();

  const blank = (topic: string): TopicState => ({
    topic, question: "", misconception: "", correctFact: "", severity: "high",
    misses: 0, streak: 0, status: "confirmed", lastAt: 0,
  });

  for (const e of sorted) {
    if (e.kind === "fact") {
      if (!seenFacts.has(e.text)) {
        seenFacts.add(e.text);
        facts.push({ text: e.text, blobId: e.blobId, at: e.at });
      }
      continue;
    }
    const key = e.topic.toLowerCase().trim();
    const s = topics.get(key) ?? blank(e.topic);
    s.lastAt = e.at || s.lastAt;
    if (e.blobId) s.blobId = e.blobId;
    if (e.kind === "mistake") {
      s.misses += 1;
      s.streak = 0;
      s.status = "confirmed"; // a new mistake always demotes, even from mastered
      s.question = e.question || s.question;
      s.misconception = e.error || s.misconception;
      s.correctFact = e.fact || s.correctFact;
      s.severity = e.severity;
    } else if (e.kind === "progress") {
      s.streak = e.streak;
      s.status = e.streak >= 3 ? "mastered" : e.streak > 0 ? "recovering" : "confirmed";
    } else {
      s.streak = 3;
      s.status = "mastered";
    }
    topics.set(key, s);
  }
  return { topics, facts };
}
