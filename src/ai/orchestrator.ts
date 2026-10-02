import { askAi } from "./client.js";

export interface OrchestratorContext {
  hasActiveCourse: boolean;
  activeCourseCode?: string;
  activeCourseDisplay?: string;
  activeTopic?: string;
  awaitingContext?: "restore" | "analyze" | "quiz_count" | "topic" | "subject" | "start" | "menu" | "view_briefing" | null;
  knownCourses?: string[];
}

export interface OrchestrationResult {
  intent:
    | "set_course"
    | "start_drill"
    | "set_topic"
    | "restore_memory"
    | "view_briefing"
    | "analyze_past_q"
    | "menu_action"
    | "reset_session"
    | "tutor_chat";
  courseCode?: string | null;
  courseDisplay?: string | null;
  topic?: string | null;
  questionCount?: number | null;
  scope?: "all" | "single" | null;
  menuOption?: number | null;
  confidence: number;
}

/**
 * Classify user natural language message into a structured intent & extracted entities
 */
export async function orchestrateUserMessage(
  userText: string,
  ctx: OrchestratorContext
): Promise<OrchestrationResult> {
  const trimmed = userText.trim();

  // Fast-path 1: Single digits (1, 2, 3, 4, 5) or "option X"
  const digitMatch = trimmed.match(/^(?:option\s*)?([1-5])$/i);
  if (digitMatch) {
    const opt = parseInt(digitMatch[1], 10);
    // If waiting for quiz count (5, 10, 20, 30, 40):
    if (ctx.awaitingContext === "quiz_count") {
      const count = opt === 1 ? 5 : opt === 2 ? 10 : opt === 3 ? 20 : opt === 4 ? 30 : opt === 5 ? 40 : 5;
      return { intent: "start_drill", questionCount: count, confidence: 1.0 };
    }
    return { intent: "menu_action", menuOption: opt, confidence: 1.0 };
  }

  // Fast-path 2: Common quiz counts (5, 10, 15, 20, 25, 30, 35, 40) or sprint/standard/exam/deep drill/mock
  if (/^(5|10|15|20|25|30|35|40)\b/i.test(trimmed) && (ctx.awaitingContext === "quiz_count" || ctx.hasActiveCourse)) {
    const num = parseInt(trimmed.match(/\d+/)![0], 10);
    return { intent: "start_drill", questionCount: Math.min(Math.max(num, 3), 40), confidence: 1.0 };
  }
  if (/^(sprint|standard|exam|exam\s*mode|deep|deep\s*drill|mock|full\s*mock)$/i.test(trimmed)) {
    const count = /sprint/i.test(trimmed) ? 5 : /mock/i.test(trimmed) ? 40 : /deep/i.test(trimmed) ? 30 : /exam/i.test(trimmed) ? 20 : 10;
    return { intent: "start_drill", questionCount: count, confidence: 1.0 };
  }

  // Fast-path 3: Standalone course code (e.g. "ANA201", "PCL301", "BIO101")
  const standaloneCode = trimmed.match(/^([a-zA-Z]{2,5}\s*\d{2,4})(?:\s*[-–—:]\s*(.+))?$/i);
  if (standaloneCode) {
    const code = standaloneCode[1].toUpperCase().replace(/\s+/g, "");
    const title = standaloneCode[2]?.trim();
    if (ctx.awaitingContext === "restore") {
      return { intent: "restore_memory", courseCode: code, scope: "single", confidence: 1.0 };
    }
    if (ctx.awaitingContext === "analyze") {
      return { intent: "analyze_past_q", courseCode: code, confidence: 1.0 };
    }
    if (ctx.awaitingContext === "view_briefing") {
      return { intent: "view_briefing", courseCode: code, scope: "single", confidence: 1.0 };
    }
    return {
      intent: "set_course",
      courseCode: code,
      courseDisplay: title ? `${code} - ${title}` : code,
      confidence: 1.0,
    };
  }

  // Fast-path 4: Explicit reset / clear
  if (/^(reset|clear|wipe|start\s*over|restart)$/i.test(trimmed)) {
    return { intent: "reset_session", confidence: 1.0 };
  }

  // AI-Powered Natural Language Orchestration
  const prompt = `You are the Natural Language Intent Router for WalLearn, an on-chain academic CBT study Telegram bot.
Classify the student's message into one of these intents and extract parameters as strict JSON.

Current Student Context:
- Active Course: ${ctx.activeCourseDisplay || ctx.activeCourseCode || "None"}
- Active Topic: ${ctx.activeTopic || "None"}
- Awaiting Context: ${ctx.awaitingContext || "None"}
- Known Student Courses: ${ctx.knownCourses?.join(", ") || "None"}

Allowed Intents:
1. "set_course": Student wants to set, switch, or study a course (e.g., "let's do ANA201", "switch to pharmacology", "study BIO101").
2. "start_drill": Student wants to take a test, practice quiz, drill questions, or specifies a question count (e.g., "quiz me", "start 10 questions on thorax", "drill now", "give me 5 questions in ANA201").
3. "set_topic": Student is naming a topic to study within their current course (e.g., "Thorax and Mediastinum", "Pharmacokinetics", "Cardiovascular system", "test me on Upper Limb").
4. "restore_memory": Student wants to recover or restore on-chain mistakes/records from Walrus Protocol (e.g., "restore my mistakes", "recover PCL301", "restore all courses").
5. "view_briefing": Student wants their weakness briefing, mistakes overview, or report (e.g., "show my weaknesses", "how am I doing in anatomy?", "view briefing").
6. "analyze_past_q": Student wants to analyze past department exam papers/questions (e.g., "analyze past questions", "past questions for ANA204").
7. "menu_action": Student selects menu options 1, 2, 3, or 4 (or words like "study directly", "slides guide", "menu").
8. "reset_session": Student wants to wipe/reset their session or start over.
9. "tutor_chat": Student is asking an academic question about concepts, facts, or anatomy/science (e.g., "why does the left recurrent laryngeal nerve loop under the aorta?", "explain bioavailability").

Output Schema:
{
  "intent": "set_course" | "start_drill" | "set_topic" | "restore_memory" | "view_briefing" | "analyze_past_q" | "menu_action" | "reset_session" | "tutor_chat",
  "courseCode": string or null (e.g. "ANA201", normalized uppercase without spaces),
  "courseDisplay": string or null,
  "topic": string or null,
  "questionCount": number or null (e.g. 5, 10, 20, 30, 40),
  "scope": "all" or "single" or null,
  "menuOption": number or null (1, 2, 3, 4),
  "confidence": number (0.0 to 1.0)
}

Student Message: "${trimmed}"`;

  try {
    const rawAi = await askAi(
      [
        { role: "system", content: "You output only valid JSON matching the exact schema provided." },
        { role: "user", content: prompt },
      ],
      0.1,
      true
    );

    const parsed = JSON.parse(rawAi);
    return {
      intent: parsed.intent || "tutor_chat",
      courseCode: parsed.courseCode ? parsed.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "") : null,
      courseDisplay: parsed.courseDisplay || null,
      topic: parsed.topic || null,
      questionCount: parsed.questionCount ? parseInt(parsed.questionCount, 10) : null,
      scope: parsed.scope || null,
      menuOption: parsed.menuOption ? parseInt(parsed.menuOption, 10) : null,
      confidence: parsed.confidence || 0.8,
    };
  } catch (err) {
    console.warn("Orchestrator AI parse fallback:", err);
    // Intelligent fallback based on keywords
    if (/restore|recover/i.test(trimmed)) {
      return { intent: "restore_memory", scope: /all/i.test(trimmed) ? "all" : "single", confidence: 0.7 };
    }
    if (/briefing|weakness|report/i.test(trimmed)) {
      return { intent: "view_briefing", scope: /all/i.test(trimmed) ? "all" : "single", confidence: 0.7 };
    }
    if (/quiz|study|drill|practice/i.test(trimmed)) {
      return { intent: "start_drill", confidence: 0.7 };
    }
    return { intent: "tutor_chat", confidence: 0.5 };
  }
}
