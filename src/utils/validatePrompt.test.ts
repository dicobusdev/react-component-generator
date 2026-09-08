import { describe, it, expect } from 'vitest';
import { validatePrompt, isPromptValid } from './validatePrompt';

describe('validatePrompt', () => {
  it('빈 프롬프트는 validation error 반환', () => {
    const result = validatePrompt('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('프롬프트를 입력해주세요.');
  });

  it('공백만 있는 프롬프트는 validation error 반환', () => {
    const result = validatePrompt('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('프롬프트를 입력해주세요.');
  });

  it('500자 이하의 프롬프트는 valid', () => {
    const prompt = 'a'.repeat(500);
    const result = validatePrompt(prompt);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('501자 이상의 프롬프트는 validation error 반환', () => {
    const prompt = 'a'.repeat(501);
    const result = validatePrompt(prompt);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('프롬프트는 500자 이내여야 합니다.');
  });

  it('일반 텍스트는 valid', () => {
    const result = validatePrompt('고객 목록 테이블 위에 들어갈 검색 필터 바를 만들어줘');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('정확히 500자는 valid', () => {
    const prompt = 'a'.repeat(500);
    const result = validatePrompt(prompt);
    expect(result.valid).toBe(true);
  });

  it('499자는 valid', () => {
    const prompt = 'a'.repeat(499);
    const result = validatePrompt(prompt);
    expect(result.valid).toBe(true);
  });
});

describe('isPromptValid', () => {
  it('valid 프롬프트는 true 반환', () => {
    expect(isPromptValid('테스트')).toBe(true);
  });

  it('빈 프롬프트는 false 반환', () => {
    expect(isPromptValid('')).toBe(false);
  });

  it('500자 초과는 false 반환', () => {
    expect(isPromptValid('a'.repeat(501))).toBe(false);
  });
});
