import { Question } from "../state.js";

/**
 * Robust JSON cleaner and parser specifically tailored for LLM generated exam questions.
 * Handles:
 * - Markdown fences (```json ... ```)
 * - Leading / trailing text
 * - Illegal JSON escape characters (e.g. \alpha, \beta, \Delta, \O, \s)
 * - Unescaped quotes inside strings
 * - Trailing commas before } or ]
 * - Fallback regex-based extraction of question objects if JSON is severely malformed
 */
export function cleanAndParseQuizJson(raw: string): { questions: Question[] } {
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty AI response received.");
  }

  // 1. Strip markdown code fences if present
  let str = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();

  // 2. Extract substring between first '{' and last '}'
  const firstBrace = str.indexOf("{");
  const lastBrace = str.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    str = str.slice(firstBrace, lastBrace + 1);
  }

  // 3. Attempt 1: Standard JSON.parse
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed;
    }
  } catch {
    // Proceed to repair
  }

  // 4. Attempt 2: Fix illegal escapes & trailing commas
  // In JSON, only \" \\ \/ \b \f \n \r \t \uXXXX are valid.
  // Any other \ followed by a character is illegal in JSON.
  let repaired = str
    // Escape invalid backslashes (e.g. \alpha -> \\alpha)
    .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\")
    // Remove trailing commas before } or ]
    .replace(/,\s*([}\]])/g, "$1");

  try {
    const parsed = JSON.parse(repaired);
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed;
    }
  } catch {
    // Proceed to more aggressive repair
  }

  // 5. Attempt 3: Fix unescaped control chars and newlines in strings
  repaired = repaired.replace(/[\x00-\x1F\x7F-\x9F]/g, (c) => {
    if (c === "\n") return "\\n";
    if (c === "\r") return "\\r";
    if (c === "\t") return "\\t";
    return "";
  });

  try {
    const parsed = JSON.parse(repaired);
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed;
    }
  } catch {
    // Fall back to regex parser
  }

  // 6. Attempt 4: Resilient regex question extractor
  console.warn("Attempting regex recovery of questions from AI response...");
  const questions = extractQuestionsWithRegex(raw);
  if (questions.length > 0) {
    console.log(`✅ Regex recovery salvaged ${questions.length} questions from malformed JSON!`);
    return { questions };
  }

  throw new Error("Unable to parse or salvage questions from AI output.");
}

/**
 * Regex extractor to salvage individual question objects from malformed JSON
 */
function extractQuestionsWithRegex(text: string): Question[] {
  const questions: Question[] = [];

  // Split by question boundaries (e.g. { "id": or { "stem":)
  const chunks = text.split(/(?=\{\s*"?id"?\s*:|\{\s*"?stem"?\s*:)/i);

  let idCounter = 1;
  for (const chunk of chunks) {
    try {
      const stemMatch = chunk.match(/"stem"\s*:\s*"([\s\S]*?)(?<!\\)"/i);
      const correctMatch = chunk.match(/"correct"\s*:\s*"([A-D])"/i);
      const optAMatch = chunk.match(/"A"\s*:\s*"([\s\S]*?)(?<!\\)"/i);
      const optBMatch = chunk.match(/"B"\s*:\s*"([\s\S]*?)(?<!\\)"/i);
      const optCMatch = chunk.match(/"C"\s*:\s*"([\s\S]*?)(?<!\\)"/i);
      const optDMatch = chunk.match(/"D"\s*:\s*"([\s\S]*?)(?<!\\)"/i);

      if (stemMatch && correctMatch && optAMatch && optBMatch && optCMatch && optDMatch) {
        const topicMatch = chunk.match(/"topic"\s*:\s*"([\s\S]*?)(?<!\\)"/i);
        const factMatch = chunk.match(/"fact"\s*:\s*"([\s\S]*?)(?<!\\)"/i);

        questions.push({
          id: idCounter++,
          stem: stemMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim(),
          options: {
            A: optAMatch[1].replace(/\\"/g, '"').trim(),
            B: optBMatch[1].replace(/\\"/g, '"').trim(),
            C: optCMatch[1].replace(/\\"/g, '"').trim(),
            D: optDMatch[1].replace(/\\"/g, '"').trim(),
          },
          correct: correctMatch[1].toUpperCase() as "A" | "B" | "C" | "D",
          topic: topicMatch ? topicMatch[1].trim() : "Core Concept",
          traps: {},
          fact: factMatch ? factMatch[1].trim() : `The correct answer is Option ${correctMatch[1].toUpperCase()}.`,
        });
      }
    } catch {
      // Continue
    }
  }

  return questions;
}
