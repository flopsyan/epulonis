// Anzeige-Formatierung (deutsches Format).

// Rundet auf max. 2 Nachkommastellen und entfernt überflüssige Nullen.
// Gibt einen String mit deutschem Dezimalkomma zurück. null/leer -> ''.
export function formatAmount(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  const rounded = Math.round(num * 100) / 100;
  return rounded.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

// Minuten -> "1 Std 30 Min" / "45 Min".
export function formatTime(minutes) {
  const m = Number(minutes);
  if (!m || m <= 0) return '';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h && rest) return `${h} Std ${rest} Min`;
  if (h) return `${h} Std`;
  return `${rest} Min`;
}
