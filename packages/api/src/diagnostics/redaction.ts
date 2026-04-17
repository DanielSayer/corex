const MAX_FAILURE_SUMMARY_LENGTH = 240;

const sensitiveAssignments = [
  {
    pattern:
      /\b(api[_-\s]?key|access[_-\s]?token|refresh[_-\s]?token|token|password|secret|credential)(\s*[:=]\s*)([^\s,;]+)/gi,
    replacement: "$1$2[redacted]",
  },
  {
    pattern: /\b(bearer)\s+([^\s,;]+)/gi,
    replacement: "$1 [redacted]",
  },
];

export function sanitizeFailureSummary(
  message: string | null | undefined,
): string | null {
  if (!message) {
    return null;
  }

  const singleLine = message.replace(/\s+/g, " ").trim();
  if (!singleLine) {
    return null;
  }

  const redacted = sensitiveAssignments.reduce(
    (current, rule) => current.replace(rule.pattern, rule.replacement),
    singleLine,
  );

  if (redacted.length <= MAX_FAILURE_SUMMARY_LENGTH) {
    return redacted;
  }

  return `${redacted.slice(0, MAX_FAILURE_SUMMARY_LENGTH - 3)}...`;
}
