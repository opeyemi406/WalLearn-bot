import { Context, InlineKeyboard } from "grammy";
import { walrus } from "../walrus/client.js";
import {
  getUserSubject,
  getUserSubjectDisplay,
  hasUserSubject,
  setUserSubject,
  isValidCourseInput,
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

  // 2. Check if user is responding with a course code for /restore
  const { awaitingRestoreCourse } = await import("../state.js");
  if (awaitingRestoreCourse.has(chatId)) {
    awaitingRestoreCourse.delete(chatId);
    const { executeRestoreCourse } = await import("./restore.js");
    return executeRestoreCourse(ctx, rawText);
  }

  // 3. Check if user is responding with a course code for /analyze
  const { awaitingAnalyzeCourse, awaitingPastQuestions } = await import("../state.js");
  if (awaitingAnalyzeCourse.has(chatId)) {
    awaitingAnalyzeCourse.delete(chatId);
    const { promptForQuestions } = await import("./analyze.js");
    return promptForQuestions(ctx, rawText);
  }

  // 4. Check if user is sending past MCQ questions as text
  if (awaitingPastQuestions.has(chatId)) {
    const courseCode = awaitingPastQuestions.get(chatId)!;
    const { processPastQuestionsAnalysis } = await import("./analyze.js");
    return processPastQuestionsAnalysis(ctx, rawText, courseCode);
  }

  // 4.5 Check if user is replying to the /start onboarding menu with an option (A, B, C or 1, 2, 3)
  const isStartMenuSelection = /^(?:option\s*)?([a-c]|1|2|3)$/i.test(rawText);
  if (!hasUserSubject(chatId) && isStartMenuSelection) {
    const opt = rawText.replace(/option\s*/i, "").trim().toUpperCase();
    if (opt === "A" || opt === "1") {
      const { handleAnalyze } = await import("./analyze.js");
      return handleAnalyze(ctx);
    }
    if (opt === "B" || opt === "2") {
      awaitingSubject.add(chatId);
      await ctx.reply(
        `📚 *Ready to Study Directly!*\n\n` +
        `Please reply with your *Course Code & Title* (e.g. \`PCL301 - Evaluation of Drug Toxicity\` or \`BIO101\`):\n\n` +
        `_You can also attach your lecture slides (PDF, PPTX, Word) directly!_`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    if (opt === "C" || opt === "3") {
      const { handleRestore } = await import("./restore.js");
      return handleRestore(ctx);
    }
  }

  // 5. Check if we are waiting for the user to set their course or if they typed a course format
  const isAwaiting = awaitingSubject.has(chatId) || !hasUserSubject(chatId);
  const looksLikeCourse = /^[a-zA-Z]{2,5}\s*\d{2,4}/i.test(rawText);

  if (isAwaiting || looksLikeCourse) {
    if (!isValidCourseInput(rawText)) {
      await ctx.reply(
        `⚠️ *Invalid Course Input: "${rawText}"*\n\n` +
        `Please reply with a valid *Course Code & Title* (e.g. \`PCL301 - Evaluation of Drug Toxicity\` or \`BIO101 - General Biology\`) to begin studying.\n\n` +
        `_Tip: You can also upload your slide file (PDF/PPTX) directly!_`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const profile = setUserSubject(chatId, rawText);
    awaitingSubject.delete(chatId);

    const keyboard = new InlineKeyboard()
      .text("⚡ 5 Questions", "start_quiz_5")
      .text("🎯 10 Questions", "start_quiz_10")
      .row()
      .text("🔥 20 Questions", "start_quiz_20");

    let response = `✅ *Active Course Set:* *${profile.subjectDisplay}*\n`;
    response += `⛓️ *Walrus Protocol Namespace:* \`${profile.subjectCode}\`\n\n`;
    response += `📂 *Upload Lecture Slides (Optional)*\n`;
    response += `If you have lecture slides for this course, upload your slide file now (PDF, PPTX, Word) to quiz directly from your material.\n\n`;
    response += `🚀 *Don't have slides?* No problem! Select how many questions below and let's start drilling immediately:`;

    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  // 3. Check if user expressed intent to study or take a quiz, or indicated no slides
  const isStudyIntent = /^(quiz|study|start|drill|test|test me|quiz me|start quiz|start drill|practice|questions|no|none|no slides|no slide|i don'?t have slides?)/i.test(rawText.trim());
  if (isStudyIntent) {
    const { handleStudy } = await import("./study.js");
    return handleStudy(ctx);
  }

  // 4. Freeform AI tutor chat with cold recall of past mistakes
  const subjectCode = getUserSubject(chatId);
  const subjectDisplay = getUserSubjectDisplay(chatId);

  await ctx.replyWithChatAction("typing");

  try {
    // Cold recall memories related to the user's message & subject (user-isolated)
    const memories = await walrus.recall(`${rawText} in ${subjectCode}`, subjectCode, chatId);

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
