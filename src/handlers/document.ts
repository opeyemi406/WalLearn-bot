import { Context, InlineKeyboard } from "grammy";
import { parseDocumentBuffer } from "../ai/slide-parser.js";
import { config } from "../config.js";
import {
  getUserSubject,
  getUserSubjectDisplay,
  hasUserSubject,
  setUserSubject,
  pendingSlides,
} from "../state.js";

export async function handleDocument(ctx: Context) {
  const chatId = ctx.chat?.id;
  const doc = ctx.message?.document;
  if (!chatId || !doc) {
    console.warn("⚠️ handleDocument invoked without document or chatId");
    return;
  }

  const fileName = doc.file_name || "lecture_materials.pdf";
  const mimeType = doc.mime_type || "";
  const fileSize = doc.file_size || 0;
  console.log(`📥 Ingesting document: "${fileName}" (mime: ${mimeType}, size: ${fileSize} bytes) from chat ${chatId}`);

  // Check file size (Telegram Bot API limit is 20MB)
  if (fileSize > 20 * 1024 * 1024) {
    await ctx.reply(
      `⚠️ *File Too Large:* "${fileName}" is ${(fileSize / (1024 * 1024)).toFixed(1)}MB.\n\nTelegram Bot API limits downloads to 20MB. Please compress your PDF or upload specific chapters/slides.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "pdf";
  const cleanDocName = fileName.replace(/[`]/g, "");

  let statusMsg;
  try {
    statusMsg = await ctx.reply(`📥 _Ingesting document: \`${cleanDocName}\`..._`, { parse_mode: "Markdown" });
  } catch {
    statusMsg = await ctx.reply(`📥 Ingesting document: "${cleanDocName}"...`);
  }

  try {
    // 1. Download file from Telegram Bot API
    console.log(`⏳ Fetching file metadata from Telegram for ${cleanDocName}...`);
    const file = await ctx.getFile();
    if (!file.file_path) {
      throw new Error("Telegram did not return a valid download path for this file.");
    }

    const token = ctx.api.token || config.telegramBotToken;
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    console.log(`📥 Downloading file from Telegram (${file.file_path})...`);

    const res = await fetch(fileUrl);
    if (!res.ok) {
      throw new Error(`Failed to download file from Telegram (HTTP ${res.status})`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, `📖 _Extracting syllabus concepts from \`${cleanDocName}\`..._`, {
        parse_mode: "Markdown",
      });
    } catch {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, `📖 Extracting syllabus concepts from "${cleanDocName}"...`).catch(() => {});
    }

    // 2. Extract text from document buffer (supports PDF, PPTX, DOCX, TXT, MD)
    const parseResult = await parseDocumentBuffer(buffer, ext);
    const slideText = parseResult.text;

    console.log(`✅ Extracted ${slideText.length} characters (${parseResult.pages} pages/slides) from ${fileName}`);

    if (!slideText || slideText.length < 30) {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        "⚠️ Could not extract readable text from this document. Please ensure the document contains digital text rather than scanned photo images."
      );
      return;
    }

    // 2.5 Check if user is in past questions analysis mode
    const { awaitingPastQuestions, getUserSubject } = await import("../state.js");
    if (awaitingPastQuestions.has(chatId)) {
      const courseCode = awaitingPastQuestions.get(chatId)!;
      awaitingPastQuestions.delete(chatId);
      const { processPastQuestionsAnalysis } = await import("./analyze.js");
      await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
      return processPastQuestionsAnalysis(ctx, slideText, courseCode);
    }

    // 3. Intelligent Course & Topic Detection
    const caption = ctx.message?.caption?.trim();
    const hasExistingCourse = hasUserSubject(chatId);
    let subjectDisplay = getUserSubjectDisplay(chatId);

    const hasCodeInName = /([a-zA-Z]{2,5}\s*\d{2,4})/i.test(fileName);
    const isGenericName = /^(file|slide|slides|presentation|document|doc|lecture|notes|download|untitled|materials)[\s_\d]*$/i.test(
      fileName.replace(/\.[a-zA-Z0-9]+$/i, "").trim()
    );

    if (caption) {
      // Priority 1: User's typed caption
      const autoProfile = setUserSubject(chatId, caption);
      subjectDisplay = autoProfile.subjectDisplay;
    } else if (hasCodeInName) {
      // Priority 2: File name contains course code
      const autoProfile = setUserSubject(chatId, fileName.replace(/\.[a-zA-Z0-9]+$/i, "").replace(/[_-]/g, " "));
      subjectDisplay = autoProfile.subjectDisplay;
    } else if (!hasExistingCourse || isGenericName) {
      // Priority 3: Scan Title Slide (Page 1) text for course code
      const firstPageText = slideText.slice(0, 1200);
      const slideMatch =
        firstPageText.match(/([a-zA-Z]{2,5}\s*\d{2,4})[\s:\-–—]+([^\n\r]+)/i) ||
        firstPageText.match(/([a-zA-Z]{2,5}\s*\d{2,4})/i);

      if (slideMatch) {
        const detectedTitle = slideMatch[2]
          ? `${slideMatch[1]} - ${slideMatch[2].trim().slice(0, 50)}`
          : slideMatch[1];
        const autoProfile = setUserSubject(chatId, detectedTitle);
        subjectDisplay = autoProfile.subjectDisplay;
      } else if (!hasExistingCourse) {
        // Fallback: Clean file name
        const cleanName = fileName.replace(/\.[a-zA-Z0-9]+$/i, "").replace(/[_-]/g, " ");
        const autoProfile = setUserSubject(chatId, cleanName);
        subjectDisplay = autoProfile.subjectDisplay;
      }
    }

    // Store slide in pending state
    pendingSlides.set(chatId, {
      text: slideText,
      fileName,
      courseCode: getUserSubject(chatId),
    });

    await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    // 4. Prompt user to choose question count
    const keyboard = new InlineKeyboard()
      .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
      .text("🎯 10 Questions (Standard)", "start_quiz_10")
      .row()
      .text("🔥 20 Questions (Exam Mode)", "start_quiz_20");

    let promptMsg = `📄 *Lecture Material Ingested:* \`${cleanDocName}\`\n`;
    promptMsg += `📑 *Pages/Slides Processed:* ${parseResult.pages}\n`;
    promptMsg += `📚 *Active Course:* *${subjectDisplay}*\n\n`;
    promptMsg += `🎯 *How many questions would you like to generate?*\n`;
    promptMsg += `_Questions will be directly grounded in your slides and blended with your on-chain Walrus mistake history!_`;

    try {
      await ctx.reply(promptMsg, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch {
      await ctx.reply(promptMsg.replace(/[*_`]/g, ""), {
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error("Error in handleDocument:", error);
    const errorMsg = `⚠️ Could not process "${cleanDocName}": ${(error as Error).message}`;
    if (statusMsg) {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        errorMsg
      ).catch(async () => {
        await ctx.reply(errorMsg);
      });
    } else {
      await ctx.reply(errorMsg);
    }
  }
}
