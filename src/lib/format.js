// Display formatting (English format).

// Rounds to max. 2 decimal places and drops trailing zeros.
// Returns a string. null/empty -> ''.
export function formatAmount(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  const rounded = Math.round(num * 100) / 100;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Minutes -> "1 h 30 min" / "45 min".
export function formatTime(minutes) {
  const m = Number(minutes);
  if (!m || m <= 0) return '';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h && rest) return `${h} h ${rest} min`;
  if (h) return `${h} h`;
  return `${rest} min`;
}
