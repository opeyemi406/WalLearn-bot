/**
 * Normalizes Markdown from AI models and text templates so it renders natively in Telegram.
 * 
 * - Protects inline code blocks (`...`) so identifiers like `u123_ana204` are never altered
 * - Converts "### Heading" and "## Heading" to bold "*Heading*"
 * - Converts standard markdown bold "**text**" to Telegram's single "*text*"
 * - Converts bold-italic "***text***" to "*_text_*"
 * - Fixes unbalanced asterisks so Telegram entity parser never fails
 */
export function formatTelegramMarkdown(text: string): string {
  if (!text) return "";

  // 1. Temporarily protect code blocks and inline code `...`
  const codeBlocks: string[] = [];
  let clean = text.replace(/`[^`]+`/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 2. Remove markdown horizontal rules (--- or ***) and replace with clean unicode line
  clean = clean.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "━━━━━━━━━━━━━━━━━━━");

  // 3. Convert markdown headings: "# Title", "## Title", "### Title" -> "*Title*"
  clean = clean.replace(/^[ \t]*#{1,6}[ \t]+([^\n]+)/gm, "*$1*");
  // Remove any remaining inline "##" or "###"
  clean = clean.replace(/#{2,6}\s*/g, "");

  // 4. Convert bold-italic "***text***" -> "*_$1_*"
  clean = clean.replace(/\*\*\*([^*]+)\*\*\*/g, "*_$1_*");

  // 5. Convert double asterisks "**text**" -> "*text*"
  clean = clean.replace(/\*\*([^*]+)\*\*/g, "*$1*");

  // 6. Clean up any lingering double asterisks
  clean = clean.replace(/\*\*/g, "*");

  // 7. Fix unescaped stray asterisks if unbalanced
  const stars = (clean.match(/(?<!\\)\*/g) || []).length;
  if (stars % 2 !== 0) {
    const lastStarIndex = clean.lastIndexOf("*");
    if (lastStarIndex !== -1) {
      clean = clean.slice(0, lastStarIndex) + clean.slice(lastStarIndex + 1);
    }
  }

  // 8. Restore protected code blocks verbatim (preserving underscores and namespaces)
  clean = clean.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => {
    return codeBlocks[Number(idx)] || "";
  });

  return clean;
}
