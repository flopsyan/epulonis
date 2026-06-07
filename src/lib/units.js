// Einheiten-Logik: Normalisierung, Umrechnung und Mengenvergleich.
// Wird sowohl für den Vorrats-Abgleich (Server) als auch – als Spiegelbild –
// im Browser (public/js/units.js) genutzt. Beide Dateien bewusst synchron halten.

// Synonyme -> kanonische Einheit
const SYNONYMS = {
  // Masse
  mg: 'mg', milligramm: 'mg',
  g: 'g', gr: 'g', gramm: 'g', gramms: 'g',
  dag: 'dag', dkg: 'dag', deka: 'dag', dekagramm: 'dag',
  kg: 'kg', kilo: 'kg', kilogramm: 'kg',
  // Volumen
  ml: 'ml', milliliter: 'ml',
  cl: 'cl', centiliter: 'cl', zentiliter: 'cl',
  dl: 'dl', deziliter: 'dl',
  l: 'l', liter: 'l', ltr: 'l',
  // Stück / Anzahl
  '': 'stück', stk: 'stück', st: 'stück', stck: 'stück', stueck: 'stück',
  'stück': 'stück', 'stücke': 'stück', stups: 'stück', x: 'stück',
};

// Umrechnungsfaktoren in die jeweilige Basiseinheit
const MASS = { mg: 0.001, g: 1, dag: 10, kg: 1000 }; // Basis: g
const VOLUME = { ml: 1, cl: 10, dl: 100, l: 1000 }; // Basis: ml

export function normalizeUnit(unit) {
  let u = String(unit ?? '').trim().toLowerCase();
  u = u.replace(/\.+$/, ''); // "EL." -> "el"
  if (Object.prototype.hasOwnProperty.call(SYNONYMS, u)) return SYNONYMS[u];
  return u;
}

// Liefert { dimension, value } in Basiseinheiten.
// dimension ist 'mass' | 'volume' | 'count' | 'other:<einheit>'.
// Zwei Mengen sind nur vergleichbar, wenn ihre dimension identisch ist.
export function toBase(amount, unit) {
  const u = normalizeUnit(unit);
  const value = amount == null || amount === '' ? null : Number(amount);
  if (u in MASS) return { dimension: 'mass', value: value == null ? null : value * MASS[u] };
  if (u in VOLUME) return { dimension: 'volume', value: value == null ? null : value * VOLUME[u] };
  if (u === 'stück') return { dimension: 'count', value };
  return { dimension: `other:${u}`, value };
}

// Unregelmäßige Pluralformen, die eine einfache Endungsregel nicht abdeckt.
const IRREGULAR_PLURALS = { eier: 'ei' };

// Normalisiert Zutaten-/Vorratsnamen für den Abgleich und vereinheitlicht dabei
// Singular/Plural (Zitrone/Zitronen, Ei/Eier), damit z. B. "1 Zitrone" im Rezept
// zu "Zitronen" im Vorrat passt.
export function normalizeName(name) {
  let n = String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (IRREGULAR_PLURALS[n]) return IRREGULAR_PLURALS[n];
  // reguläre -n/-en-Plurale auf den Singular zurückführen
  if (n.length > 3 && n.endsWith('n')) n = n.slice(0, -1);
  return n;
}

// Vergleicht eine benötigte Zutat mit einem Vorratseintrag.
// Rückgabe-Status:
//   'ok'        – genug vorhanden
//   'low'       – etwas vorhanden, aber zu wenig
//   'missing'   – nicht im Vorrat
//   'unknown'   – im Vorrat, aber Mengen nicht vergleichbar (andere Einheit)
//   'available' – im Vorrat, Zutat ohne Mengenangabe
export function pantryStatus(need, have) {
  if (!have) return { status: 'missing', haveBase: 0 };

  const needBase = toBase(need.amount, need.unit);
  const haveBase = toBase(have.amount, have.unit);

  // Zutat ohne Mengenangabe (z. B. "Salz nach Geschmack")
  if (needBase.value == null) {
    return { status: 'available', haveBase: haveBase.value };
  }

  // Einheiten nicht vergleichbar -> wir wissen nur: vorhanden
  if (needBase.dimension !== haveBase.dimension || haveBase.value == null) {
    return { status: 'unknown', haveBase: haveBase.value };
  }

  if (haveBase.value >= needBase.value) return { status: 'ok', haveBase: haveBase.value };
  if (haveBase.value > 0) return { status: 'low', haveBase: haveBase.value };
  return { status: 'missing', haveBase: haveBase.value };
}
