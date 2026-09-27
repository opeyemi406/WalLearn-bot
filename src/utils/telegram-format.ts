/**
 * Normalizes Markdown from AI models and text templates so it renders natively in Telegram.
 * 
 * - Converts "### Heading" and "## Heading" to bold "*Heading*"
 * - Converts standard markdown bold "**text**" to Telegram's single "*text*"
 * - Converts bold-italic "***text***" to "*_text_*"
 * - Ensures balanced asterisks and underscores so Telegram entity parser never fails
 */
export function formatTelegramMarkdown(text: string): string {
  if (!text) return "";

  let clean = text;

  // 1. Remove markdown horizontal rules (--- or ***) and replace with clean unicode line
  clean = clean.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "━━━━━━━━━━━━━━━━━━━");

  // 2. Convert markdown headings: "# Title", "## Title", "### Title" -> "*Title*"
  clean = clean.replace(/^[ \t]*#{1,6}[ \t]+([^\n]+)/gm, "*$1*");

  // 3. Convert bold-italic "***text***" -> "*_text_*"
  clean = clean.replace(/\*\*\*([^*]+)\*\*\*/g, "*_$1_*");

  // 4. Convert double asterisks "**text**" -> "*text*"
  clean = clean.replace(/\*\*([^*]+)\*\*/g, "*$1*");

  // 5. Clean up any lingering double asterisks
  clean = clean.replace(/\*\*/g, "*");

  // 6. Fix unescaped stray asterisks if unbalanced
  const stars = (clean.match(/(?<!\\)\*/g) || []).length;
  if (stars % 2 !== 0) {
    const lastStarIndex = clean.lastIndexOf("*");
    if (lastStarIndex !== -1) {
      clean = clean.slice(0, lastStarIndex) + clean.slice(lastStarIndex + 1);
    }
  }

  // 7. Fix unescaped stray underscores if unbalanced
  const underscores = (clean.match(/(?<!\\)_/g) || []).length;
  if (underscores % 2 !== 0) {
    const lastUnderIndex = clean.lastIndexOf("_");
    if (lastUnderIndex !== -1) {
      clean = clean.slice(0, lastUnderIndex) + clean.slice(lastUnderIndex + 1);
    }
  }

  return clean;
}
