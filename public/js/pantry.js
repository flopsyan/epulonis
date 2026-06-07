// Convenience: load an existing pantry entry into the form (edit).
const I18N = (() => {
  try { return JSON.parse(document.getElementById('i18n')?.textContent || '{}'); }
  catch { return {}; }
})();
const t = (k) => (k in I18N ? I18N[k] : k);

const form = document.getElementById('pantry-form');
if (form) {
  const nameEl = document.getElementById('p-name');
  const amountEl = document.getElementById('p-amount');
  const unitEl = document.getElementById('p-unit');
  const title = document.getElementById('pantry-form-title');
  const submit = document.getElementById('pantry-submit');
  const reset = document.getElementById('pantry-reset');

  function resetForm() {
    nameEl.value = '';
    amountEl.value = '';
    unitEl.value = '';
    title.textContent = t('add_item');
    submit.textContent = t('save');
    reset.hidden = true;
    nameEl.focus();
  }

  document.querySelectorAll('.pantry-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.pantry-item');
      nameEl.value = item.dataset.name || '';
      amountEl.value = item.dataset.amount || '';
      unitEl.value = item.dataset.unit || '';
      title.textContent = t('edit_item');
      submit.textContent = t('update');
      reset.hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      amountEl.focus();
    });
  });

  if (reset) reset.addEventListener('click', resetForm);
}
