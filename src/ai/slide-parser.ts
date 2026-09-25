import pdfParse from "pdf-parse";

export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    // Clean up excessive whitespace
    const text = data.text
      .replace(/\r\n/g, "\n")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();
    return text;
  } catch (error) {
    console.error("PDF parse error:", error);
    throw new Error("Failed to extract text from PDF document.");
  }
}
