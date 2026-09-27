import { Context } from "grammy";
import { askAi } from "../ai/client.js";
import { config } from "../config.js";
import { walrus } from "../walrus/client.js";
import { awaitingAnalyzeCourse, awaitingPastQuestions, getUserSubject, setExamStyle, setUserSubject } from "../state.js";

/**
 * Entrypoint for /analyze command or button
 */
export async function handleAnalyze(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const text = ctx.message?.text?.trim() || "";
  const parts = text.split(/\s+/);
  const explicitCourse = parts.length > 1 ? parts[1].trim() : null;

  if (explicitCourse) {
    promptForQuestions(ctx, explicitCourse);
    return;
  }

  // Check if user already has an active course profile
  const currentSubject = getUserSubject(chatId);
  if (currentSubject && currentSubject !== "general" && /^[a-z]{2,5}\d{2,4}$/i.test(currentSubject)) {
    promptForQuestions(ctx, currentSubject);
    return;
  }

  // Otherwise prompt for course code
  awaitingAnalyzeCourse.add(chatId);
  await ctx.reply(
    `📝 *Department Past MCQ Questions & Style Analyzer*\n\n` +
    `Which course code are these past questions for?\n` +
    `_Please reply with the course code (e.g. \`PCL301\`, \`CHM211\`, \`BIO101\`):_`,
    { parse_mode: "Markdown" }
  );
}

export async function promptForQuestions(ctx: Context, courseCode: string) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const cleanCode = courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  setUserSubject(chatId, cleanCode);
  awaitingAnalyzeCourse.delete(chatId);
  awaitingPastQuestions.set(chatId, cleanCode);

  await ctx.reply(
    `📝 *Ready for Past MCQ Questions: ${cleanCode}*\n\n` +
    `Please send your past MCQ questions or past exam papers for *${cleanCode}*:\n` +
    `• 💬 *Paste questions as a text message* directly here\n` +
    `• 📄 *Upload a document* (PDF, Word, TXT, PPTX)\n` +
    `• 🖼️ *Or upload images* (JPEG, PNG)\n\n` +
    `WalLearn will use *MemWal* to analyze:\n` +
    `1. Your lecturer's exact question-setting pattern & traps\n` +
    `2. High-yield syllabus facts to store on Walrus Protocol\n` +
    `3. Calibrate all future quizzes to match your department's exact format!`,
    { parse_mode: "Markdown" }
  );
}

/**
 * Process past questions text (either pasted or parsed from a document)
 */
export async function processPastQuestionsAnalysis(ctx: Context, text: string, courseCode: string) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const statusMsg = await ctx.reply(
    `⏳ *Analyzing department past questions for ${courseCode} with MemWal...*\n` +
    `_Extracting lecturer exam patterns, distractors, and syllabus facts..._`,
    { parse_mode: "Markdown" }
  );

  try {
    // 1. Run MemWal analysis to extract atomic syllabus facts
    const analyzeRes = await walrus.analyzeText(text, courseCode, chatId);

    // 2. Run Gemini to extract the Department Exam Blueprint
    const analysisPrompt = `
You are an expert university psychometrician and academic exam analyst.
Analyze the following departmental past multiple-choice exam questions for course "${courseCode}".

PAST EXAM QUESTIONS:
${text.slice(0, 24000)}

Extract a concise, highly actionable "Department Exam Blueprint" covering:
1. Question Style: (e.g. Clinical vignettes / case scenarios, rapid definitions, mechanism of action, or calculations).
2. Recurring Traps & Distractor Strategy: (e.g. Frequent use of "EXCEPT" / "LEAST likely", confusing similar drug suffixes, deceptive units).
3. High-Yield Tested Themes: List the top 3-5 recurring themes.
4. Key Extracted Facts: 5-8 bulleted atomic, high-yield facts directly tested in these past questions.

Respond in clean, well-formatted Markdown.
`;

    const blueprint = await askAi([
      {
        role: "system",
        content: "You are an expert university exam analyst and psychometrician.",
      },
      {
        role: "user",
        content: analysisPrompt,
      },
    ]);

    // 3. Save the exam blueprint for this course
    setExamStyle(courseCode, blueprint, chatId);

    // 4. Extract atomic facts and bulk-persist to Walrus Memory
    const factLines: string[] = [];
    const rawLines = blueprint.split("\n");
    for (const line of rawLines) {
      if (line.trim().startsWith("•") || line.trim().startsWith("-") || line.trim().match(/^\d+\./)) {
        const clean = line.replace(/^[\s•\-\d.]+\s*/, "").trim();
        if (clean.length > 15 && clean.length < 280) {
          factLines.push(`[EXAM_FACT] Course: ${courseCode} | ${clean}`);
        }
      }
    }

    // Persist extracted facts to Walrus using rememberBulk (atomic batch write)
    if (factLines.length > 0) {
      await walrus.rememberBulk(factLines.slice(0, 10), courseCode, chatId);
    }

    // Clear awaiting state
    awaitingPastQuestions.delete(chatId);

    // 5. Send rich confirmation and guide user to upload lecture slides
    let profileSnippet = blueprint.trim();
    if (profileSnippet.length > 900) {
      const lastNewline = profileSnippet.lastIndexOf("\n", 900);
      profileSnippet = (lastNewline > 400 ? profileSnippet.slice(0, lastNewline) : profileSnippet.slice(0, 900)) + "\n\n_...[Full Blueprint saved to Walrus Memory]_";
    }

    let reply = `🎯 *Department Exam Blueprint Analyzed & Stored!*\n\n`;
    reply += `🏛 *Course:* \`${courseCode}\`\n\n`;
    reply += `📋 *Lecturer Exam Profile:*\n${profileSnippet}\n\n`;
    reply += `🧠 *Walrus Memory Storage:*\n`;
    reply += `• *Atomic Facts Extracted:* ${factLines.length + (analyzeRes.facts?.length || 0)} facts\n`;
    reply += `• *Network:* Walrus Protocol Mainnet\n`;
    reply += `• *Status:* 🟢 Stored in isolated namespace \`${walrus.getUserNamespace(courseCode, chatId)}\`\n\n`;
    reply += `━━━━━━━━━━━━━━━━━━━\n`;
    reply += `🚀 *Next Step:* Now upload your *Lecture Slides* or images (or type a topic) to generate quiz questions matching this *exact department exam pattern*!`;

    try {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, reply, {
        parse_mode: "Markdown",
      });
    } catch (parseErr) {
      console.warn("Markdown parse failed for blueprint, falling back to clean text:", parseErr);
      const cleanReply = reply.replace(/[*_`]/g, "");
      await ctx.api.editMessageText(chatId, statusMsg.message_id, cleanReply);
    }
  } catch (err) {
    console.error("Past question analysis error:", err);
    try {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `⚠️ *Analysis encountered an issue:* ${(err as Error).message}\n\nYou can still upload your lecture slides or images to proceed with studying.`,
        { parse_mode: "Markdown" }
      );
    } catch {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `⚠️ Analysis encountered an issue: ${(err as Error).message}\n\nYou can still upload your lecture slides or images to proceed with studying.`
      );
    }
  }
}
