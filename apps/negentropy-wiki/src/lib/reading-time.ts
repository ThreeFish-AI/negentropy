export function estimateReadingTime(content: string, wpm = 300): number {
  const text = content.replace(/[#*`\[\]()>|-]/g, "");
  const chineseChars = (text.match(/[一-鿿]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return Math.max(1, Math.ceil((chineseChars + englishWords) / wpm));
}
