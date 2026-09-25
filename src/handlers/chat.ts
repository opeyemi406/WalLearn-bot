import { Context, InlineKeyboard } from "grammy";
import { walrus } from "../walrus/client.js";
import {
  getUserSubject,
  getUserSubjectDisplay,
  hasUserSubject,
  setUserSubject,
  awaitingSubject,
} from "../state.js";
import { askAi } from "../ai/client.js";
import { buildTutorPrompt } from "../ai/prompts.js";

export async function handleChatMessage(ctx: Context) {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text?.trim();
  if (!chatId || !text) return;

  // Skip commands
  if (text.startsWith("/")) return;

  // 1. Check if we are waiting for the user to set their course or if they typed a course format
  const isAwaiting = awaitingSubject.has(chatId) || !hasUserSubject(chatId);
  const looksLikeCourse = /^[a-zA-Z]{2,5}\s*\d{2,4}/i.test(text);

  if (isAwaiting || looksLikeCourse) {
    const profile = setUserSubject(chatId, text);

    const keyboard = new InlineKeyboard()
      .text("🎯 Start Drill Now", "start_drill")
      .row()
      .text("📊 View Briefing", "view_briefing")
      .text("📎 Attach Slides Guide", "upload_guide");

    let response = `✅ *Active Course Set:* *${profile.subjectDisplay}*\n`;
    response += `⛓️ *Walrus Protocol Namespace:* \`${profile.subjectCode}\`\n\n`;
    response += `*What would you like to do next?*\n`;
    response += `1️⃣ *Start a Drill:* Tap below or type \`/study\` to begin a 5-question cold drill.\n`;
    response += `2️⃣ *Attach Slides:* Drop any lecture slide or notes PDF directly into this chat to generate questions tailored specifically to your syllabus!\n`;
    response += `3️⃣ *Ask a Question:* Type any academic question or concept here for personalized tutoring holding you accountable to your mistake history.\n\n`;
    response += `_Ready when you are!_`;

    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  // 2. Freeform AI tutor chat with cold recall of past mistakes
  const subjectCode = getUserSubject(chatId);
  const subjectDisplay = getUserSubjectDisplay(chatId);

  await ctx.replyWithChatAction("typing");

  try {
    // Cold recall memories related to the user's message & subject
    const memories = await walrus.recall(`${text} in ${subjectCode}`, subjectCode);

    // Build tutor prompt with past mistakes context
    const prompt = buildTutorPrompt(
      `Course: ${subjectDisplay}\nStudent Question: ${text}`,
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

    await ctx.reply(response, { parse_mode: "Markdown" }).catch(async () => {
      // Fallback if markdown parsing fails
      await ctx.reply(response);
    });
  } catch (error) {
    console.error("Error in handleChatMessage:", error);
    await ctx.reply("⚠️ Sorry, I encountered an error processing your question. Please try again.");
  }
}
