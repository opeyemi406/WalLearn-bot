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
    const trimmed = rawText.trim();
    if (/^(2|option\s*2|all|all\s+courses?|everything|🌐)$/i.test(trimmed)) {
      awaitingRestoreCourse.delete(chatId);
      const { executeRestoreAll } = await import("./restore.js");
      return executeRestoreAll(ctx);
    }
    if (/^(1|option\s*1|specific|course)$/i.test(trimmed)) {
      await ctx.reply(
        `📚 *Restore Specific Course*\n\nPlease reply directly with your course code (e.g. \`ANA201\`, \`PCL301\`, \`CHM211\`):`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    awaitingRestoreCourse.delete(chatId);
    const { executeRestoreCourse } = await import("./restore.js");
    return executeRestoreCourse(ctx, trimmed);
  }

  // 2.5 Check if user is replying to quiz count prompt (e.g. 5, 10, 20)
  const { awaitingQuizCount } = await import("../state.js");
  if (awaitingQuizCount.has(chatId)) {
    const trimmed = rawText.trim().toLowerCase();
    let count: number | null = null;
    if (/^(1|sprint|5|⚡)/i.test(trimmed)) count = 5;
    else if (/^(2|standard|10|🎯)/i.test(trimmed)) count = 10;
    else if (/^(3|exam|20|🔥)/i.test(trimmed)) count = 20;
    else {
      const numMatch = trimmed.match(/\b(\d{1,2})\b/);
      if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (val >= 3 && val <= 30) count = val;
      }
    }

    if (count !== null) {
      awaitingQuizCount.delete(chatId);
      const { startQuizWithCount } = await import("./study.js");
      return startQuizWithCount(ctx, count);
    }
  }

  // 3. Check if user is responding with a course code for /analyze
  const { awaitingAnalyzeCourse, awaitingPastQuestions } = await import("../state.js");
  if (awaitingAnalyzeCourse.has(chatId)) {
    const looksLikeQuestions = /(?:\b[1-9]\d?[\.\)]|\b[A-D][\.\)]|\boption\b)/i.test(rawText) && rawText.length > 50;
    if (looksLikeQuestions) {
      awaitingAnalyzeCourse.delete(chatId);
      const codeMatch = rawText.slice(0, 1000).match(/([a-zA-Z]{2,5}\s*\d{2,4})/i);
      const courseCode = codeMatch
        ? codeMatch[1].toUpperCase().replace(/\s+/g, "")
        : (hasUserSubject(chatId) ? getUserSubject(chatId) : "General");
      setUserSubject(chatId, courseCode);
      const { processPastQuestionsAnalysis } = await import("./analyze.js");
      return processPastQuestionsAnalysis(ctx, rawText, courseCode);
    }

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

  // 4.5 Check if user is replying to the /start welcome menu
  const { awaitingStartChoice } = await import("../state.js");
  if (awaitingStartChoice.has(chatId)) {
    const trimmed = rawText.trim().toLowerCase();

    // 1 / A / Analyze
    if (/^(?:option\s*)?(1|a)$/i.test(trimmed) || /^(analyze|past\s*questions?|mcq|past)$/i.test(trimmed)) {
      awaitingStartChoice.delete(chatId);
      const { handleAnalyze } = await import("./analyze.js");
      return handleAnalyze(ctx);
    }

    // 2 / B / Study / Slides
    if (/^(?:option\s*)?(2|b)$/i.test(trimmed) || /^(study|slides?|direct|prep)$/i.test(trimmed)) {
      awaitingStartChoice.delete(chatId);
      awaitingSubject.add(chatId);
      await ctx.reply(
        `📚 *Ready to Study Directly!*\n\n` +
        `Please reply with your *Course Code & Title* (e.g. \`PCL301 - Evaluation of Drug Toxicity\` or \`BIO101\`):\n\n` +
        `_You can also attach your lecture slides (PDF, PPTX, Word) or images directly!_`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // 3 / C / Restore
    if (/^(?:option\s*)?(3|c)$/i.test(trimmed) || /^(restore|mistakes|returning|recover)$/i.test(trimmed)) {
      awaitingStartChoice.delete(chatId);
      const { handleRestore } = await import("./restore.js");
      return handleRestore(ctx);
    }

    // 4 / D / Briefing
    if (/^(?:option\s*)?(4|d)$/i.test(trimmed) || /^(briefing|weakness|report)$/i.test(trimmed)) {
      awaitingStartChoice.delete(chatId);
      const { handleBriefing } = await import("./briefing.js");
      return handleBriefing(ctx);
    }

    // If user directly typed a course code (e.g. ANA201 or PCL301), clear awaitingStartChoice and proceed to set course
    if (isValidCourseInput(rawText)) {
      awaitingStartChoice.delete(chatId);
    }
  }

  // 4.55 Check if user is replying to the /menu active session menu
  const { awaitingMenuChoice } = await import("../state.js");
  if (awaitingMenuChoice.has(chatId)) {
    const trimmed = rawText.trim().toLowerCase();
    if (/^(1|drill|study|start|quiz)$/i.test(trimmed)) {
      awaitingMenuChoice.delete(chatId);
      const { handleStudy } = await import("./study.js");
      return handleStudy(ctx);
    }
    if (/^(2|briefing|report|weakness)$/i.test(trimmed)) {
      awaitingMenuChoice.delete(chatId);
      const { handleBriefing } = await import("./briefing.js");
      return handleBriefing(ctx);
    }
    if (/^(3|change|switch|new\s*course|course)$/i.test(trimmed)) {
      awaitingMenuChoice.delete(chatId);
      const { handleSubject } = await import("./start.js");
      return handleSubject(ctx);
    }
    if (/^(4|slides|attach|guide|upload)$/i.test(trimmed)) {
      awaitingMenuChoice.delete(chatId);
      const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");
      await ctx.reply(
        formatTelegramMarkdown(
          `📎 *How to Quiz from Your Slides or Images:*\n\n1️⃣ Tap the 📎 attachment icon in Telegram.\n2️⃣ Select your lecture slides (PDF, Word, PPTX) or *images* (JPEG, PNG).\n3️⃣ Send it to this chat!\n\nWalLearn will use Gemini Vision to transcribe the concepts and blend them with your Walrus mistake history to build a personalized exam drill.`
        ),
        { parse_mode: "Markdown" }
      );
      return;
    }
    awaitingMenuChoice.delete(chatId);
  }

  // 4.6 Check if user is replying with a topic after past questions or course setup
  const { awaitingStudyTopic, userActiveTopic, getUserSubjectDisplay, isValidTopicInput } = await import("../state.js");
  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  if (awaitingStudyTopic.has(chatId) && !rawText.startsWith("/")) {
    const courseCode = awaitingStudyTopic.get(chatId)!;

    // Check if user wants to study the whole course without specifying a topic
    if (/^(quiz|study|start|drill|test|all|practice)$/i.test(rawText.trim())) {
      awaitingStudyTopic.delete(chatId);
      const { handleStudy } = await import("./study.js");
      return handleStudy(ctx);
    }

    // Check if user selected option 1 ("1", "option 1", "slides", "slide")
    if (/^(?:option\s*)?1$/i.test(rawText) || /^(slides?|images?|upload)$/i.test(rawText)) {
      await ctx.reply(
        `📄 *Upload Your Lecture Slides or Images*\n\n` +
        `Tap the 📎 attachment icon or 📷 gallery and send your lecture slides (PDF, Word, PPTX) or images to generate questions from your material!`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Check if user selected option 2 ("2", "option 2", "topic")
    if (/^(?:option\s*)?2$/i.test(rawText) || /^topic$/i.test(rawText)) {
      await ctx.reply(
        `💬 *What topic in ${courseCode} would you like to drill?*\n\n` +
        `Reply with the topic name (e.g. \`Thorax & Mediastinum\`, \`Cardiovascular System\`, \`Histology of Tissues\`):`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // If input is an invalid single digit or option command, re-prompt nicely
    if (!isValidTopicInput(rawText)) {
      await ctx.reply(
        `💬 *Please reply with your topic name for ${courseCode}* (e.g. \`Thorax & Mediastinum\` or \`Cardiovascular System\`), or upload your lecture slides/images directly.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    awaitingStudyTopic.delete(chatId);
    userActiveTopic.set(chatId, rawText);

    // Pre-arm awaitingQuizCount so typing 5, 10, 20 starts immediately
    const { awaitingQuizCount } = await import("../state.js");
    awaitingQuizCount.add(chatId);

    const keyboard = new InlineKeyboard()
      .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
      .text("🎯 10 Questions (Standard)", "start_quiz_10")
      .row()
      .text("🔥 20 Questions (Exam Mode)", "start_quiz_20");

    let response = `🎯 *Topic Selected:* *${rawText}*\n`;
    response += `📚 *Course:* *${getUserSubjectDisplay(chatId)}*\n\n`;
    response += `WalLearn will generate CBT questions specifically focused on *${rawText}* calibrated to your department's exam pattern!\n\n`;
    response += `Select how many questions you want to drill:`;

    await ctx.reply(formatTelegramMarkdown(response), {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  // 4.7 Check if user typed an explicit topic request e.g. "quiz me on X", "questions on X", "topic: X"
  const topicMatch = rawText.match(/^(?:quiz\s+me\s+on|generate\s+questions?\s+on|test\s+me\s+on|questions?\s+on|topic[:\s]+)(.+)/i);
  if (topicMatch && hasUserSubject(chatId)) {
    const topic = topicMatch[1].trim();
    if (isValidTopicInput(topic)) {
      userActiveTopic.set(chatId, topic);

      // Pre-arm awaitingQuizCount
      const { awaitingQuizCount } = await import("../state.js");
      awaitingQuizCount.add(chatId);

      const keyboard = new InlineKeyboard()
        .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
        .text("🎯 10 Questions (Standard)", "start_quiz_10")
        .row()
        .text("🔥 20 Questions (Exam Mode)", "start_quiz_20");

      let response = `🎯 *Topic Selected:* *${topic}*\n`;
      response += `📚 *Course:* *${getUserSubjectDisplay(chatId)}*\n\n`;
      response += `WalLearn will generate CBT questions specifically focused on *${topic}*!\n\n`;
      response += `Select how many questions you want to drill:`;

      await ctx.reply(formatTelegramMarkdown(response), {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      return;
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

    const formattedResponse = formatTelegramMarkdown(response);

    await ctx.reply(formattedResponse, {
      parse_mode: "Markdown",
      reply_markup: replyKeyboard,
    }).catch(async () => {
      // Fallback if markdown parsing fails
      await ctx.reply(response.replace(/[*_`#]/g, ""), { reply_markup: replyKeyboard });
    });
  } catch (error) {
    console.error("Error in handleChatMessage:", error);
    await ctx.reply("⚠️ Sorry, I encountered an error processing your question. Please try again.");
  }
}
