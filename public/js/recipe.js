// Servings scaling + live match against the pantry.
import { normalizeName, pantryStatus, formatAmount } from './units.js';

const I18N = (() => {
  try { return JSON.parse(document.getElementById('i18n')?.textContent || '{}'); }
  catch { return {}; }
})();
const t = (k) => (k in I18N ? I18N[k] : k);

const article = document.querySelector('.recipe');
if (article) {
  const baseServings = Number(article.dataset.baseServings) || 1;
  const input = document.getElementById('servings-input');
  const ingredients = [...document.querySelectorAll('.ingredient')];

  let pantry = {};
  try {
    pantry = JSON.parse(document.getElementById('pantry-data')?.textContent || '{}');
  } catch { pantry = {}; }

  const PILL = {
    ok: ['ok', '✓', t('legend_ok')],
    available: ['ok', '✓', t('legend_ok')],
    low: ['low', '≈', t('legend_low')],
    unknown: ['unknown', '•', t('legend_ok')],
    missing: ['missing', '✕', t('legend_missing')],
  };

  function applyPill(el, status, have, scaled, unit) {
    const [cls, ico, label] = PILL[status] || PILL.missing;
    el.className = 'pantry-pill ' + cls;
    el.querySelector('.pill-ico').textContent = ico;
    el.querySelector('.pill-label').textContent = label;

    let title = '';
    if (status === 'missing') {
      title = t('not_in_pantry');
    } else if (have) {
      const haveTxt =
        have.amount != null ? `${formatAmount(have.amount)} ${have.unit || ''}`.trim() : t('legend_ok');
      if (status === 'low') {
        title = `${t('in_pantry')} ${haveTxt} – ${t('need')} ${formatAmount(scaled)} ${unit}`.trim();
      } else if (status === 'unknown') {
        title = `${t('in_pantry')} ${haveTxt} (${t('diff_unit')})`;
      } else {
        title = `${t('in_pantry')} ${haveTxt}`;
      }
    }
    el.title = title;
  }

  function render(servings) {
    const factor = servings / baseServings;
    for (const li of ingredients) {
      const { baseAmount, unit = '', name = '' } = li.dataset;
      const amountEl = li.querySelector('.amount');
      let scaled = null;
      if (baseAmount !== '' && baseAmount != null) {
        scaled = Number(baseAmount) * factor;
        if (amountEl) amountEl.textContent = formatAmount(scaled);
      } else if (amountEl) {
        amountEl.textContent = '';
      }
      const have = pantry[normalizeName(name)];
      const status = pantryStatus({ amount: scaled, unit }, have);
      const pill = li.querySelector('.pantry-pill');
      if (pill) applyPill(pill, status, have, scaled, unit);
    }
  }

  function currentServings() {
    const v = Number(String(input.value).replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : baseServings;
  }

  document.querySelectorAll('.step-btn[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.step);
      let next = Math.round((currentServings() + step) * 100) / 100;
      if (next < 1) next = 1;
      input.value = formatAmount(next);
      render(next);
    });
  });

  input.addEventListener('input', () => render(currentServings()));
  input.addEventListener('blur', () => {
    input.value = formatAmount(currentServings());
  });

  // Initial sync (sets tooltips & any rounding)
  render(currentServings());
}
