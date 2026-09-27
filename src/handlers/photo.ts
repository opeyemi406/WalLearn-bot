import { Context, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { extractTextFromImage } from "../ai/slide-parser.js";
import {
  getUserSubject,
  getUserSubjectDisplay,
  hasUserSubject,
  setUserSubject,
  pendingSlides,
  awaitingPastQuestions,
} from "../state.js";

interface MediaGroupSession {
  chatId: number;
  courseCode?: string;
  isPastQuestions: boolean;
  caption?: string;
  buffers: Buffer[];
  statusMsgId?: number;
  timer: NodeJS.Timeout;
}

const mediaGroups = new Map<string, MediaGroupSession>();

export async function handlePhoto(ctx: Context) {
  const chatId = ctx.chat?.id;
  const photos = ctx.message?.photo;
  if (!chatId || !photos || photos.length === 0) return;

  const mediaGroupId = ctx.message?.media_group_id;

  // Handle Telegram Media Groups (albums of multiple images)
  if (mediaGroupId) {
    let session = mediaGroups.get(mediaGroupId);
    if (!session) {
      const isPastQuestions = awaitingPastQuestions.has(chatId);
      const courseCode = isPastQuestions
        ? awaitingPastQuestions.get(chatId)
        : (hasUserSubject(chatId) ? getUserSubject(chatId) : undefined);

      let statusMsg;
      try {
        statusMsg = await ctx.reply("🖼️ _Ingesting multi-page images with Gemini Vision..._", {
          parse_mode: "Markdown",
        });
      } catch {
        statusMsg = await ctx.reply("🖼️ Ingesting multi-page images...");
      }

      session = {
        chatId,
        courseCode,
        isPastQuestions,
        caption: ctx.message?.caption?.trim(),
        buffers: [],
        statusMsgId: statusMsg?.message_id,
        timer: setTimeout(() => processMediaGroup(ctx, mediaGroupId), 1500),
      };
      mediaGroups.set(mediaGroupId, session);
    } else {
      clearTimeout(session.timer);
      if (ctx.message?.caption?.trim() && !session.caption) {
        session.caption = ctx.message.caption.trim();
      }
      session.timer = setTimeout(() => processMediaGroup(ctx, mediaGroupId), 1500);
    }

    try {
      const file = await ctx.getFile();
      if (file.file_path) {
        const token = ctx.api.token || config.telegramBotToken;
        const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          session.buffers.push(Buffer.from(ab));
        }
      }
    } catch (e) {
      console.error("Failed to download image from media group:", e);
    }
    return;
  }

  // Single Photo Processing
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

    const cleanSnippet = slideText
      .replace(/^(?:Here(?:'s| is) [^\n]*\n*)/i, "")
      .replace(/[*_`#]/g, "")
      .slice(0, 180)
      .replace(/\s+/g, " ")
      .trim();

    let promptMsg = `🖼️ *Transcribed Lecture Material Image!*\n`;
    promptMsg += `📚 *Course:* *${getUserSubjectDisplay(chatId)}*\n`;
    promptMsg += `📝 *Extracted Content:* _"${cleanSnippet}..."_\n\n`;
    promptMsg += `Select how many CBT questions you want to generate:`;

    const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

    await ctx.reply(formatTelegramMarkdown(promptMsg), {
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

async function processMediaGroup(ctx: Context, mediaGroupId: string) {
  const session = mediaGroups.get(mediaGroupId);
  if (!session) return;
  mediaGroups.delete(mediaGroupId);

  const { chatId, isPastQuestions, courseCode, caption, buffers, statusMsgId } = session;
  if (buffers.length === 0) return;

  if (statusMsgId) {
    try {
      await ctx.api.editMessageText(
        chatId,
        statusMsgId,
        `📖 _Transcribing ${buffers.length} pages with Gemini Vision..._`,
        { parse_mode: "Markdown" }
      );
    } catch {}
  }

  // Extract text from all buffered images
  const textResults = await Promise.all(
    buffers.map((buf) => extractTextFromImage(buf, "image/jpeg"))
  );

  const combinedText = textResults
    .filter((t) => t && t.trim().length > 0)
    .map((t, idx) => `--- [Page / Image ${idx + 1}] ---\n${t}`)
    .join("\n\n")
    .trim();

  if (!combinedText || combinedText.length < 25) {
    if (statusMsgId) {
      await ctx.api.editMessageText(
        chatId,
        statusMsgId,
        "⚠️ Could not extract readable text from these images. Please ensure clear lighting and legible text."
      ).catch(() => {});
    }
    return;
  }

  // 1. Past questions analysis mode
  if (isPastQuestions) {
    const finalCourse = courseCode || awaitingPastQuestions.get(chatId) || "General";
    awaitingPastQuestions.delete(chatId);
    const { processPastQuestionsAnalysis } = await import("./analyze.js");
    if (statusMsgId) {
      await ctx.api.deleteMessage(chatId, statusMsgId).catch(() => {});
    }
    return processPastQuestionsAnalysis(ctx, combinedText, finalCourse);
  }

  // 2. Regular lecture materials mode
  if (caption) {
    setUserSubject(chatId, caption);
  } else if (!hasUserSubject(chatId)) {
    const slideMatch =
      combinedText.slice(0, 1500).match(/([a-zA-Z]{2,5}\s*\d{2,4})[\s:\-–—]+([^\n\r]+)/i) ||
      combinedText.slice(0, 1500).match(/([a-zA-Z]{2,5}\s*\d{2,4})/i);
    if (slideMatch) {
      const detectedTitle = slideMatch[2]
        ? `${slideMatch[1]} - ${slideMatch[2].trim().slice(0, 50)}`
        : slideMatch[1];
      setUserSubject(chatId, detectedTitle);
    }
  }

  pendingSlides.set(chatId, {
    text: combinedText,
    fileName: `${buffers.length}_Lecture_Images.jpg`,
    courseCode: getUserSubject(chatId),
  });

  if (statusMsgId) {
    await ctx.api.deleteMessage(chatId, statusMsgId).catch(() => {});
  }

  const keyboard = new InlineKeyboard()
    .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
    .text("🎯 10 Questions (Standard)", "start_quiz_10")
    .row()
    .text("🔥 20 Questions (Exam Mode)", "start_quiz_20");

  const cleanSnippet = combinedText
    .replace(/^(?:Here(?:'s| is) [^\n]*\n*)/i, "")
    .replace(/[*_`#]/g, "")
    .slice(0, 180)
    .replace(/\s+/g, " ")
    .trim();

  let promptMsg = `🖼️ *Transcribed ${buffers.length} Lecture Material Images!*\n`;
  promptMsg += `📚 *Course:* *${getUserSubjectDisplay(chatId)}*\n`;
  promptMsg += `📝 *Extracted Content:* _"${cleanSnippet}..."_\n\n`;
  promptMsg += `Select how many CBT questions you want to generate:`;

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  await ctx.reply(formatTelegramMarkdown(promptMsg), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}
