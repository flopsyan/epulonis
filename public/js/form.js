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

// Steps use steps[] - only update the numbers.
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

// Image: either paste a link or upload a picture. Both feed a single hidden
// field (image-data, submitted as image_url). Uploads are resized in the
// browser to a data URL - no upload endpoint or dependency needed.
const imageUrl = document.getElementById('image-url');
const imageFile = document.getElementById('image-file');
const imagePick = document.getElementById('image-pick');
const imageClear = document.getElementById('image-clear');
const imageData = document.getElementById('image-data');
const preview = document.getElementById('image-preview');
const previewImg = document.getElementById('image-preview-img');

if (imageData && preview && previewImg) {
  const MAX = 1280; // longest edge in px for uploaded pictures

  function setImage(url) {
    imageData.value = url;
    if (url) {
      previewImg.src = url;
      preview.removeAttribute('hidden');
    } else {
      preview.setAttribute('hidden', '');
    }
    if (imageClear) imageClear.hidden = !url;
  }

  // Typing/pasting a link uses that URL and drops any uploaded picture.
  if (imageUrl) {
    imageUrl.addEventListener('input', () => {
      if (imageFile) imageFile.value = '';
      setImage(imageUrl.value.trim());
    });
  }

  // Uploading resizes the picture and clears the typed link.
  if (imagePick && imageFile) {
    imagePick.addEventListener('click', () => imageFile.click());
    imageFile.addEventListener('change', () => {
      const file = imageFile.files && imageFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          if (imageUrl) imageUrl.value = '';
          setImage(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (imageClear) {
    imageClear.addEventListener('click', () => {
      if (imageUrl) imageUrl.value = '';
      if (imageFile) imageFile.value = '';
      setImage('');
    });
  }

  previewImg.addEventListener('error', () => preview.setAttribute('hidden', ''));
}
