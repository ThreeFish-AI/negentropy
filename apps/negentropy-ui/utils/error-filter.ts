const NON_CRITICAL_ERROR_PATTERNS = [
  /litellm\.APIError.*(?:logging|streaming usage)/i,
  /Error building chunks for logging/i,
];

export function isNonCriticalError(message: string): boolean {
  return NON_CRITICAL_ERROR_PATTERNS.some((p) => p.test(message));
}
