import { describe, it, expect } from 'vitest';
import { getStorageItem, STORAGE_KEYS } from './storage';

describe('storage utilities', () => {
  describe('getStorageItem', () => {
    it('존재하지 않는 key는 기본값을 반환한다', () => {
      const defaultValue = { fallback: true };
      const result = getStorageItem('nonexistent-key-xyz-123', defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('유효하지 않은 JSON은 기본값을 반환한다', () => {
      const defaultValue = { safe: true };
      const result = getStorageItem('invalid-json-key', defaultValue);
      expect(result).toEqual(defaultValue);
    });
  });

  describe('STORAGE_KEYS 상수', () => {
    it('모든 키가 정의되어 있다', () => {
      expect(STORAGE_KEYS.API_KEY).toBeDefined();
      expect(STORAGE_KEYS.PROVIDER).toBeDefined();
      expect(STORAGE_KEYS.COMPONENTS).toBeDefined();
      expect(STORAGE_KEYS.PROMPT_HISTORY).toBeDefined();
    });

    it('모든 키가 문자열이고 비어있지 않다', () => {
      const keys = [
        STORAGE_KEYS.API_KEY,
        STORAGE_KEYS.PROVIDER,
        STORAGE_KEYS.COMPONENTS,
        STORAGE_KEYS.PROMPT_HISTORY,
      ];
      keys.forEach((key) => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });

    it('각 키가 고유하다', () => {
      const keys = [
        STORAGE_KEYS.API_KEY,
        STORAGE_KEYS.PROVIDER,
        STORAGE_KEYS.COMPONENTS,
        STORAGE_KEYS.PROMPT_HISTORY,
      ];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });
});
