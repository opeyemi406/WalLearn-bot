import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, "../../scripts/parse_document.py");

export interface DocumentParseResult {
  text: string;
  pages: number;
}

export async function parseDocumentBuffer(
  buffer: Buffer,
  fileExtension = "pdf"
): Promise<DocumentParseResult> {
  const ext = fileExtension.toLowerCase().replace(/^\./, "");

  // If image format, extract text using Gemini multimodal vision
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
    const text = await extractTextFromImage(buffer, `image/${ext === "jpg" ? "jpeg" : ext}`);
    return { text, pages: 1 };
  }

  // If plain text format, decode directly
  if (["txt", "md", "csv", "json"].includes(ext)) {
    const text = buffer.toString("utf-8").trim();
    return { text, pages: 1 };
  }

  // Use python universal document parser if available
  if (fs.existsSync(SCRIPT_PATH)) {
    try {
      const result = await runPythonParser(buffer, ext);
      if (result.success && result.text) {
        return {
          text: result.text.trim(),
          pages: result.pages || 1,
        };
      }
      if (result.error) {
        console.warn(`Python parser returned error: ${result.error}`);
      }
    } catch (err) {
      console.warn("Python parser execution failed, attempting fallbacks:", err);
    }
  }

  // Fallback for PDF if python parser failed
  if (ext === "pdf") {
    try {
      // Dynamic import to avoid crashes if pdf-parse has environment issues
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      const text = data.text
        .replace(/\r\n/g, "\n")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();
      return { text, pages: data.numpages || 1 };
    } catch (fallbackError) {
      console.error("PDF fallback parse failed:", fallbackError);
    }
  }

  // Fallback UTF-8 attempt
  const utf8 = buffer.toString("utf-8", 0, Math.min(buffer.length, 50000));
  const readableChars = utf8.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
  if (readableChars.length > 100) {
    return { text: readableChars.trim(), pages: 1 };
  }

  throw new Error(`Failed to extract readable text from .${ext} file. Please verify the document contains digital text.`);
}

export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const result = await parseDocumentBuffer(buffer, "pdf");
  return result.text;
}

function runPythonParser(
  buffer: Buffer,
  ext: string
): Promise<{ success: boolean; text?: string; pages?: number; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn("python3", [SCRIPT_PATH, ext], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
        return;
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch (e) {
        resolve({ success: false, error: `Invalid JSON from parser: ${stdout}` });
      }
    });

    proc.stdin.write(buffer);
    proc.stdin.end();
  });
}

export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<string> {
  const { ai } = await import("./client.js");
  const { config } = await import("../config.js");
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await ai.chat.completions.create({
    model: config.aiModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all academic lecture text, slide titles, bullet points, formulas, definitions, and questions visible in this image verbatim. Transcribe the contents clearly and thoroughly. Do NOT include any conversational preamble (e.g. do not say 'Here is the transcription...'). Output ONLY the raw transcribed content. Never use double asterisks (**). Use single asterisks *bold* if emphasizing text.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
    temperature: 0.1,
  });

  let content = response.choices[0]?.message?.content?.trim() || "";

  // Strip conversational AI introductory preamble
  content = content.replace(/^(?:Here(?:'s| is) (?:the )?(?:verbatim )?transcription[^\n]*\n*)/i, "");
  content = content.replace(/^(?:The (?:provided )?image (?:contains|shows|transcribes)[^\n]*\n*)/i, "");

  // Normalize any double asterisks to single asterisk bold
  content = content.replace(/\*\*([^*]+)\*\*/g, "*$1*").replace(/\*\*/g, "*");

  return content.trim();
}

