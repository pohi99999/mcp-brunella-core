/**
 * Startup validation: warn if secrets/keys are missing when required.
 * Never log actual secrets; only report missing vs present.
 */

const validators: { name: string; check: () => boolean; hint: string }[] = [
  {
    name: 'ANYTHINGLLM_API_KEY',
    check: () => !!process.env.ANYTHINGLLM_API_KEY,
    hint: 'Set ANYTHINGLLM_API_KEY for AnythingLLM workspace/chat API.',
  },
];

export function validateSecrets(): void {
  if (process.env.BRUNELLA_SKIP_SECRETS_CHECK === '1') return;
  for (const v of validators) {
    if (!v.check()) {
      console.warn(`[brunella] Missing config: ${v.name}. ${v.hint}`);
    }
  }
}
