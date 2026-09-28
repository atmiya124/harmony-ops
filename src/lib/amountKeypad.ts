// What each key on the in-app amount keypad does to the typed amount. The
// text stays in the same plain form the amount parser accepts ("1234.5"),
// so saving still goes through parseAmountToCents.

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace';

// $1,000,000 is the largest amount accepted, so 7 whole-dollar digits is
// enough; the parser still reports anything over the limit.
const MAX_WHOLE_DIGITS = 7;

export function applyKeypadKey(text: string, key: KeypadKey): string {
  if (key === 'backspace') return text.slice(0, -1);
  const dot = text.indexOf('.');
  if (key === '.') {
    if (dot !== -1) return text;
    return text === '' ? '0.' : `${text}.`;
  }
  if (dot !== -1) {
    // At most two decimal places.
    return text.length - dot > 2 ? text : text + key;
  }
  // A leading zero is replaced ("0" then "5" is "5", not "05").
  if (text === '0') return key;
  return text.length >= MAX_WHOLE_DIGITS ? text : text + key;
}

// Maps a physical keyboard key (desktop) to a keypad key.
export function keypadKeyFromKeyboard(key: string): KeypadKey | null {
  if (/^[0-9]$/.test(key)) return key as KeypadKey;
  if (key === '.' || key === ',') return '.';
  if (key === 'Backspace') return 'backspace';
  return null;
}

// "1234.5" is shown as "1,234.5": thousands separators on the whole-dollar
// part, the decimals exactly as typed.
export function formatKeypadAmount(text: string): string {
  const [whole, fraction] = text.split('.');
  const grouped = (whole || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
