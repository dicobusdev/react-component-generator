const MAX_PROMPT_LENGTH = 500;

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

export function validatePrompt(prompt: string): ValidationResult {
  const trimmed = prompt.trim();

  if (!trimmed) {
    return {
      valid: false,
      error: '프롬프트를 입력해주세요.',
    };
  }

  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: '프롬프트는 500자 이내여야 합니다.',
    };
  }

  return {
    valid: true,
    error: null,
  };
}

export function isPromptValid(prompt: string): boolean {
  return validatePrompt(prompt).valid;
}

export function getPromptLength(prompt: string): number {
  return prompt.trim().length;
}

export function getPromptLengthRemaining(prompt: string): number {
  return Math.max(0, MAX_PROMPT_LENGTH - getPromptLength(prompt));
}
