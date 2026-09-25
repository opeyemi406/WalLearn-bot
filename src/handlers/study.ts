import { Context, InlineKeyboard } from "grammy";
import { walrus } from "../walrus/client.js";
import {
  hasUserSubject,
  getUserSubject,
  getUserSubjectDisplay,
  sessions,
  QuizSession,
  Question,
  awaitingSubject,
} from "../state.js";
import { askAi } from "../ai/client.js";
import { buildQuizGeneratorPrompt } from "../ai/prompts.js";
import { sendQuestion } from "./quiz-helper.js";

export async function handleStudy(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // 1. Check if user has configured an active course/subject
  if (!hasUserSubject(chatId)) {
    awaitingSubject.add(chatId);

    const askMsg = `📚 *What course or subject are you studying?*

Before we begin your drill, please reply with your *Course Code* and *Course Title by the side*, for example:
👉 \`BCH201 - General Biochemistry\`
👉 \`CSC302 - Operating Systems\`
👉 \`PCL301 - Clinical Pharmacokinetics\`

📎 *Tip:* You can also attach your lecture slide or notes PDF directly to generate questions tailored specifically to your class material!`;

    await ctx.reply(askMsg, { parse_mode: "Markdown" });
    return;
  }

  const subjectCode = getUserSubject(chatId);
  const subjectDisplay = getUserSubjectDisplay(chatId);

  const statusMsg = await ctx.reply(
    `🧠 _Recalling your past mistakes from Walrus for ${subjectDisplay}..._`,
    { parse_mode: "Markdown" }
  );

  try {
    // 2. Cold recall weakness briefing from Walrus
    const briefing = await walrus.getWeaknessBriefing(subjectCode);

    let briefingNotice = `🎯 *Starting Study Drill: ${subjectDisplay}*\n`;
    if (briefing.weaknesses.length > 0) {
      briefingNotice += `_Recalled ${briefing.weaknesses.length} active weak topics from Walrus Mainnet. Applying 60/30/10 drill ratio..._\n`;
    } else {
      briefingNotice += `_No prior mistakes found on Walrus. Generating foundational high-yield CBT questions..._\n`;
    }

    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      briefingNotice + "\n⏳ _Generating CBT questions via Gemini 3.5 Flash..._",
      { parse_mode: "Markdown" }
    );

    // 3. Call Gemini to generate questions
    const prompt = buildQuizGeneratorPrompt(
      `Core curriculum and exam benchmarks for university course ${subjectDisplay} (Code: ${subjectCode.toUpperCase()}).`,
      briefing,
      5
    );

    const rawResponse = await askAi([
      {
        role: "system",
        content: "You are an expert exam question generator that outputs strict, valid JSON only.",
      },
      { role: "user", content: prompt },
    ]);

    // Clean JSON response (strip markdown wrappers if present)
    const cleanedJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedJson);

    const questions: Question[] = parsed.questions;
    if (!questions || questions.length === 0) {
      throw new Error("No questions parsed from AI response.");
    }

    // 4. Initialize session
    const session: QuizSession = {
      subject: subjectCode,
      questions,
      currentIndex: 0,
      score: 0,
      startedAt: new Date(),
    };
    sessions.set(chatId, session);

    // 5. Send first question
    await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    await sendQuestion(ctx, session);
  } catch (error) {
    console.error("Error in handleStudy:", error);
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      "⚠️ Failed to generate quiz. Please try again with /study."
    );
  }
}
