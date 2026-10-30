// Designed stand-in for confirm(): forms with data-confirm ask in a dialog first.
const I18N = (() => {
  try { return JSON.parse(document.getElementById('i18n')?.textContent || '{}'); }
  catch { return {}; }
})();

function ask(text, action) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ask';
    const form = document.createElement('form');
    form.method = 'dialog';
    const heading = document.createElement('h2');
    heading.textContent = text;
    const row = document.createElement('div');
    row.className = 'ask-actions';
    for (const [label, cls, value] of [[I18N.cancel || 'Cancel', 'btn-ghost', 'no'], [action, 'btn-danger', 'yes']]) {
      const btn = document.createElement('button');
      btn.className = `btn ${cls}`;
      btn.textContent = label;
      btn.value = value;
      row.append(btn);
    }
    form.append(heading, row);
    dialog.append(form);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'yes');
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

// The flag lets the re-submit through once the question is answered.
const confirmed = new WeakSet();
document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!form.dataset?.confirm || confirmed.has(form)) return;
  e.preventDefault();
  const submitter = e.submitter;
  if (await ask(form.dataset.confirm, form.dataset.confirmAction || I18N.delete || 'Delete')) {
    confirmed.add(form);
    form.requestSubmit(submitter);
  }
});
