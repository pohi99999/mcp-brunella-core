const STOPWORDS = new Set([
  "a",
  "az",
  "és",
  "is",
  "to",
  "the",
  "of",
  "for",
  "with",
  "egy",
  "egyik",
  "hogy",
  "ha",
  "then",
  "and",
  "or",
  "from",
  "into",
  "on",
  "in",
  "at",
  "be",
  "van",
  "vagy",
  "el",
  "fel",
  "le",
  "meg",
  "ki",
  "be",
  "do",
  "does",
  "please",
  "kérlek",
]);

export function normalizeTask(task: string): string {
  return String(task || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !STOPWORDS.has(token))
    .join(" ")
    .trim();
}

export function fnvHash(text: string): string {
  let hash = 0x811c9dc5;
  const input = String(text || "");

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashTask(task: string): { normalizedTask: string; taskHash: string } {
  const normalizedTask = normalizeTask(task);
  return {
    normalizedTask,
    taskHash: fnvHash(normalizedTask),
  };
}
