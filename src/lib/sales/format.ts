// Display formatting shared by the Sales screens and the PDF documents.

// "13 Oct, 2026", as on the printed documents; `fallback` when there's no date.
export function documentDate(iso: string | null | undefined, fallback = 'TBC'): string {
  if (!iso) return fallback;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const month = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' }); // "Oct" (en-CA gives "Oct.")
  return `${d} ${month}, ${y}`;
}

// The Toronto calendar date (YYYY-MM-DD) of a moment (an ISO timestamp).
export function torontoDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
}

// "Oct 14, 2026 at 11:42 AM" for a moment, in Toronto time (in-app
// activity lines, e.g. when a quote was emailed).
export function activityDateTime(iso: string): string {
  const at = new Date(iso);
  const date = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Toronto' });
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' });
  return `${date} at ${time}`;
}

// "13 Oct, 2026, 3:05 p.m." for a moment, in Toronto time.
export function documentDateTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' });
  return `${documentDate(torontoDate(iso))}, ${time}`;
}

const nameWords = (name: string) => name.trim().split(/[\s._-]+/).filter(Boolean);

// "Atmiya Patel" -> "AP": first letters of the first and last name. One name
// gives one letter; an email-style name ("atmiya.patel") splits on . _ -.
// `firstLetters` takes more of the first name: 2 -> "AtP".
export function nameInitials(name: string, firstLetters = 1): string {
  const words = nameWords(name);
  if (words.length === 0) return '?';
  const first = words[0].slice(0, firstLetters);
  const last = words.length > 1 ? words[words.length - 1][0].toUpperCase() : '';
  return first[0].toUpperCase() + first.slice(1).toLowerCase() + last;
}

// Initials for a set of people, unique among them: "AP" normally, but when
// two different names would share one ("Atmiya Patel", "Ankit Patel") those
// take more of the first name until they differ ("AtP", "AnP").
export function distinctInitials(names: readonly string[]): Map<string, string> {
  const unique = [...new Set(names.map((n) => n.trim()))];
  const result = new Map<string, string>();
  const longest = Math.max(1, ...unique.map((n) => nameWords(n)[0]?.length ?? 1));
  for (const name of unique) {
    let letters = 1;
    let initials = nameInitials(name, letters);
    // Lengthen while another name would produce the same initials.
    while (letters < longest && unique.some((other) => other !== name && nameInitials(other, letters).toUpperCase() === initials.toUpperCase())) {
      letters++;
      initials = nameInitials(name, letters);
    }
    result.set(name, initials);
  }
  return result;
}
