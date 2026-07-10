// Servings scaling + live match against the pantry.
import { normalizeName, pantryStatus, formatAmount, consumeAmount } from './units.js';

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
        title = `${t('in_pantry')} ${haveTxt} - ${t('need')} ${formatAmount(scaled)} ${unit}`.trim();
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

  // --- Subtract from pantry (modal) ---------------------------------------
  const dialog = document.getElementById('consume-dialog');
  const openBtn = document.getElementById('consume-open');
  const rowsBox = document.getElementById('consume-rows');

  const numStr = (n) => String(Math.round(Number(n) * 1000) / 1000);
  const parseNum = (v) => {
    if (v == null) return null;
    const s = String(v).trim().replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  if (dialog && openBtn && rowsBox) {
    const addBtn = document.getElementById('consume-add');
    const confirmBtn = document.getElementById('consume-confirm');
    const cancelBtn = document.getElementById('consume-cancel');
    const closeBtn = document.getElementById('consume-x');
    const nameList = document.getElementById('consume-names');

    function makeRow(name = '', amount = '', unit = '') {
      const el = document.createElement('div');
      el.className = 'consume-row';
      el.innerHTML = `
        <input class="cr-name" type="text" list="consume-names" placeholder="${t('ph_ingredient')}" />
        <input class="cr-amount" type="text" inputmode="decimal" placeholder="${t('ph_amount')}" />
        <input class="cr-unit" type="text" list="consume-units" placeholder="${t('ph_unit')}" />
        <button type="button" class="row-remove" aria-label="${t('remove_ingredient')}">✕</button>
        <div class="cr-preview"></div>`;
      el.querySelector('.cr-name').value = name;
      el.querySelector('.cr-amount').value = amount;
      el.querySelector('.cr-unit').value = unit;
      return el;
    }

    // Live "Pantry: 1 kg → 400 g" preview for a row.
    function preview(row) {
      const name = row.querySelector('.cr-name').value.trim();
      const unit = row.querySelector('.cr-unit').value;
      const box = row.querySelector('.cr-preview');
      box.className = 'cr-preview';
      if (!name) { box.textContent = ''; return; }
      const have = pantry[normalizeName(name)];
      if (!have) { box.textContent = t('not_in_pantry'); box.classList.add('warn'); return; }
      const haveTxt = have.amount != null
        ? `${formatAmount(have.amount)} ${have.unit || ''}`.trim()
        : (have.unit || '');
      const need = parseNum(row.querySelector('.cr-amount').value);
      if (need == null || need <= 0) { box.textContent = `${t('in_pantry')} ${haveTxt}`.trim(); return; }
      const left = consumeAmount({ amount: have.amount, unit: have.unit }, { amount: need, unit });
      if (left == null) {
        box.textContent = `${t('in_pantry')} ${haveTxt} · ${t('diff_unit')}`;
        box.classList.add('warn');
      } else {
        box.textContent = `${t('in_pantry')} ${haveTxt} → ${formatAmount(left)} ${have.unit || ''}`.trim();
      }
    }

    function refreshNameList() {
      if (!nameList) return;
      nameList.innerHTML = '';
      for (const key of Object.keys(pantry)) {
        const opt = document.createElement('option');
        opt.value = pantry[key].name;
        nameList.appendChild(opt);
      }
    }

    function openDialog() {
      rowsBox.innerHTML = '';
      const factor = currentServings() / baseServings;
      for (const li of ingredients) {
        const { baseAmount, unit = '', name = '' } = li.dataset;
        if (baseAmount === '' || baseAmount == null) continue; // skip "to taste"
        rowsBox.appendChild(makeRow(name, numStr(Number(baseAmount) * factor), unit));
      }
      if (!rowsBox.children.length) rowsBox.appendChild(makeRow());
      refreshNameList();
      rowsBox.querySelectorAll('.consume-row').forEach(preview);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeDialog() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    }

    rowsBox.addEventListener('input', (e) => {
      const row = e.target.closest('.consume-row');
      if (row) preview(row);
    });
    rowsBox.addEventListener('click', (e) => {
      if (!e.target.closest('.row-remove')) return;
      e.target.closest('.consume-row').remove();
      if (!rowsBox.children.length) rowsBox.appendChild(makeRow());
    });
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const row = makeRow();
        rowsBox.appendChild(row);
        row.querySelector('.cr-name').focus();
      });
    }

    openBtn.addEventListener('click', openDialog);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDialog);
    if (closeBtn) closeBtn.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

    confirmBtn.addEventListener('click', async () => {
      const items = [...rowsBox.querySelectorAll('.consume-row')]
        .map((row) => ({
          name: row.querySelector('.cr-name').value.trim(),
          amount: row.querySelector('.cr-amount').value,
          unit: row.querySelector('.cr-unit').value.trim(),
        }))
        .filter((i) => i.name && parseNum(i.amount) > 0);

      if (!items.length) { closeDialog(); return; }

      confirmBtn.disabled = true;
      try {
        const res = await fetch('/api/pantry/consume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        if (res.status === 401 || res.status === 403) { window.location.href = '/login'; return; }
        const data = await res.json();
        if (data && data.ok) {
          pantry = data.pantry || pantry;
          render(currentServings());
          const applied = (data.results || []).filter((r) => r.status === 'ok').length;
          const skipped = (data.results || []).length - applied;
          toast(applied
            ? `${t('consume_done')}${skipped ? ` · ${skipped} ${t('consume_skipped')}` : ''}`
            : t('consume_none'));
          closeDialog();
        }
      } catch (e) {
        /* ignore network errors - pantry stays unchanged */
      } finally {
        confirmBtn.disabled = false;
      }
    });
  }
}
