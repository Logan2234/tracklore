const MENTION_PATTERN = /@([a-zA-Z0-9_]{2,32})/g;

/** Extracts the distinct usernames `@mentioned` in a comment's text. */
export function extractMentions(text: string): string[] {
  const usernames = new Set<string>();

  for (const match of text.matchAll(MENTION_PATTERN)) {
    usernames.add(match[1]);
  }

  return [...usernames];
}
