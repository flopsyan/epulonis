// Turns a title into a URL-friendly "slug".
// Example: "Grandma's Apple Pie!" -> "grandmas-apple-pie"

// Map accented characters (incl. German umlauts) to ASCII so titles in any
// language still produce clean slugs.
const ACCENT_MAP = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  Ä: 'ae', Ö: 'oe', Ü: 'ue',
  à: 'a', á: 'a', â: 'a', ã: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u',
  ç: 'c', ñ: 'n',
};

export function slugify(text) {
  const base = String(text || '')
    .trim()
    .replace(/[äöüßÄÖÜàáâãèéêëìíîïòóôõùúûçñ]/g, (ch) => ACCENT_MAP[ch] || ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'recipe';
}

// Ensures a slug is unique. `exists` is a function that returns true when the
// slug is already taken.
export function uniqueSlug(text, exists) {
  const base = slugify(text);
  let candidate = base;
  let i = 2;
  while (exists(candidate)) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}
