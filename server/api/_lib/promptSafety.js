const PROMPT_INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)\b/i,
  /\b(disregard|override|bypass)\s+(the\s+)?(system|developer|safety|previous|prior)\b/i,
  /\b(system|developer)\s+(prompt|message|instructions?)\b/i,
  /\breveal\s+(your\s+)?(prompt|instructions?|rules?|secrets?)\b/i,
  /\b(jailbreak|prompt\s*injection|do\s+anything\s+now)\b/i,
  /\bact\s+as\s+(an?\s+)?(unrestricted|uncensored|different)\b/i,
  /<\s*(system|developer|assistant)\s*>/i,
  /\[\s*(system|developer|assistant)\s*\]/i,
];

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const containsPromptInjection = (value) => {
  const text = normalizeText(value);
  return Boolean(text) && PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
};

const assertNoPromptInjection = (value, label = 'AI request') => {
  if (!containsPromptInjection(value)) return;
  const error = new Error(`${label} contains instructions that are not allowed.`);
  error.statusCode = 400;
  error.code = 'PROMPT_INJECTION_REJECTED';
  throw error;
};

module.exports = {
  assertNoPromptInjection,
  containsPromptInjection,
};
