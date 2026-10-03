import { Context, InlineKeyboard } from "grammy";
import { sessions, QuizSession } from "../state.js";
import { walrus } from "../walrus/client.js";
import { config } from "../config.js";
import { sendQuestion } from "./quiz-helper.js";

export async function handleCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  const chatId = ctx.chat?.id;
  if (!data || !chatId) return;

  await ctx.answerCallbackQuery().catch(() => {});

  if (data === "analyze_past_q") {
    const { handleAnalyze } = await import("./analyze.js");
    return handleAnalyze(ctx);
  }

  if (data === "upload_slides_direct") {
    const { awaitingSubject, hasUserSubject, getUserSubjectDisplay, clearAwaitingStates } = await import("../state.js");
    if (!hasUserSubject(chatId)) {
      clearAwaitingStates(chatId);
      awaitingSubject.add(chatId);
      await ctx.reply(
        `Please reply with your *Course Code & Title* (e.g. \`PCL301 - Evaluation of Drug Toxicity\`)`,
        { parse_mode: "Markdown" }
      );
    } else {
      const { awaitingStudyTopic, getUserSubject } = await import("../state.js");
      awaitingStudyTopic.set(chatId, getUserSubject(chatId));

      await ctx.reply(
        `📂 *Lecture Materials for ${getUserSubjectDisplay(chatId)}*\n\n` +
        `1️⃣ 📄 *Upload Lecture Slides or Images:*\n` +
        `Upload your slide file (PDF, PPTX, Word) or images now to quiz directly from your material!\n\n` +
        `2️⃣ 💬 *Or Reply with a Topic:*\n` +
        `Reply with the specific topic in this course you want to drill!`,
        {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard()
            .text("📎 Attach Slides/Images Guide", "upload_guide"),
        }
      );
    }
    return;
  }

  if (data === "restore_prompt") {
    const { handleRestore } = await import("./restore.js");
    return handleRestore(ctx);
  }

  if (data === "restore_course_prompt") {
    const { clearAwaitingStates, awaitingRestoreCourse } = await import("../state.js");
    clearAwaitingStates(chatId);
    awaitingRestoreCourse.add(chatId);
    await ctx.reply(
      `📚 *Restore Specific Course*\n\nPlease reply with the course code you want to restore from Walrus (e.g. \`PCL301\`, \`CHM211\`, \`BIO101\`):`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data.startsWith("restore_course_quick_")) {
    const courseCode = data.replace("restore_course_quick_", "").trim();
    const { executeRestoreCourse } = await import("./restore.js");
    return executeRestoreCourse(ctx, courseCode);
  }

  if (data.startsWith("study_course_")) {
    const courseCode = data.replace("study_course_", "").trim();
    const { setUserSubject, awaitingQuizCount, clearAwaitingStates } = await import("../state.js");
    const profile = setUserSubject(chatId, courseCode);
    clearAwaitingStates(chatId);
    awaitingQuizCount.add(chatId);

    const keyboard = new InlineKeyboard()
      .text("⚡ 5 Questions (Sprint)", "start_quiz_5")
      .text("🎯 10 Questions (Standard)", "start_quiz_10")
      .row()
      .text("🔥 20 Questions (Exam Mode)", "start_quiz_20")
      .row()
      .text("🚀 30 Questions (Deep Drill)", "start_quiz_30")
      .text("🏆 40 Questions (Full Mock)", "start_quiz_40");

    let msg = `✅ *Switched Active Course:* *${profile.subjectDisplay}*\n`;
    msg += `⛓️ *Walrus Protocol Namespace:* \`${profile.subjectCode}\`\n\n`;
    msg += `📎 *Upload Lecture Slides or Notes:*\n`;
    msg += `If you have lecture slides (PDF, Word, PPTX) or photos of lecture notes, attach them now to quiz directly from your material!\n\n`;
    msg += `🎯 *Or Select How Many Questions to Drill:*\n`;
    msg += `Tap an option below to begin instant CBT practice:`;

    const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");
    await ctx.reply(formatTelegramMarkdown(msg), {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  if (data.startsWith("start_quiz_")) {
    const count = parseInt(data.replace("start_quiz_", ""), 10) || 5;
    const { startQuizWithCount } = await import("./study.js");
    return startQuizWithCount(ctx, count);
  }

  if (data === "start_drill") {
    const { handleStudy } = await import("./study.js");
    return handleStudy(ctx);
  }

  if (data === "view_briefing" || data === "briefing_prompt") {
    const { handleBriefing } = await import("./briefing.js");
    return handleBriefing(ctx);
  }

  if (data === "briefing_all") {
    const { executeBriefingAll } = await import("./briefing.js");
    return executeBriefingAll(ctx);
  }

  if (data === "briefing_course_prompt") {
    const { clearAwaitingStates, awaitingBriefingCourse } = await import("../state.js");
    clearAwaitingStates(chatId);
    awaitingBriefingCourse.add(chatId);
    await ctx.reply(
      `📚 *Weakness Briefing for Specific Course*\n\nPlease reply directly with the course code you want to review (e.g. \`ANA201\`, \`PCL301\`, \`BIO101\`):`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data.startsWith("briefing_course_")) {
    const courseCode = data.replace("briefing_course_", "");
    const { executeBriefingCourse } = await import("./briefing.js");
    return executeBriefingCourse(ctx, courseCode);
  }

  if (data === "change_subject") {
    const { awaitingSubject, clearAwaitingStates } = await import("../state.js");
    clearAwaitingStates(chatId);
    awaitingSubject.add(chatId);
    await ctx.reply(
      `📚 Please reply with your new *Course Code* and *Course Title by the side*, for example:\n👉 \`BCH201 - General Biochemistry\`\n👉 \`CSC302 - Operating Systems\`\n👉 \`PCL301 - Clinical Pharmacokinetics\`\n\n• Attach lecture slides or images anytime to generate a quiz specifically from your lecture notes!`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "upload_guide") {
    const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");
    await ctx.reply(
      formatTelegramMarkdown(
        `📎 *How to Quiz from Your Slides or Images:*\n\n1️⃣ Tap the 📎 attachment icon in Telegram.\n2️⃣ Select your lecture slides (PDF, Word, PPTX) or *images* (JPEG, PNG).\n3️⃣ Send it to this chat!\n\nWalLearn will use Gemini Vision to transcribe the concepts and blend them with your Walrus mistake history to build a personalized exam drill.`
      ),
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "main_menu") {
    const { handleStart } = await import("./start.js");
    return handleStart(ctx);
  }

  if (data.startsWith("next_q")) {
    const session = sessions.get(chatId);
    if (!session) {
      await ctx.reply("Session expired. Type /study to start a new quiz.");
      return;
    }
    session.currentIndex++;
    if (session.currentIndex < session.questions.length) {
      await sendQuestion(ctx, session);
    } else {
      // Quiz complete
      const total = session.questions.length;
      const score = session.score;
      const pct = Math.round((score / total) * 100);

      let summary = `🎉 *Quiz Complete!*\n`;
      summary += `Subject: *${session.subject.toUpperCase()}*\n`;
      summary += `• *Final Score:* ${score} / ${total} (${pct}%)\n`;
      summary += `• *Walrus Memory:* Any mistakes have been persisted to Walrus Protocol on-chain.\n\n`;
      summary += `Type /briefing to review your updated weaknesses, or /study to drill again!`;

      sessions.delete(chatId);
      await ctx.reply(summary, { parse_mode: "Markdown" });
    }
    return;
  }

  if (!data.startsWith("ans_")) return;

  const parts = data.split("_");
  const qIndex = parseInt(parts[1], 10);
  const selectedOpt = parts[2];

  const session = sessions.get(chatId);
  if (!session) {
    await ctx.reply("Session expired. Type /study to start a new quiz.");
    return;
  }

  await evaluateAndRespondAnswer(ctx, qIndex, selectedOpt, session, false);
}

export async function evaluateAndRespondAnswer(
  ctx: Context,
  qIndex: number,
  selectedOpt: string,
  session: QuizSession,
  isTextReply = false
) {
  const q = session.questions[qIndex];
  if (!q) return;

  const isCorrect = selectedOpt.toUpperCase() === q.correct.toUpperCase();
  const explorerLink = `https://suiscan.xyz/mainnet/object/${config.walrusAccountId}`;

  if (isCorrect) {
    session.score++;
    const activeChatId = ctx.chat?.id;
    const recovery = await walrus.recordCorrectAnswer(q.topic, session.subject, activeChatId);

    let text = `✅ *CORRECT!*\n\n`;
    text += `*Your choice:* ${selectedOpt}. ${q.options[selectedOpt] || ""}\n\n`;
    text += `💡 *Key Concept:* ${q.fact}\n`;

    if (recovery.newlyMastered) {
      text += `\n━━━━━━━━━━━━━━━━━━━\n🏆 *TOPIC FULLY MASTERED (3/3 Passes)!* ⛓️\n`;
      text += `You have passed questions on \`${q.topic}\` 3 times in a row! This weakness is now officially resolved and graduated to your Mastered list on Walrus.\n`;
    } else if (recovery.streak > 0) {
      const remaining = 3 - recovery.streak;
      text += `\n━━━━━━━━━━━━━━━━━━━\n📈 *RECOVERY IN PROGRESS (${recovery.streak}/3 Passes)* 🎯\n`;
      text += `Great progress! You previously struggled with \`${q.topic}\`. Pass this topic ${remaining} more time${remaining > 1 ? "s" : ""} in future drills to achieve full mastery!\n`;
    }

    const keyboard = new InlineKeyboard().text("Next Question ➡️", "next_q");

    const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");
    const formattedText = formatTelegramMarkdown(text);

    if (isTextReply) {
      await ctx.reply(formattedText, { parse_mode: "Markdown", reply_markup: keyboard }).catch(() => {
        ctx.reply(formattedText.replace(/[*_`]/g, ""), { reply_markup: keyboard });
      });
    } else {
      await ctx.editMessageText(formattedText, { parse_mode: "Markdown", reply_markup: keyboard }).catch(() => {
        ctx.editMessageText(formattedText.replace(/[*_`]/g, ""), { reply_markup: keyboard });
      });
    }
  } else {
    // Incorrect answer — trigger Walrus Memory write
    const misconception = q.traps?.[selectedOpt] || `Chose ${selectedOpt} instead of ${q.correct}`;

    let text = `❌ *INCORRECT*\n━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `• *Your Choice:* ${selectedOpt}. ${q.options[selectedOpt] || ""}\n`;
    text += `• *Correct Answer:* ${q.correct}. ${q.options[q.correct] || ""}\n\n`;
    text += `⚠️ *Misconception Diagnosis:*\n_${misconception}_\n\n`;
    text += `💡 *Flashcard Fact:*\n${q.fact}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    text += `🧠 *Walrus Mainnet Persistence:*\n`;
    text += `• *Topic:* \`${q.topic}\`\n`;
    text += `• *Status:* ⏳ Storing on Walrus Protocol...\n`;
    text += `• *On-Chain Account:* [View on Suiscan](${explorerLink})\n`;

    const keyboard = new InlineKeyboard().text("Next Question ➡️", "next_q");

    const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");
    const formattedText = formatTelegramMarkdown(text);

    let sentMsg: any = null;
    if (isTextReply) {
      sentMsg = await ctx.reply(formattedText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      }).catch(() => {
        return ctx.reply(formattedText.replace(/[*_`]/g, ""), { reply_markup: keyboard });
      });
    } else {
      await ctx.editMessageText(formattedText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      }).catch(() => {
        return ctx.editMessageText(formattedText.replace(/[*_`]/g, ""), { reply_markup: keyboard });
      });
    }

    // Commit to Walrus Protocol concurrently in the background (user-isolated)
    const activeChatId = ctx.chat?.id;
    walrus.remember(
      {
        topic: q.topic,
        question: q.stem,
        my_error: `Chose option ${selectedOpt}: ${q.options[selectedOpt] || ""} (${misconception})`,
        correct: `${q.correct}. ${q.options[q.correct] || ""} — ${q.fact}`,
        severity: "high",
        misses: 1,
        chatId: activeChatId,
      },
      session.subject,
      activeChatId
    ).then((res) => {
      if (res.jobId) {
        const updatedText = text.replace(
          "• *Status:* ⏳ Storing on Walrus Protocol...",
          `• *Status:* ✅ Committed to Walrus Mainnet Memory\n• *Job ID:* \`${res.jobId}\``
        );
        if (isTextReply && sentMsg && ctx.chat) {
          ctx.api.editMessageText(ctx.chat.id, sentMsg.message_id, updatedText, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
            link_preview_options: { is_disabled: true },
          }).catch(() => {});
        } else {
          ctx.editMessageText(updatedText, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
            link_preview_options: { is_disabled: true },
          }).catch(() => {});
        }
      }
    }).catch((err) => {
      console.error("Background remember write error:", err);
    });
  }
}
