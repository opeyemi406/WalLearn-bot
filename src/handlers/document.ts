import { Context, InlineKeyboard } from "grammy";
import { parsePdfBuffer } from "../ai/slide-parser.js";
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
  if (!chatId || !doc) return;

  const fileName = doc.file_name || "slides.pdf";
  const isPdf = fileName.toLowerCase().endsWith(".pdf") || doc.mime_type === "application/pdf";

  if (!isPdf) {
    await ctx.reply("📄 Please upload a PDF document (e.g. lecture slides, class notes, or past questions).");
    return;
  }

  const statusMsg = await ctx.reply(`📥 _Ingesting lecture slide: "${fileName}"..._`, { parse_mode: "Markdown" });

  try {
    // 1. Download file from Telegram
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    const res = await fetch(fileUrl);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await ctx.api.editMessageText(chatId, statusMsg.message_id, `📖 _Parsing text from "${fileName}"..._`, {
      parse_mode: "Markdown",
    });

    // 2. Parse PDF text
    const slideText = await parsePdfBuffer(buffer);
    if (!slideText || slideText.length < 50) {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        "⚠️ Could not extract sufficient text from this PDF. Please ensure it contains readable text rather than only scanned images."
      );
      return;
    }

    // 3. Ensure course is active or auto-detected
    const hasSubject = hasUserSubject(chatId);
    let subjectDisplay = getUserSubjectDisplay(chatId);

    if (!hasSubject) {
      const match = fileName.match(/([a-zA-Z]{2,5}\s*\d{2,4})/i);
      if (match) {
        const autoProfile = setUserSubject(chatId, `${match[1]} - ${fileName.replace(/\.pdf$/i, "")}`);
        subjectDisplay = autoProfile.subjectDisplay;
      } else {
        const cleanName = fileName.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
        const autoProfile = setUserSubject(chatId, cleanName);
        subjectDisplay = autoProfile.subjectDisplay;
      }
    }

    // Store slide in pending state
    pendingSlides.set(chatId, {
      text: slideText,
      fileName,
    });

    await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    // 4. Prompt user to choose question count
    const keyboard = new InlineKeyboard()
      .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
      .text("🎯 10 Questions (Standard)", "start_quiz_10")
      .row()
      .text("🔥 15 Questions (Deep Drill)", "start_quiz_15");

    let promptMsg = `📄 *Lecture Slide Ready:* _"${fileName}"_\n`;
    promptMsg += `📚 *Active Course:* *${subjectDisplay}*\n\n`;
    promptMsg += `🎯 *How many questions would you like to generate from your slides?*\n`;
    promptMsg += `_Questions will be grounded in your slide concepts + your on-chain Walrus mistake history!_`;

    await ctx.reply(promptMsg, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error in handleDocument:", error);
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      "⚠️ An error occurred while parsing the document. Please try again."
    );
  }
}
