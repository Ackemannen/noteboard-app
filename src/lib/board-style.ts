const ACCENTS = [
  "bg-yellow-200 text-yellow-900",
  "bg-pink-200 text-pink-900",
  "bg-blue-200 text-blue-900",
  "bg-green-200 text-green-900",
  "bg-orange-200 text-orange-900",
  "bg-violet-200 text-violet-900",
] as const;

/** A stable sticky-note-like color for a board, derived from its id. */
export function boardAccent(boardId: string) {
  let hash = 0;
  for (let i = 0; i < boardId.length; i++) {
    hash = (hash * 31 + boardId.charCodeAt(i)) | 0;
  }
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

export function initials(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
