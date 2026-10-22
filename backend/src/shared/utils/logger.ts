function marca(): string {
  return new Date().toISOString();
}

export const log = {
  info: (...args: unknown[]) => console.log(`[${marca()}] INFO `, ...args),
  warn: (...args: unknown[]) => console.warn(`[${marca()}] WARN `, ...args),
  error: (...args: unknown[]) => console.error(`[${marca()}] ERROR`, ...args),
};
