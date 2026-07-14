/**
 * User-input sanitization.
 * React Native renders text as plain strings (no HTML injection surface),
 * so this focuses on cleaning the raw string: control characters,
 * invisible bidi-override characters, length limits.
 */

export const MAX_MESSAGE_LENGTH = 500;

/** C0/C1 control characters except newline and tab. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]',
  'g',
);

/** Zero-width & bidi-control characters that can spoof rendered text. */
const INVISIBLE_CHARS_RE = new RegExp(
  '[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF]',
  'g',
);

export function sanitizeInput(raw: string): string {
  return raw
    .replace(CONTROL_CHARS_RE, '')
    .replace(INVISIBLE_CHARS_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

/** True when the sanitized message is sendable. */
export function isValidMessage(raw: string): boolean {
  return sanitizeInput(raw).length > 0;
}
