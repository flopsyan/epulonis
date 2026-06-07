// Dynamic ingredient/step rows + image preview for the recipe form.

const I18N = (() => {
  try { return JSON.parse(document.getElementById('i18n')?.textContent || '{}'); }
  catch { return {}; }
})();
const t = (k) => (k in I18N ? I18N[k] : k);

const ingredientRows = document.getElementById('ingredient-rows');
const stepRows = document.getElementById('step-rows');

function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function ingredientRow() {
  return el(`
    <div class="row ingredient-row">
      <input type="text" class="cell-amount" data-field="amount" inputmode="decimal" placeholder="${t('ph_amount')}" />
      <input type="text" class="cell-unit" data-field="unit" placeholder="${t('ph_unit')}" list="unit-list" />
      <input type="text" class="cell-name" data-field="name" placeholder="${t('ph_ingredient')}" />
      <input type="text" class="cell-note" data-field="note" placeholder="${t('ph_note')}" />
      <button type="button" class="row-remove" aria-label="${t('remove_ingredient')}">✕</button>
    </div>`);
}

function stepRow() {
  return el(`
    <div class="row step-row">
      <span class="step-num"></span>
      <textarea data-field="step" name="steps[]" rows="2" placeholder="${t('ph_step')}"></textarea>
      <button type="button" class="row-remove" aria-label="${t('remove_step')}">✕</button>
    </div>`);
}

// Ingredients need indexed names (ingredients[i][field]).
function reindexIngredients() {
  if (!ingredientRows) return;
  [...ingredientRows.querySelectorAll('.ingredient-row')].forEach((row, i) => {
    row.querySelectorAll('[data-field]').forEach((inp) => {
      inp.name = `ingredients[${i}][${inp.dataset.field}]`;
    });
  });
}

// Steps use steps[] – only update the numbers.
function reindexSteps() {
  if (!stepRows) return;
  [...stepRows.querySelectorAll('.step-row')].forEach((row, i) => {
    const num = row.querySelector('.step-num');
    if (num) num.textContent = i + 1;
  });
}

function setupSection(container, factory, addBtnId, reindex, focusSelector) {
  if (!container) return;
  const addBtn = document.getElementById(addBtnId);
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const row = factory();
      container.appendChild(row);
      reindex();
      const f = row.querySelector(focusSelector);
      if (f) f.focus();
    });
  }
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-remove');
    if (!btn) return;
    btn.closest('.row').remove();
    // keep at least one empty row
    if (!container.children.length) container.appendChild(factory());
    reindex();
  });
  // on load: empty starter row if none present
  if (!container.children.length) container.appendChild(factory());
  reindex();
}

setupSection(ingredientRows, ingredientRow, 'add-ingredient', reindexIngredients, '.cell-name');
setupSection(stepRows, stepRow, 'add-step', reindexSteps, 'textarea');

// Image preview
const imageInput = document.getElementById('image_url');
const preview = document.getElementById('image-preview');
const previewImg = document.getElementById('image-preview-img');
if (imageInput && preview && previewImg) {
  imageInput.addEventListener('input', () => {
    const url = imageInput.value.trim();
    if (!url) { preview.setAttribute('hidden', ''); return; }
    previewImg.src = url;
    preview.removeAttribute('hidden');
  });
  previewImg.addEventListener('error', () => preview.setAttribute('hidden', ''));
}
