// Live search in the header: title priority, then recipe text.
const input = document.getElementById('search-input');
const box = document.getElementById('search-results');

if (input && box) {
  let items = [];
  let active = -1;
  let timer = null;
  let controller = null;

  const hide = () => { box.setAttribute('hidden', ''); box.innerHTML = ''; items = []; active = -1; };

  function fallbackThumb(title) {
    const span = document.createElement('span');
    span.className = 'sr-thumb-fallback';
    span.textContent = (title || '?').trim().charAt(0).toUpperCase();
    return span;
  }

  function buildItem(r) {
    const a = document.createElement('a');
    a.className = 'sr-item';
    a.href = `/recipe/${r.slug}`;
    a.setAttribute('role', 'option');

    if (r.image_url) {
      const img = document.createElement('img');
      img.className = 'sr-thumb';
      img.src = r.image_url;
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = () => img.replaceWith(fallbackThumb(r.title));
      a.appendChild(img);
    } else {
      a.appendChild(fallbackThumb(r.title));
    }

    const text = document.createElement('span');
    text.className = 'sr-text';
    const title = document.createElement('span');
    title.className = 'sr-title';
    title.textContent = r.title;
    const sub = document.createElement('span');
    sub.className = 'sr-sub';
    const tagText = (r.tags || []).map((t) => t.name).slice(0, 3).join(' · ');
    sub.textContent = r.titleMatch ? (tagText || r.difficulty || '') : 'Match in recipe text';
    text.append(title, sub);
    a.appendChild(text);
    return a;
  }

  function show(results) {
    box.innerHTML = '';
    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'sr-empty';
      empty.textContent = 'No matches';
      box.appendChild(empty);
      box.removeAttribute('hidden');
      items = []; active = -1;
      return;
    }
    items = results.map((r) => {
      const el = buildItem(r);
      box.appendChild(el);
      return el;
    });
    active = -1;
    box.removeAttribute('hidden');
  }

  function setActive(i) {
    if (active >= 0 && items[active]) items[active].classList.remove('active');
    active = i;
    if (active >= 0 && items[active]) {
      items[active].classList.add('active');
      items[active].scrollIntoView({ block: 'nearest' });
    }
  }

  async function run(q) {
    if (controller) controller.abort();
    controller = new AbortController();
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      const data = await res.json();
      show(data.results || []);
    } catch (e) {
      if (e.name !== 'AbortError') hide();
    }
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length < 1) { hide(); return; }
    timer = setTimeout(() => run(q), 160);
  });

  input.addEventListener('keydown', (e) => {
    if (box.hasAttribute('hidden') || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(items.length - 1, active + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(-1, active - 1)); }
    else if (e.key === 'Enter') {
      if (active >= 0 && items[active]) { e.preventDefault(); window.location.href = items[active].href; }
    } else if (e.key === 'Escape') { hide(); }
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 1 && box.innerHTML) box.removeAttribute('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && e.target !== input) hide();
  });
}
