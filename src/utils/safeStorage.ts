export function safeLoad<T>(key: string, fallback: T, normalize?: (value: unknown) => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return normalize ? normalize(parsed) : (parsed as T);
  } catch (error) {
    console.warn(`Failed to load local storage key: ${key}`, error);
    return fallback;
  }
}

export function safeSave<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to save local storage key: ${key}`, error);
    return false;
  }
}

export function safeReset(key: string) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to reset local storage key: ${key}`, error);
    return false;
  }
}
