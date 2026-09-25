import { Context, InlineKeyboard } from "grammy";
import { walrus } from "../walrus/client.js";
import {
  hasUserSubject,
  getUserSubject,
  getUserSubjectDisplay,
  sessions,
  pendingSlides,
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

  // Check if user specified a number directly in the command (e.g., /study 10)
  const text = ctx.message?.text || "";
  const match = text.match(/^\/study\s*(\d+)/i);
  if (match) {
    const requestedCount = parseInt(match[1], 10);
    const validCount = Math.min(Math.max(requestedCount, 3), 30);
    return startQuizWithCount(ctx, validCount);
  }

  const subjectDisplay = getUserSubjectDisplay(chatId);
  const pending = pendingSlides.get(chatId);

  const keyboard = new InlineKeyboard()
    .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
    .text("🎯 10 Questions (Standard)", "start_quiz_10")
    .row()
    .text("🔥 20 Questions (Exam Mode)", "start_quiz_20");

  let msg = `📚 *Course:* *${subjectDisplay}*\n`;
  if (pending) {
    msg += `📎 *Attached Slide:* _"${pending.fileName}"_\n`;
  }
  msg += `\n🎯 *How many questions would you like to drill?*\n`;
  msg += `Select an option below or type e.g. \`/study 10\`:\n\n`;
  if (!pending) {
    msg += `_💡 Optional: You can attach a lecture slide PDF anytime to quiz from specific slide topics!_`;
  }

  await ctx.reply(msg, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

export async function startQuizWithCount(ctx: Context, count: number) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const subjectCode = getUserSubject(chatId);
  const subjectDisplay = getUserSubjectDisplay(chatId);
  const pending = pendingSlides.get(chatId);

  let materialDesc = pending
    ? `lecture slides "${pending.fileName}"`
    : `curriculum benchmarks for ${subjectDisplay}`;

  const statusMsg = await ctx.reply(
    `🧠 _Recalling your past mistakes from Walrus for ${subjectDisplay}..._`,
    { parse_mode: "Markdown" }
  );

  try {
    // 1. Cold recall weakness briefing from Walrus
    const briefing = await walrus.getWeaknessBriefing(subjectCode);

    let briefingNotice = `🎯 *Starting ${count}-Question Drill: ${subjectDisplay}*\n`;
    if (pending) {
      briefingNotice += `📎 *Source:* _"${pending.fileName}"_\n`;
    }
    if (briefing.weaknesses.length > 0) {
      briefingNotice += `_Recalled ${briefing.weaknesses.length} active weak topics from Walrus Mainnet. Applying 60/30/10 drill ratio..._\n`;
    } else {
      briefingNotice += `_No prior mistakes found on Walrus. Generating foundational high-yield CBT questions..._\n`;
    }

    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      briefingNotice + `\n⏳ _Generating ${count} questions via Gemini 3.5 Flash..._`,
      { parse_mode: "Markdown" }
    );

    // 2. Build prompt with slide text or course description
    const materialSource = pending
      ? pending.text
      : `Core curriculum and past question benchmarks for university level ${subjectDisplay} (Code: ${subjectCode.toUpperCase()}).`;

    const prompt = buildQuizGeneratorPrompt(materialSource, briefing, count);

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

    // 3. Initialize session
    const session: QuizSession = {
      subject: subjectCode,
      questions,
      currentIndex: 0,
      score: 0,
      startedAt: new Date(),
    };
    sessions.set(chatId, session);

    // Clean up pending slide once used for quiz
    pendingSlides.delete(chatId);

    // 4. Send first question
    await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    await sendQuestion(ctx, session);
  } catch (error) {
    console.error("Error in startQuizWithCount:", error);
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      `⚠️ Failed to generate ${count}-question quiz. Please try again with /study.`
    );
  }
}
