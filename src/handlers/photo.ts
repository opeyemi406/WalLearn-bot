import { Context, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { extractTextFromImage } from "../ai/slide-parser.js";
import {
  getUserSubject,
  getUserSubjectDisplay,
  hasUserSubject,
  setUserSubject,
  pendingSlides,
} from "../state.js";

export async function handlePhoto(ctx: Context) {
  const chatId = ctx.chat?.id;
  const photos = ctx.message?.photo;
  if (!chatId || !photos || photos.length === 0) return;

  let statusMsg;
  try {
    statusMsg = await ctx.reply("🖼️ _Analyzing lecture material image with Gemini Vision..._", {
      parse_mode: "Markdown",
    });
  } catch {
    statusMsg = await ctx.reply("🖼️ Analyzing lecture material image...");
  }

  try {
    const file = await ctx.getFile();
    if (!file.file_path) {
      throw new Error("Could not retrieve download path for image from Telegram.");
    }

    const token = ctx.api.token || config.telegramBotToken;
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error("Failed to download image file from Telegram.");

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, "📖 _Transcribing concepts and definitions from image..._", {
        parse_mode: "Markdown",
      });
    } catch {}

    const slideText = await extractTextFromImage(buffer, "image/jpeg");

    if (!slideText || slideText.length < 25) {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        "⚠️ Could not extract readable lecture text from this image. Please ensure clear text."
      );
      return;
    }

    // 1. Check if user is in past questions analysis mode
    const { awaitingPastQuestions, getUserSubject } = await import("../state.js");
    if (awaitingPastQuestions.has(chatId)) {
      const courseCode = awaitingPastQuestions.get(chatId)!;
      awaitingPastQuestions.delete(chatId);
      const { processPastQuestionsAnalysis } = await import("./analyze.js");
      await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
      return processPastQuestionsAnalysis(ctx, slideText, courseCode);
    }

    // 2. Intelligent Course & Topic Detection from image or caption
    const caption = ctx.message?.caption?.trim();
    if (caption) {
      setUserSubject(chatId, caption);
    } else if (!hasUserSubject(chatId)) {
      const slideMatch =
        slideText.slice(0, 1200).match(/([a-zA-Z]{2,5}\s*\d{2,4})[\s:\-–—]+([^\n\r]+)/i) ||
        slideText.slice(0, 1200).match(/([a-zA-Z]{2,5}\s*\d{2,4})/i);
      if (slideMatch) {
        const detectedTitle = slideMatch[2]
          ? `${slideMatch[1]} - ${slideMatch[2].trim().slice(0, 50)}`
          : slideMatch[1];
        setUserSubject(chatId, detectedTitle);
      }
    }

    // 3. Store in pendingSlides state
    pendingSlides.set(chatId, {
      text: slideText,
      fileName: "Lecture_Material_Image.jpg",
      courseCode: getUserSubject(chatId),
    });

    await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    // 4. Offer question counts
    const keyboard = new InlineKeyboard()
      .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
      .text("🎯 10 Questions (Standard)", "start_quiz_10")
      .row()
      .text("🔥 20 Questions (Exam Mode)", "start_quiz_20");

    let promptMsg = `🖼️ *Transcribed Lecture Material Image!*\n`;
    promptMsg += `📚 *Course:* *${getUserSubjectDisplay(chatId)}*\n`;
    promptMsg += `📝 *Extracted Content:* _"${slideText.slice(0, 180).replace(/\n/g, " ")}..."_\n\n`;
    promptMsg += `Select how many CBT questions you want to generate:`;

    await ctx.reply(promptMsg, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error("Photo processing error:", err);
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      `⚠️ Error reading image: ${(err as Error).message}`
    );
  }
}
