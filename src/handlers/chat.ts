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
  userActiveTopic,
  awaitingRestoreCourse,
  awaitingAnalyzeCourse,
  awaitingPastQuestions,
  awaitingQuizCount,
  awaitingBriefingCourse,
  awaitingStudyTopic,
  getPastCourseCodesForUser,
  clearAwaitingStates,
} from "../state.js";
import { askAi } from "../ai/client.js";
import { buildTutorPrompt } from "../ai/prompts.js";
import { evaluateAndRespondAnswer } from "./callback.js";
import { orchestrateUserMessage } from "../ai/orchestrator.js";
import { formatTelegramMarkdown } from "../utils/telegram-format.js";

export async function handleChatMessage(ctx: Context) {
  const chatId = ctx.chat?.id;
  const rawText = ctx.message?.text?.trim();
  if (!chatId || !rawText) return;

  // 1. Skip native Telegram slash commands (handled instantly by bot.command)
  if (rawText.startsWith("/")) return;

  // 2. Fast-Path: Quiz Answer Choice (A, B, C, D) during active CBT session (0ms delay)
  const activeSession = sessions.get(chatId);
  const letterMatch = rawText.match(/^(?:option|choice)?\s*([a-d])(?:\b|\.|\))/i);
  if (activeSession && letterMatch) {
    const selectedOpt = letterMatch[1].toUpperCase();
    return evaluateAndRespondAnswer(ctx, activeSession.currentIndex, selectedOpt, activeSession, true);
  }

  // 3. Fast-Path: Large paste of past MCQ questions
  const looksLikeMultiQuestions = /(?:\b[1-9]\d?[\.\)]|\b[A-D][\.\)]|\boption\b)/i.test(rawText) && rawText.length > 50;
  if (awaitingPastQuestions.has(chatId) || looksLikeMultiQuestions) {
    let courseCode = awaitingPastQuestions.get(chatId);
    if (!courseCode) {
      const codeMatch = rawText.slice(0, 1000).match(/([a-zA-Z]{2,5}\s*\d{2,4})/i);
      courseCode = codeMatch
        ? codeMatch[1].toUpperCase().replace(/\s+/g, "")
        : (hasUserSubject(chatId) ? getUserSubject(chatId) : "General");
      setUserSubject(chatId, courseCode);
    }
    awaitingPastQuestions.delete(chatId);
    awaitingAnalyzeCourse.delete(chatId);
    const { processPastQuestionsAnalysis } = await import("./analyze.js");
    return processPastQuestionsAnalysis(ctx, rawText, courseCode);
  }

  // 4. Natural Language Orchestrator
  const awaitingCtx =
    awaitingRestoreCourse.has(chatId) ? "restore"
    : awaitingBriefingCourse.has(chatId) ? "view_briefing"
    : awaitingAnalyzeCourse.has(chatId) ? "analyze"
    : awaitingQuizCount.has(chatId) ? "quiz_count"
    : awaitingStudyTopic.has(chatId) ? "topic"
    : awaitingSubject.has(chatId) ? "subject"
    : null;

  const result = await orchestrateUserMessage(rawText, {
    hasActiveCourse: hasUserSubject(chatId),
    activeCourseCode: hasUserSubject(chatId) ? getUserSubject(chatId) : undefined,
    activeCourseDisplay: hasUserSubject(chatId) ? getUserSubjectDisplay(chatId) : undefined,
    activeTopic: userActiveTopic.get(chatId),
    awaitingContext: awaitingCtx,
    knownCourses: getPastCourseCodesForUser(chatId),
  });

  // 5. Dispatch Intent

  // Intent A: Reset Session
  if (result.intent === "reset_session") {
    const { handleReset } = await import("./start.js");
    return handleReset(ctx);
  }

  // Intent B: Menu Action (Numbers 1, 2, 3, 4 or action keywords)
  if (result.intent === "menu_action" && result.menuOption) {
    clearAwaitingStates(chatId);
    const opt = result.menuOption;

    if (!hasUserSubject(chatId)) {
      if (opt === 1) {
        awaitingSubject.add(chatId);
        await ctx.reply(
          `📚 *Ready to Study Directly!*\n\n` +
          `Please reply with your *Course Code & Title* (e.g. \`ANA201 - Human Anatomy\` or \`BIO101\`):\n\n` +
          `_You can also attach your lecture slides (PDF, PPTX, Word) or images directly!_`,
          { parse_mode: "Markdown" }
        );
        return;
      }
      if (opt === 2) {
        const { handleAnalyze } = await import("./analyze.js");
        return handleAnalyze(ctx);
      }
      if (opt === 3) {
        const { handleRestore } = await import("./restore.js");
        return handleRestore(ctx);
      }
      if (opt === 4) {
        const { handleBriefing } = await import("./briefing.js");
        return handleBriefing(ctx);
      }
    } else {
      if (opt === 1) {
        const { handleStudy } = await import("./study.js");
        return handleStudy(ctx);
      }
      if (opt === 2) {
        const { handleBriefing } = await import("./briefing.js");
        return handleBriefing(ctx);
      }
      if (opt === 3) {
        const { handleSubject } = await import("./start.js");
        return handleSubject(ctx);
      }
      if (opt === 4) {
        await ctx.reply(
          formatTelegramMarkdown(
            `📎 *How to Quiz from Your Slides or Images:*\n\n1️⃣ Tap the 📎 attachment icon in Telegram.\n2️⃣ Select your lecture slides (PDF, Word, PPTX) or *images* (JPEG, PNG).\n3️⃣ Send it to this chat!\n\nWalLearn will use Gemini Vision to transcribe the concepts and blend them with your Walrus mistake history to build a personalized exam drill.`
          ),
          { parse_mode: "Markdown" }
        );
        return;
      }
    }
  }

  // Intent C: Restore Memory Blobs
  if (result.intent === "restore_memory") {
    clearAwaitingStates(chatId);
    if (result.scope === "all") {
      const { executeRestoreAll } = await import("./restore.js");
      return executeRestoreAll(ctx);
    }
    if (result.courseCode) {
      const { executeRestoreCourse } = await import("./restore.js");
      return executeRestoreCourse(ctx, result.courseCode);
    }
    const { handleRestore } = await import("./restore.js");
    return handleRestore(ctx);
  }

  // Intent D: Weakness Briefing
  if (result.intent === "view_briefing") {
    clearAwaitingStates(chatId);
    if (result.scope === "all") {
      const { executeBriefingAll } = await import("./briefing.js");
      return executeBriefingAll(ctx);
    }
    if (result.courseCode) {
      const { executeBriefingCourse } = await import("./briefing.js");
      return executeBriefingCourse(ctx, result.courseCode);
    }
    const { handleBriefing } = await import("./briefing.js");
    return handleBriefing(ctx);
  }

  // Intent E: Analyze Past Questions
  if (result.intent === "analyze_past_q") {
    clearAwaitingStates(chatId);
    if (result.courseCode) {
      const { promptForQuestions } = await import("./analyze.js");
      return promptForQuestions(ctx, result.courseCode);
    }
    const { handleAnalyze } = await import("./analyze.js");
    return handleAnalyze(ctx);
  }

  // Intent F: Start Quiz Drill
  if (result.intent === "start_drill") {
    clearAwaitingStates(chatId);
    if (result.courseCode) {
      setUserSubject(chatId, result.courseCode);
    }
    if (result.topic) {
      userActiveTopic.set(chatId, result.topic);
    }
    if (result.questionCount) {
      const { startQuizWithCount } = await import("./study.js");
      return startQuizWithCount(ctx, result.questionCount);
    }
    const { handleStudy } = await import("./study.js");
    return handleStudy(ctx);
  }

  // Intent G: Set Topic
  if (result.intent === "set_topic") {
    clearAwaitingStates(chatId);
    const topic = result.topic || rawText;
    userActiveTopic.set(chatId, topic);

    if (result.questionCount) {
      const { startQuizWithCount } = await import("./study.js");
      return startQuizWithCount(ctx, result.questionCount);
    }

    awaitingQuizCount.add(chatId);
    const keyboard = new InlineKeyboard()
      .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
      .text("🎯 10 Questions (Standard)", "start_quiz_10")
      .row()
      .text("🔥 20 Questions (Exam Mode)", "start_quiz_20");

    let response = `🎯 *Topic Selected:* *${topic}*\n`;
    response += `📚 *Course:* *${getUserSubjectDisplay(chatId)}*\n\n`;
    response += `WalLearn will generate CBT questions specifically focused on *${topic}* calibrated to your department's exam pattern!\n\n`;
    response += `Select how many questions you want to drill:`;

    await ctx.reply(formatTelegramMarkdown(response), {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  // Intent H: Set Course
  if (result.intent === "set_course") {
    clearAwaitingStates(chatId);
    const courseRaw = result.courseDisplay || result.courseCode || rawText;
    const profile = setUserSubject(chatId, courseRaw);

    if (result.topic) {
      userActiveTopic.set(chatId, result.topic);
    }
    if (result.questionCount) {
      const { startQuizWithCount } = await import("./study.js");
      return startQuizWithCount(ctx, result.questionCount);
    }

    awaitingStudyTopic.set(chatId, profile.subjectCode);
    const keyboard = new InlineKeyboard()
      .text("📎 Attach Slides/Images Guide", "upload_guide");

    let response = `✅ *Active Course Set:* *${profile.subjectDisplay}*\n`;
    response += `⛓️ *Walrus Protocol Namespace:* \`${profile.subjectCode}\`\n\n`;
    response += `📂 *How would you like to prepare for ${profile.subjectCode.toUpperCase()}?*\n\n`;
    response += `1️⃣ 📄 *Upload Lecture Slides or Images:*\n`;
    response += `Attach your slide file (PDF, PPTX, Word) or images now to quiz directly from your lecture material.\n\n`;
    response += `2️⃣ 💬 *Or Reply with the Topic:*\n`;
    response += `Reply with any topic in ${profile.subjectCode.toUpperCase()} (e.g. \`Introduction & Core Concepts\`) and I will generate questions specifically on that topic!`;

    await ctx.reply(formatTelegramMarkdown(response), {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  // Intent I: Freeform AI Tutor Chat (with cold recall of Walrus memories)
  const subjectCode = getUserSubject(chatId) || "general";
  const subjectDisplay = hasUserSubject(chatId) ? getUserSubjectDisplay(chatId) : "General Studies";

  await ctx.replyWithChatAction("typing");

  try {
    const memories = await walrus.recall(`${rawText} in ${subjectCode}`, subjectCode, chatId);
    const prompt = buildTutorPrompt(
      `Course: ${subjectDisplay}\nStudent Question: ${rawText}`,
      memories
    );

    const response = await askAi([
      {
        role: "system",
        content: `You are WalLearn, an honest, encouraging, and razor-sharp academic study tutor for the course ${subjectDisplay}. You hold the student accountable to their past mistake history stored on Walrus Protocol.`,
      },
      { role: "user", content: prompt },
    ]);

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

    const formattedResponse = formatTelegramMarkdown(response);

    await ctx.reply(formattedResponse, {
      parse_mode: "Markdown",
      reply_markup: replyKeyboard,
    }).catch(async () => {
      await ctx.reply(response.replace(/[*_`#]/g, ""), { reply_markup: replyKeyboard });
    });
  } catch (error) {
    console.error("Error in handleChatMessage:", error);
    await ctx.reply("⚠️ Sorry, I encountered an error processing your question. Please try again.");
  }
}
