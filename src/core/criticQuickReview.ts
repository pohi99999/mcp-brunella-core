export interface QuickCriticReview {
  ok: boolean;
  score: number;
  reason?: string;
}

export function quickReviewOutput(output: string): QuickCriticReview {
  if (!output || output.trim().length === 0) {
    return { ok: false, score: 0, reason: 'Üres válasz' };
  }

  const secretPattern = /(?:ghp_|sk-|cfut_|AIza)[a-zA-Z0-9_-]{20,}/;
  if (secretPattern.test(output)) {
    return { ok: false, score: 0, reason: 'Titok szivárgás!' };
  }

  if (output.trim().length < 20) {
    return { ok: true, score: 0.55, reason: 'Rövid válasz — ellenőrizd a teljességet.' };
  }

  return { ok: true, score: 0.8 };
}