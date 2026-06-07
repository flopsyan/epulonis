// Header account menu: toggle the dropdown, close on outside click / Escape.
const menu = document.getElementById('user-menu');
if (menu) {
  const btn = document.getElementById('avatar-btn');
  const dropdown = document.getElementById('user-dropdown');

  const open = () => { dropdown.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
  const close = () => { dropdown.hidden = true; btn.setAttribute('aria-expanded', 'false'); };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.hidden) open(); else close();
  });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
