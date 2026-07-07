/**
 * Emoji detection & stripping.
 *
 * Policy: SMS messages must be plain characters — no emoji. Emoji force the
 * whole message into UCS-2 encoding (70 chars/segment instead of 160), which
 * doubles cost and reads poorly in transactional SMS. We enforce this on the
 * frontend before a message can be sent.
 *
 * Detection keys on the Unicode `Extended_Pictographic` property (the blessed
 * "is this emoji-like" set) plus regional-indicator pairs (flag emoji). The
 * `u` flag is required for these property escapes.
 */

// Base emoji: pictographic symbols or a regional-indicator (flag) letter.
const EMOJI_CORE = /[\u{1F1E6}-\u{1F1FF}]|\p{Extended_Pictographic}/u
const EMOJI_CORE_G = /[\u{1F1E6}-\u{1F1FF}]|\p{Extended_Pictographic}/gu

// Modifiers that decorate emoji: skin tones (1F3FB-1F3FF), ZWJ (200D),
// variation selectors (FE0E/FE0F), and combining enclosing keycap (20E3).
const EMOJI_DECORATION_G = /[\u{1F3FB}-\u{1F3FF}\u200D\uFE0E\uFE0F\u20E3]/gu

export function containsEmoji(text: string): boolean {
  return EMOJI_CORE.test(text)
}

/** Unique emoji characters present in the text (for showing the user). */
export function findEmoji(text: string): string[] {
  const matches = text.match(EMOJI_CORE_G) ?? []
  return [...new Set(matches)]
}

/** Remove all emoji (and their decorations) from the text. */
export function stripEmoji(text: string): string {
  return text
    .replace(EMOJI_CORE_G, '')
    .replace(EMOJI_DECORATION_G, '')
    // Collapse any double spaces left behind by removed emoji.
    .replace(/ {2,}/g, ' ')
}
