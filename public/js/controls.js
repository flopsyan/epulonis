// Own look for selects, suggestion lists and validation messages. The native control
// stays in the form as the value carrier, so FormData and existing listeners keep working.

// form.elements and existing listeners keep working.

const nativeValue = {
  select: Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value'),
  selectedIndex: Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex'),
  input: Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'),
};
let uid = 0;

const make = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
};
const fire = (el, ...types) => types.forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));

// `el.value = x` from other scripts fires no event, so route it through the native setter and resync.
function onValueSet(el, props, fn) {
  for (const [prop, d] of props) {
    Object.defineProperty(el, prop, {
      configurable: true,
      get: () => d.get.call(el),
      set: (v) => {
        d.set.call(el, v);
        fn();
      },
    });
  }
}

function mirrorState(el, target) {
  const sync = () => {
    target.hidden = el.hidden;
    for (const c of target.matches('button, input') ? [target] : target.querySelectorAll('button, input')) c.disabled = el.disabled;
  };
  new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['hidden', 'disabled'] });
  sync();
}

// form.reset() changes the values without an event on the controls themselves.
function onReset(el, fn) {
  el.form?.addEventListener('reset', () => setTimeout(fn));
}

function labelText(el) {
  const label = el.labels?.[0];
  return el.getAttribute('aria-label') || (label && !label.contains(el) ? label.textContent.trim() : '');
}

// A popover sits in the top layer; inside a modal dialog it has to live in the dialog, or it is inert.
function popup(owner, className, role) {
  const pop = make('div', `popup ${className}`);
  pop.id = `popup-${++uid}`;
  pop.setAttribute('popover', 'auto');
  if (role) pop.setAttribute('role', role);
  pop.anchor = owner;
  (owner.closest('dialog') || document.body).append(pop);
  return pop;
}

// Below the anchor, or above it when there is more room there.
function place(pop, stretch) {
  const r = pop.anchor.getBoundingClientRect();
  if (stretch) pop.style.minWidth = `${r.width}px`;
  pop.style.maxHeight = '';
  const h = pop.offsetHeight;
  const below = innerHeight - r.bottom - 8;
  const above = r.top - 8;
  const down = h <= below || below >= above;
  const room = Math.max(120, down ? below : above);
  if (h > room) pop.style.maxHeight = `${room}px`;
  pop.style.top = `${Math.max(8, down ? r.bottom + 2 : r.top - 2 - Math.min(h, room))}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 8 - pop.offsetWidth))}px`;
}

// A press on the trigger of an open popup already light-dismisses it; the click must not reopen it.
function toggleFrom(trigger, isOpen, open) {
  let wasOpen = false;
  trigger.addEventListener('pointerdown', () => (wasOpen = isOpen()));
  trigger.addEventListener('click', (e) => {
    if (e.detail && wasOpen) return void (wasOpen = false);
    open();
  });
}

function keepVisible(list, el) {
  if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop - 4;
  else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 4;
}

function typeahead() {
  let buffer = '';
  let timer;
  return (key, options) => {
    clearTimeout(timer);
    timer = setTimeout(() => (buffer = ''), 700);
    buffer += key.toLowerCase();
    return options.find((o) => o.textContent.toLowerCase().startsWith(buffer));
  };
}

// ---------------------------------------------------------------- select
function enhanceSelect(sel) {
  if (sel.multiple || 'enhanced' in sel.dataset) return;
  sel.dataset.enhanced = '';
  const btn = make('button', `select ${sel.className}`.trim());
  btn.type = 'button';
  btn.setAttribute('role', 'combobox');
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  if (labelText(sel)) btn.setAttribute('aria-label', labelText(sel));
  const value = make('span', 'select-value');
  btn.append(value);
  sel.before(btn);
  let list = null;

  const sync = () => [...value.children].forEach((s, i) => s.classList.toggle('is-on', i === sel.selectedIndex));
  const rebuild = () => {
    value.replaceChildren(...[...sel.options].map((o) => make('span', '', o.label)));
    sync();
  };
  rebuild();
  onValueSet(sel, [['value', nativeValue.select], ['selectedIndex', nativeValue.selectedIndex]], sync);
  new MutationObserver(rebuild).observe(sel, { childList: true, subtree: true, characterData: true });
  mirrorState(sel, btn);
  onReset(sel, sync);

  const optionEl = (o) => {
    const el = make('div', '', o.label);
    el.setAttribute('role', 'option');
    el.tabIndex = -1;
    el.dataset.index = o.index;
    el.setAttribute('aria-selected', String(o.index === sel.selectedIndex));
    if (o.disabled) el.setAttribute('aria-disabled', 'true');
    return el;
  };
  const options = () => [...list.querySelectorAll('[role="option"]:not([aria-disabled]):not([hidden])')];
  const focusOption = (el) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    keepVisible(list, el);
  };

  // Built on open and removed on close, so re-rendered forms leave no popups behind.
  function open() {
    list = popup(btn, 'popup-list', 'listbox');
    btn.setAttribute('aria-controls', list.id);
    wireList(list);
    list.replaceChildren(
      ...[...sel.children].map((node) => {
        if (node.tagName !== 'OPTGROUP') return optionEl(node);
        const group = make('div');
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', node.label);
        const head = make('div', 'popup-group', node.label);
        head.setAttribute('aria-hidden', 'true');
        group.append(head, ...[...node.children].map(optionEl));
        return group;
      })
    );
    list.showPopover();
    place(list, true);
    btn.setAttribute('aria-expanded', 'true');
    const current = list.querySelector('[aria-selected="true"]') || options()[0];
    if (current) list.scrollTop = current.offsetTop - list.clientHeight / 2 + current.offsetHeight / 2;
    current?.focus({ preventScroll: true });
  }

  function choose(el) {
    const i = Number(el.dataset.index);
    btn.focus({ preventScroll: true });
    list.hidePopover();
    if (i === sel.selectedIndex || sel.options[i].disabled) return;
    sel.selectedIndex = i;
    fire(sel, 'input', 'change');
  }

  toggleFrom(btn, () => !!list?.matches(':popover-open'), open);
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open();
    }
  });

  const find = typeahead();
  function wireList(pop) {
    pop.addEventListener('beforetoggle', (e) => {
      if (e.newState !== 'closed') return;
      btn.setAttribute('aria-expanded', 'false');
      if (pop.contains(document.activeElement)) btn.focus({ preventScroll: true });
    });
    pop.addEventListener('toggle', (e) => e.newState === 'closed' && pop.remove());
    pop.addEventListener('click', (e) => {
      const el = e.target.closest('[role="option"]:not([aria-disabled])');
      if (el) choose(el);
    });
    pop.addEventListener('pointermove', (e) => {
      const el = e.target.closest('[role="option"]:not([aria-disabled])');
      if (el && el !== document.activeElement) el.focus({ preventScroll: true });
    });
    pop.addEventListener('keydown', (e) => {
      const all = options();
      const i = all.indexOf(document.activeElement);
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (i >= 0) choose(all[i]);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        pop.hidePopover();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const next = { ArrowDown: Math.min(i + 1, all.length - 1), ArrowUp: Math.max(i - 1, 0), Home: 0, End: all.length - 1 }[e.key];
        focusOption(all[next]);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        focusOption(find(e.key, all));
      }
    });
  }
}

// ---------------------------------------------------------------- suggestions (replaces <datalist>)


function enhanceSuggestions(input) {
  const values = [...(input.list?.options || [])].map((o) => o.value);
  input.removeAttribute('list');
  // No arrow without names: it would promise a list that never opens.
  if (!values.length) return;
  input.classList.add('combo');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  const list = popup(input, 'popup-list', 'listbox');
  input.setAttribute('aria-controls', list.id);
  let active = -1;

  const items = () => [...list.children];
  const setActive = (i) => {
    items().forEach((el, k) => el.classList.toggle('is-active', k === i));
    active = i;
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', items()[i].id);
      keepVisible(list, items()[i]);
    } else input.removeAttribute('aria-activedescendant');
  };
  const hide = () => list.matches(':popover-open') && list.hidePopover();

  function show(all) {
    const q = input.value.trim().toLowerCase();
    const hits = values.filter((v) => all || v.toLowerCase().includes(q)).slice(0, 200);
    if (!hits.length || (!all && hits.length === 1 && hits[0] === input.value)) return hide();
    list.replaceChildren(
      ...hits.map((v, i) => {
        const el = make('div', '', v);
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', String(v === input.value));
        el.id = `${list.id}-${i}`;
        return el;
      })
    );
    if (!list.matches(':popover-open')) list.showPopover();
    place(list, true);
    input.setAttribute('aria-expanded', 'true');
    setActive(-1);
  }

  function choose(el) {
    input.value = el.textContent;
    hide();
    fire(input, 'input', 'change');
  }

  input.addEventListener('input', () => show(false));
  // Not filtered by the current text: a name read from a PDF would otherwise hide the other partners.
  input.addEventListener('click', () => !list.matches(':popover-open') && show(true));
  input.addEventListener('blur', hide);
  input.addEventListener('keydown', (e) => {
    const open = list.matches(':popover-open');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return show(true);
      const n = items().length;
      setActive(e.key === 'ArrowDown' ? (active + 1) % n : (active - 1 + n) % n);
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault();
      choose(items()[active]);
    }
  });
  list.addEventListener('beforetoggle', (e) => e.newState === 'closed' && input.setAttribute('aria-expanded', 'false'));
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('pointermove', (e) => {
    const el = e.target.closest('[role="option"]');
    if (el) setActive(items().indexOf(el));
  });
  list.addEventListener('click', (e) => {
    const el = e.target.closest('[role="option"]');
    if (el) choose(el);
  });
}

// ---------------------------------------------------------------- validation

const errors = new WeakMap();

const I18N = (() => {
  try { return JSON.parse(document.getElementById('i18n')?.textContent || '{}'); }
  catch { return {}; }
})();
const tr = (k, v) => (I18N[k] || k).replace('{n}', v);

function message(el) {
  const v = el.validity;
  if (v.customError) return el.validationMessage;
  if (v.valueMissing) return tr(el.tagName === 'SELECT' ? 'v_choose' : 'v_required');
  if (v.typeMismatch || v.patternMismatch) return tr('v_format');
  if (v.tooShort) return tr('v_min_len', el.minLength);
  if (v.rangeUnderflow) return tr('v_min', el.min);
  if (v.rangeOverflow) return tr('v_max', el.max);
  return tr('v_invalid');
}

// The control the user sees, for hidden value carriers and wrapped fields.
function visibleOf(el) {
  if (el.tagName === 'SELECT' && 'enhanced' in el.dataset) return el.previousElementSibling;
  return el;
}

function clearError(el) {
  errors.get(el)?.remove();
  errors.delete(el);
  el.removeAttribute('aria-invalid');
}

let focusedOne = false;

// Cancelling the event is what keeps the browser's validation bubble away.
document.addEventListener('invalid', (e) => {
  e.preventDefault();
  const el = e.target;
  clearError(el);
  const shown = visibleOf(el);
  const p = make('p', 'field-error', message(el));
  p.setAttribute('role', 'alert');
  shown.after(p);
  errors.set(el, p);
  el.setAttribute('aria-invalid', 'true');
  if (focusedOne) return;
  focusedOne = true;
  setTimeout(() => (focusedOne = false));
  (shown.matches('button, input') ? shown : shown.querySelector('button, input')).focus();
}, true);

for (const type of ['input', 'change']) {
  document.addEventListener(type, (e) => {
    if (errors.has(e.target) && e.target.validity.valid) clearError(e.target);
  }, true);
}
document.addEventListener('reset', (e) => [...e.target.elements].forEach(clearError));

// ---------------------------------------------------------------- wiring

function enhance(root) {
  const pick = (sel) => [...(root.matches?.(sel) ? [root] : []), ...(root.querySelectorAll?.(sel) || [])];
  pick('select').forEach(enhanceSelect);
  pick('input[list]').forEach(enhanceSuggestions);
}

enhance(document.body);
new MutationObserver((records) => {
  for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && !n.classList.contains('popup')) enhance(n);
}).observe(document.body, { childList: true, subtree: true });

// An open popup follows its field while the page scrolls; it closes once the field is gone.
let lastWidth = innerWidth;
function follow(e) {
  if (e.type === 'resize' && innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  for (const pop of document.querySelectorAll('.popup:popover-open')) {
    if (e.target instanceof Node && pop.contains(e.target)) continue;
    const r = pop.anchor.getBoundingClientRect();
    if (!pop.anchor.isConnected || r.bottom < 0 || r.top > innerHeight || e.type === 'resize') pop.hidePopover();
    else place(pop, pop.classList.contains('popup-list'));
  }
}
addEventListener('scroll', follow, true);
addEventListener('resize', follow);
