// Erzeugt aus einem Titel einen URL-tauglichen "Slug".
// Beispiel: "Omas Apfelkuchen!" -> "omas-apfelkuchen"

const UMLAUT_MAP = {
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
    .replace(/[äöüßÄÖÜàáâãèéêëìíîïòóôõùúûçñ]/g, (ch) => UMLAUT_MAP[ch] || ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'rezept';
}

// Stellt sicher, dass ein Slug eindeutig ist. `exists` ist eine Funktion,
// die true zurückgibt, wenn der Slug bereits vergeben ist.
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
