// Display formatting (German format).

// Rounds to max. 2 decimal places and drops trailing zeros.
// Returns a string. null/empty -> ''.
export function formatAmount(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  const rounded = Math.round(num * 100) / 100;
  // No thousands separator: amounts are read back from inputs, where "1.500" would be 1.5.
  return rounded.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false });
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

// "2027-06-10" -> "10.06.2027". '' for no date.
export function formatDate(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('de-DE', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
