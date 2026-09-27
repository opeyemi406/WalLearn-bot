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
import { cleanAndParseQuizJson } from "../ai/json-cleaner.js";
import { config } from "../config.js";

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

• Attach lecture slides or images anytime to quiz directly from your material!`;

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
  const currentSubjectCode = getUserSubject(chatId);
  const rawPending = pendingSlides.get(chatId);
  const pending = rawPending && rawPending.courseCode?.toLowerCase() === currentSubjectCode.toLowerCase() ? rawPending : null;

  const keyboard = new InlineKeyboard()
    .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
    .text("🎯 10 Questions (Standard)", "start_quiz_10")
    .row()
    .text("🔥 20 Questions (Exam Mode)", "start_quiz_20");

  let msg = `📚 *Course:* *${subjectDisplay}*\n`;
  if (pending) {
    const cleanFileName = pending.fileName.replace(/[`]/g, "");
    msg += `📎 *Attached Slide:* \`${cleanFileName}\`\n`;
  }
  msg += `\n🎯 *How many questions would you like to drill?*\n`;
  msg += `Select an option below or type e.g. \`/study 10\`:\n\n`;
  if (!pending) {
    msg += `_💡 Optional: You can attach lecture slides or images anytime to quiz from specific topics!_`;
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
  const rawPending = pendingSlides.get(chatId);
  const pending = rawPending && rawPending.courseCode?.toLowerCase() === subjectCode.toLowerCase() ? rawPending : null;

  let materialDesc = pending
    ? `lecture slides "${pending.fileName}"`
    : `curriculum benchmarks for ${subjectDisplay}`;

  const statusMsg = await ctx.reply(
    `🧠 _Recalling your past mistakes from Walrus for ${subjectDisplay}..._`,
    { parse_mode: "Markdown" }
  );

  try {
    // 1. Cold recall weakness briefing from Walrus (user-isolated)
    const briefing = await walrus.getWeaknessBriefing(subjectCode, chatId);

    const { getExamStyle, userActiveTopic } = await import("../state.js");
    const activeTopic = userActiveTopic.get(chatId);

    let briefingNotice = `🎯 *Starting ${count}-Question Drill: ${subjectDisplay}*\n`;
    if (pending) {
      const cleanFileName = pending.fileName.replace(/[`]/g, "");
      briefingNotice += `📎 *Source:* \`${cleanFileName}\`\n`;
    } else if (activeTopic) {
      briefingNotice += `📌 *Topic Focus:* *${activeTopic}*\n`;
    }
    if (briefing.weaknesses.length > 0) {
      briefingNotice += `_Recalled ${briefing.weaknesses.length} active weak topics from Walrus Mainnet. Applying 60/30/10 drill ratio..._\n`;
    } else {
      briefingNotice += `_No prior mistakes found on Walrus. Generating foundational high-yield CBT questions..._\n`;
    }

    const modelDisplayName = config.aiModel.includes("gemini-2.5-flash")
      ? "Gemini 2.5 Flash"
      : config.aiModel.split("/").pop() || "Gemini 2.5 Flash";

    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      briefingNotice + `\n⏳ _Generating ${count} questions via ${modelDisplayName}..._`,
      { parse_mode: "Markdown" }
    );

    // 2. Build prompt with slide text, active topic, or course description
    let materialSource: string;
    if (pending) {
      materialSource = pending.text;
    } else if (activeTopic) {
      materialSource = `Specific Academic Topic: "${activeTopic}" for course ${subjectDisplay} (Code: ${subjectCode.toUpperCase()}). Generate questions specifically testing concepts, structures, mechanisms, and definitions in this topic.`;
    } else {
      materialSource = `Core curriculum and past question benchmarks for university level ${subjectDisplay} (Code: ${subjectCode.toUpperCase()}).`;
    }

    const examBlueprint = getExamStyle(subjectCode, chatId);
    if (examBlueprint) {
      briefingNotice += `🏛 *Department Exam Pattern Active:* Questions calibrated to your lecturer's style!\n`;
    }

    const isSlideUpload = !!pending;
    const prompt = buildQuizGeneratorPrompt(materialSource, briefing, count, isSlideUpload, examBlueprint);

    let rawResponse = await askAi(
      [
        {
          role: "system",
          content: "You are an expert exam question generator that outputs strict, valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      0.4,
      true
    );

    let parsed: { questions: Question[] };
    try {
      parsed = cleanAndParseQuizJson(rawResponse);
    } catch (parseErr) {
      console.warn("Notice: First quiz parse attempt failed, triggering AI repair pass:", (parseErr as Error).message);
      const retryRaw = await askAi(
        [
          { role: "system", content: "You output valid JSON with a 'questions' array only. Use plain ASCII text without backslashes." },
          { role: "user", content: prompt },
        ],
        0.2,
        true
      );
      parsed = cleanAndParseQuizJson(retryRaw);
    }

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

    // Keep slide cached in session so student can drill additional rounds without re-uploading
    // pendingSlides will be updated if a new slide is uploaded or cleared on /start

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
