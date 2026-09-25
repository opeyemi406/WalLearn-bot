import { Context, InlineKeyboard } from "grammy";
import { walrus } from "../walrus/client.js";
import {
  getUserSubject,
  getUserSubjectDisplay,
  hasUserSubject,
  setUserSubject,
  awaitingSubject,
  sessions,
} from "../state.js";
import { askAi } from "../ai/client.js";
import { buildTutorPrompt } from "../ai/prompts.js";
import { evaluateAndRespondAnswer } from "./callback.js";

export async function handleChatMessage(ctx: Context) {
  const chatId = ctx.chat?.id;
  const rawText = ctx.message?.text?.trim();
  if (!chatId || !rawText) return;

  // Skip commands
  if (rawText.startsWith("/")) return;

  // 1. Check if user typed an answer choice (A, B, C, or D) for an active quiz
  const activeSession = sessions.get(chatId);
  const letterMatch = rawText.match(/^(?:option|choice)?\s*([a-d])(?:\b|\.|\))/i);
  if (activeSession && letterMatch) {
    const selectedOpt = letterMatch[1].toUpperCase();
    return evaluateAndRespondAnswer(ctx, activeSession.currentIndex, selectedOpt, activeSession, true);
  }

  // 2. Check if we are waiting for the user to set their course or if they typed a course format
  const isAwaiting = awaitingSubject.has(chatId) || !hasUserSubject(chatId);
  const looksLikeCourse = /^[a-zA-Z]{2,5}\s*\d{2,4}/i.test(rawText);

  if (isAwaiting || looksLikeCourse) {
    const profile = setUserSubject(chatId, rawText);

    const keyboard = new InlineKeyboard()
      .text("⚡ 5 Questions", "start_quiz_5")
      .text("🎯 10 Questions", "start_quiz_10")
      .row()
      .text("🔥 20 Questions", "start_quiz_20")
      .text("📎 Attach Slides Guide", "upload_guide");

    let response = `✅ *Active Course Set:* *${profile.subjectDisplay}*\n`;
    response += `⛓️ *Walrus Protocol Namespace:* \`${profile.subjectCode}\`\n\n`;
    response += `🎯 *Choose your study mode below:*\n`;
    response += `• *Select question count* to start drilling immediately.\n`;
    response += `• *Attach a lecture slide PDF* anytime to generate a quiz specifically from your lecture notes!\n`;

    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  // 3. Check if user expressed intent to study or take a quiz
  const isStudyIntent = /^(quiz|study|start|drill|test|test me|quiz me|start quiz|start drill|practice|questions)/i.test(rawText);
  if (isStudyIntent) {
    const { handleStudy } = await import("./study.js");
    return handleStudy(ctx);
  }

  // 4. Freeform AI tutor chat with cold recall of past mistakes
  const subjectCode = getUserSubject(chatId);
  const subjectDisplay = getUserSubjectDisplay(chatId);

  await ctx.replyWithChatAction("typing");

  try {
    // Cold recall memories related to the user's message & subject
    const memories = await walrus.recall(`${rawText} in ${subjectCode}`, subjectCode);

    // Build tutor prompt with past mistakes context
    const prompt = buildTutorPrompt(
      `Course: ${subjectDisplay}\nStudent Question: ${rawText}`,
      memories
    );

    // Ask Gemini
    const response = await askAi([
      {
        role: "system",
        content: `You are WalLearn, an honest, encouraging, and razor-sharp academic study tutor for the course ${subjectDisplay}. You hold the student accountable to their past mistake history stored on Walrus Protocol.`,
      },
      { role: "user", content: prompt },
    ]);

    // Check if the response contains multiple-choice choices
    const hasOptions = /\bA\b[\).:]/i.test(response) && /\bB\b[\).:]/i.test(response);
    let replyKeyboard: InlineKeyboard | undefined = undefined;

    if (hasOptions) {
      replyKeyboard = new InlineKeyboard()
        .text("A", "start_drill")
        .text("B", "start_drill")
        .row()
        .text("C", "start_drill")
        .text("D", "start_drill")
        .row()
        .text("🎯 Start Interactive CBT Drill (/study)", "start_drill");
    }

    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: replyKeyboard,
    }).catch(async () => {
      // Fallback if markdown parsing fails
      await ctx.reply(response, { reply_markup: replyKeyboard });
    });
  } catch (error) {
    console.error("Error in handleChatMessage:", error);
    await ctx.reply("⚠️ Sorry, I encountered an error processing your question. Please try again.");
  }
}
