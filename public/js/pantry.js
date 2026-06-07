// Convenience: load an existing pantry entry into the form (edit).
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
    title.textContent = 'Add an item';
    submit.textContent = 'Save';
    reset.hidden = true;
    nameEl.focus();
  }

  document.querySelectorAll('.pantry-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.pantry-item');
      nameEl.value = item.dataset.name || '';
      amountEl.value = item.dataset.amount || '';
      unitEl.value = item.dataset.unit || '';
      title.textContent = 'Edit item';
      submit.textContent = 'Update';
      reset.hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      amountEl.focus();
    });
  });

  if (reset) reset.addEventListener('click', resetForm);
}
