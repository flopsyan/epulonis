// Pantry page: add/edit form, per-item usage dialog, best-before batches and the list filter.
import { normalizeName, formatAmount, consumeAmount, formatDate } from './units.js';

const I18N = (() => {
  try { return JSON.parse(document.getElementById('i18n')?.textContent || '{}'); }
  catch { return {}; }
})();
const t = (k) => (k in I18N ? I18N[k] : k);
const lang = document.documentElement.lang;

let pantry = {};
try {
  pantry = JSON.parse(document.getElementById('pantry-data')?.textContent || '{}');
} catch { pantry = {}; }

const byId = (id) => Object.values(pantry).find((p) => p.id === Number(id));
const qty = (amount, unit) => `${amount == null ? '' : formatAmount(amount)} ${unit || ''}`.trim();

// --- Add / edit form -------------------------------------------------------
const form = document.getElementById('pantry-form');
if (form) {
  const nameEl = document.getElementById('p-name');
  const amountEl = document.getElementById('p-amount');
  const unitEl = document.getElementById('p-unit');
  const bbdEl = document.getElementById('p-bbd');
  const dupHint = document.getElementById('p-dup-hint');
  const title = document.getElementById('pantry-form-title');
  const submit = document.getElementById('pantry-submit');
  const reset = document.getElementById('pantry-reset');
  let editing = null; // batch id while a batch is being edited

  function checkDuplicate() {
    const item = pantry[normalizeName(nameEl.value)];
    const date = bbdEl.value;
    dupHint.hidden = !(item && date && item.batches.some((b) => b.best_before === date && b.id !== editing));
  }

  function resetForm() {
    editing = null;
    form.action = '/pantry';
    nameEl.disabled = false;
    nameEl.value = '';
    amountEl.value = '';
    unitEl.value = '';
    bbdEl.value = '';
    title.textContent = t('add_item');
    submit.textContent = t('p_add');
    reset.hidden = true;
    checkDuplicate();
    nameEl.focus();
  }

  // Taking over the unit the item is already counted in avoids a unit mismatch.
  nameEl.addEventListener('change', () => {
    const item = pantry[normalizeName(nameEl.value)];
    if (item && !unitEl.value) unitEl.value = item.unit || '';
  });
  nameEl.addEventListener('input', checkDuplicate);
  bbdEl.addEventListener('input', checkDuplicate);
  bbdEl.addEventListener('change', checkDuplicate);

  document.querySelectorAll('.pantry-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const li = btn.closest('.pantry-item');
      editing = Number(btn.dataset.batch);
      form.action = `/pantry/batch/${editing}`;
      nameEl.value = li.dataset.name || '';
      nameEl.disabled = true;
      amountEl.value = btn.dataset.amount || '';
      unitEl.value = li.dataset.unit || '';
      bbdEl.value = btn.dataset.bbd || '';
      title.textContent = t('edit_item');
      submit.textContent = t('update');
      reset.hidden = false;
      checkDuplicate();
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      amountEl.focus();
    });
  });

  reset.addEventListener('click', resetForm);
  checkDuplicate();
}

// --- Best-before batches ---------------------------------------------------
document.querySelectorAll('.batch-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const list = document.getElementById(btn.getAttribute('aria-controls'));
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
  });
});

// --- Filter ----------------------------------------------------------------
// Case- and accent-blind, every word has to appear somewhere in the name.
const fold = (s) => String(s).normalize('NFD').replace(/\p{Mn}+/gu, '').toLowerCase();

const search = document.getElementById('pantry-search');
if (search) {
  const clear = document.getElementById('pantry-search-clear');
  const count = document.getElementById('pantry-count');
  const nomatch = document.getElementById('pantry-nomatch');
  const rows = [...document.querySelectorAll('#pantry-list .pantry-item')];

  function apply() {
    const words = fold(search.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const li of rows) {
      const hay = fold(li.dataset.name || '');
      const hit = words.every((w) => hay.includes(w));
      li.hidden = !hit;
      if (hit) shown++;
    }
    count.textContent = `${shown} ${shown === 1 ? t('entry_one') : t('entry_many')}`;
    nomatch.hidden = shown > 0;
    clear.hidden = !search.value;
  }

  search.addEventListener('input', apply);
  clear.addEventListener('click', () => {
    search.value = '';
    apply();
    search.focus();
  });
}

// --- Log usage (minus per item) --------------------------------------------
const dialog = document.getElementById('consume-dialog');
if (dialog) {
  const cform = document.getElementById('consume-form');
  const nameEl = document.getElementById('consume-name');
  const amountEl = document.getElementById('c-amount');
  const unitEl = document.getElementById('c-unit');
  const batchField = document.getElementById('c-batch-field');
  const batchEl = document.getElementById('c-batch');
  const preview = document.getElementById('c-preview');
  let item = null;

  function updatePreview() {
    preview.classList.remove('warn');
    const have = qty(item.amount, item.unit);
    const used = Number(String(amountEl.value).replace(',', '.'));
    if (!amountEl.value || !Number.isFinite(used) || used <= 0) {
      preview.textContent = `${t('in_pantry')} ${have}`;
      return;
    }
    const left = consumeAmount({ amount: item.amount, unit: item.unit }, { amount: used, unit: unitEl.value });
    if (left == null) {
      preview.textContent = `${t('in_pantry')} ${have} · ${t('diff_unit')}`;
      preview.classList.add('warn');
    } else {
      preview.textContent = `${t('in_pantry')} ${have} → ${qty(left, item.unit)}`;
    }
  }

  document.querySelectorAll('.pantry-consume').forEach((btn) => {
    btn.addEventListener('click', () => {
      item = byId(btn.dataset.id);
      if (!item) return;
      cform.action = `/pantry/${item.id}/consume`;
      nameEl.textContent = item.name;
      amountEl.value = '';
      unitEl.value = item.unit || '';

      const batches = item.batches.filter((b) => b.amount == null || b.amount > 0);
      batchEl.replaceChildren(
        ...batches.map((b) => {
          const label = `${b.best_before ? `${t('p_bbd')} ${formatDate(b.best_before, lang)}` : t('p_no_bbd')} (${qty(b.amount, item.unit)})`;
          return new Option(label, b.id);
        })
      );
      batchField.hidden = batches.length < 2;
      updatePreview();
      dialog.showModal();
      amountEl.focus();
    });
  });

  amountEl.addEventListener('input', updatePreview);
  unitEl.addEventListener('input', updatePreview);
  const close = () => dialog.close();
  document.getElementById('consume-cancel').addEventListener('click', close);
  document.getElementById('consume-x').addEventListener('click', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
}
