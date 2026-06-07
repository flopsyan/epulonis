// Light/Dark/System theme switch (footer). Default: System.
// "system" follows the OS preference via CSS @media (prefers-color-scheme).
const KEY = 'epulonis-theme';
const root = document.documentElement;
const buttons = [...document.querySelectorAll('[data-theme-choice]')];

function apply(choice) {
  if (choice === 'light' || choice === 'dark') {
    root.setAttribute('data-theme', choice);
  } else {
    root.removeAttribute('data-theme'); // system -> let the media query decide
  }
  buttons.forEach((b) => {
    const active = b.dataset.themeChoice === choice;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

let current = 'system';
try {
  current = localStorage.getItem(KEY) || 'system';
} catch { /* localStorage unavailable */ }

apply(current);

buttons.forEach((b) => {
  b.addEventListener('click', () => {
    current = b.dataset.themeChoice;
    try { localStorage.setItem(KEY, current); } catch { /* ignore */ }
    apply(current);
  });
});
