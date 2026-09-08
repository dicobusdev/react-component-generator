export const STORAGE_KEYS = {
  API_KEY: 'rcg_api_key',
  PROVIDER: 'rcg_provider',
  COMPONENTS: 'rcg_components',
  PROMPT_HISTORY: 'rcg_prompt_history',
} as const;

export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to save to localStorage: ${key}`, err);
  }
}

export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`Failed to remove from localStorage: ${key}`, err);
  }
}
