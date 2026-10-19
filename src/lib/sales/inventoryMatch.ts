// Which inventory items the quote builder suggests for what's typed in an
// item name. Every typed word must appear somewhere in the item (name,
// description or section); names that start with the text come first, then
// items from the section being edited, then the rest alphabetically.

export interface MatchableItem {
  section: string;
  itemName: string;
  description: string | null;
}

const norm = (s: string) => s.trim().toLowerCase();

export function matchInventory<T extends MatchableItem>(items: readonly T[], typed: string, section: string, limit = 8): T[] {
  const q = norm(typed);
  const words = q.split(/\s+/).filter(Boolean);
  const here = norm(section);
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const name = norm(item.itemName);
    // An exact name is already picked (or typed in full) — nothing to suggest.
    if (q && name === q) return [];
    const haystack = `${name} ${norm(item.description ?? '')} ${norm(item.section)}`;
    if (!words.every((w) => haystack.includes(w))) continue;
    const score = (q && name.startsWith(q) ? 0 : 2) + (here && norm(item.section) === here ? 0 : 1);
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.item.itemName.localeCompare(b.item.itemName))
    .slice(0, limit)
    .map((s) => s.item);
}
