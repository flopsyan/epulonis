import express from 'express';
import {
  listRecipes,
  searchRecipes,
  getRecipeBySlug,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  authorsWithCounts,
} from '../models/recipes.js';
import { allTagsWithCounts, getTagBySlug } from '../models/tags.js';
import {
  allPantry,
  pantryMap,
  addPantry,
  editBatch,
  deleteBatch,
  deletePantry,
  consumePantryItem,
} from '../models/pantry.js';
import { normalizeName, pantryStatus } from '../lib/units.js';
import {
  requireAuth,
  requireAdmin,
  loginPossible,
  loginBlocked,
  recordLoginFailure,
  resetLoginFailures,
  authenticate,
  setSessionCookie,
  clearSessionCookie,
  setSsoFlowCookie,
  takeSsoFlow,
  setSsoIdCookie,
  takeSsoIdToken,
} from '../lib/auth.js';
import { oidcEnabled, startLogin, finishLogin, logoutUrl, userFromClaims } from '../lib/oidc.js';
import {
  publicUser,
  getUserById,
  verifyPassword,
  listUsers,
  createUser,
  updateProfile,
  changePassword,
  deleteUser,
  hasPasswordUsers,
} from '../models/users.js';

const router = express.Router();

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// Restrict a redirect target to local paths (no open redirects).
function safeNext(next) {
  const n = String(next || '/');
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : '/';
}

// Turns raw form data into a clean data object.
function normalizeRecipeBody(body) {
  let ingredients = body.ingredients;
  if (!ingredients) ingredients = [];
  else if (!Array.isArray(ingredients)) ingredients = Object.values(ingredients);

  let steps = body.steps;
  if (!steps) steps = [];
  else if (typeof steps === 'string') steps = [steps];
  else if (!Array.isArray(steps)) steps = Object.values(steps);

  const tags = String(body.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return { ...body, ingredients, steps, tags };
}

// --- Overview / search -----------------------------------------------------
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const tagSlug = (req.query.tag || '').trim();
  const authorIdRaw = parseInt(req.query.author, 10);
  const authorId = Number.isInteger(authorIdRaw) && authorIdRaw > 0 ? authorIdRaw : null;

  const tags = allTagsWithCounts();
  const authors = authorsWithCounts();

  let recipes;
  let activeTag = null;
  let activeAuthor = null;
  if (q) {
    recipes = searchRecipes(q);
  } else {
    activeTag = tagSlug ? getTagBySlug(tagSlug) || null : null;
    activeAuthor = authorId ? authors.find((a) => a.id === authorId) || null : null;
    recipes = listRecipes({ tagSlug: activeTag ? activeTag.slug : undefined, authorId });
  }

  res.render('index', {
    title: q ? `${req.t('title_search')} ${q}` : req.t('all_recipes'),
    recipes,
    tags,
    authors,
    activeTag,
    activeAuthor,
    query: q,
    isSearch: Boolean(q),
  });
});

// --- Login / logout --------------------------------------------------------
function renderLogin(req, res, status, error, next) {
  res.status(status).render('login', {
    title: req.t('title_login'),
    error,
    next,
    sso: oidcEnabled(),
    passwordLogin: hasPasswordUsers(),
  });
}

router.get('/login', (req, res) => {
  if (!loginPossible() || req.user) return res.redirect(safeNext(req.query.next));
  renderLogin(req, res, 200, '', safeNext(req.query.next));
});

router.post('/login', (req, res) => {
  if (!loginPossible()) return res.redirect('/');
  const next = safeNext(req.body.next);
  if (loginBlocked(req.ip)) return renderLogin(req, res, 429, 'login_throttled', next);
  const user = authenticate(req.body.username, req.body.password);
  if (user) {
    resetLoginFailures(req.ip);
    setSessionCookie(res, req, user);
    return res.redirect(next);
  }
  recordLoginFailure(req.ip);
  renderLogin(req, res, 401, 'login_error', next);
});

// Logging out also ends the provider session; otherwise the next SSO click
// would log straight back in without asking for a password.
router.post('/logout', async (req, res) => {
  clearSessionCookie(res, req);
  const idToken = takeSsoIdToken(req, res);
  if (idToken && oidcEnabled()) {
    try {
      return res.redirect(await logoutUrl(idToken, `${req.protocol}://${req.host}/`));
    } catch (err) {
      console.error('SSO logout failed:', err);
    }
  }
  res.redirect('/');
});

// --- Single sign-on (OIDC) -------------------------------------------------
// Built from the request like the Secure cookie flag, so behind the reverse
// proxy it relies on X-Forwarded-Proto/-Host (trust proxy is on).
function ssoCallbackUrl(req) {
  return `${req.protocol}://${req.host}/auth/callback`;
}

router.get('/auth/login', async (req, res) => {
  if (!oidcEnabled()) return res.redirect('/login');
  const next = safeNext(req.query.next);
  try {
    const { url, flow } = await startLogin(ssoCallbackUrl(req));
    setSsoFlowCookie(res, req, { ...flow, next });
    res.redirect(url);
  } catch (err) {
    console.error('SSO login could not start:', err);
    renderLogin(req, res, 502, 'sso_failed', next);
  }
});

router.get('/auth/callback', async (req, res) => {
  if (!oidcEnabled()) return res.redirect('/login');
  const flow = takeSsoFlow(req, res);
  if (!flow) return renderLogin(req, res, 400, 'sso_failed', '/');
  const next = safeNext(flow.next);
  let result;
  try {
    const { idToken, claims } = await finishLogin(new URL(req.originalUrl, ssoCallbackUrl(req)), flow);
    result = userFromClaims(claims);
    if (result.user) setSsoIdCookie(res, req, idToken);
  } catch (err) {
    console.error('SSO callback failed:', err);
    return renderLogin(req, res, 400, 'sso_failed', next);
  }
  if (result.error) return renderLogin(req, res, 403, result.error, next);
  setSessionCookie(res, req, result.user);
  res.redirect(next);
});

// --- Profile (own account) -------------------------------------------------
router.get('/profile', requireAuth, (req, res) => {
  res.render('profile', {
    title: req.t('profile_title'),
    profileUser: req.user,
    hasPassword: !!req.user.pass_hash,
    saved: req.query.saved === '1',
    error: req.query.error || '',
  });
});

router.post('/profile', requireAuth, (req, res) => {
  updateProfile(req.user.id, { display_name: req.body.display_name, avatar: req.body.avatar });

  // Optional password change: only when a new password was entered.
  const newPass = String(req.body.new_password || '');
  if (newPass) {
    if (!verifyPassword(getUserById(req.user.id), req.body.current_password)) {
      return res.redirect('/profile?error=current');
    }
    if (newPass !== String(req.body.confirm_password || '')) {
      return res.redirect('/profile?error=mismatch');
    }
    const r = changePassword(req.user.id, newPass);
    if (r.error) return res.redirect(`/profile?error=${r.error}`);
    // Password change invalidates the old cookie signature -> refresh it.
    setSessionCookie(res, req, getUserById(req.user.id));
  }
  res.redirect('/profile?saved=1');
});

// --- Settings (appearance + user management) -------------------------------
router.get('/settings', requireAuth, (req, res) => {
  res.render('settings', {
    title: req.t('settings_title'),
    users: listUsers(),
    error: req.query.error || '',
    created: req.query.created || '',
  });
});

router.post('/settings/users', requireAdmin, (req, res) => {
  const r = createUser({
    username: req.body.username,
    password: req.body.password,
    display_name: req.body.display_name,
  });
  if (r.error) return res.redirect(`/settings?error=${encodeURIComponent(r.error)}`);
  res.redirect(`/settings?created=${encodeURIComponent(r.user.username)}`);
});

router.post('/settings/users/:id/delete', requireAdmin, (req, res) => {
  const r = deleteUser(Number(req.params.id));
  if (r.error) return res.redirect(`/settings?error=${encodeURIComponent(r.error)}`);
  // If you deleted your own account, the session is now invalid.
  res.redirect(Number(req.params.id) === req.user.id ? '/' : '/settings');
});

// --- New recipe ------------------------------------------------------------
router.get('/new', requireAuth, (req, res) => {
  res.render('recipe-form', {
    title: req.t('new_recipe'),
    mode: 'create',
    formAction: '/recipe',
    difficulties: DIFFICULTIES,
    recipe: {
      title: '', description: '', image_url: '', servings: 4,
      servings_unit: req.t('default_serving_unit'), prep_time: '', cook_time: '', rest_time: '',
      difficulty: 'Medium', notes: '',
      ingredients: [], steps: [], tags: [],
    },
  });
});

router.post('/recipe', requireAuth, (req, res) => {
  const slug = createRecipe({
    ...normalizeRecipeBody(req.body),
    author_id: req.user.id,
    author_name: req.user.display_name || req.user.username,
  });
  res.redirect(`/recipe/${slug}`);
});

// --- Edit recipe -----------------------------------------------------------
router.get('/recipe/:slug/edit', requireAuth, (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (!recipe) return res.status(404).render('404', { title: req.t('title_not_found') });
  res.render('recipe-form', {
    title: `${req.t('title_edit')} ${recipe.title}`,
    mode: 'edit',
    formAction: `/recipe/${recipe.slug}`,
    difficulties: DIFFICULTIES,
    recipe,
  });
});

router.post('/recipe/:slug', requireAuth, (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (!recipe) return res.status(404).render('404', { title: req.t('title_not_found') });
  const slug = updateRecipe(recipe.id, normalizeRecipeBody(req.body));
  res.redirect(`/recipe/${slug}`);
});

router.post('/recipe/:slug/delete', requireAuth, (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (recipe) deleteRecipe(recipe.id);
  res.redirect('/');
});

// --- Recipe detail page ----------------------------------------------------
router.get('/recipe/:slug', (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (!recipe) return res.status(404).render('404', { title: req.t('title_not_found') });

  const pantry = pantryMap();
  // Compute the initial status on the server (works without JavaScript too);
  // the script recomputes live when the servings change.
  for (const ing of recipe.ingredients) {
    const have = pantry[normalizeName(ing.name)];
    const { status } = pantryStatus({ amount: ing.amount, unit: ing.unit }, have);
    ing.status = status;
  }

  const author = recipe.author_id ? publicUser(getUserById(recipe.author_id)) : null;

  res.render('recipe', {
    title: recipe.title,
    recipe,
    author,
    // safe to embed inside a <script> tag
    pantryJson: JSON.stringify(pantry).replace(/</g, '\\u003c'),
  });
});

// --- Pantry ----------------------------------------------------------------
const EXPIRY_WINDOW_DAYS = 7;

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntil(iso, today) {
  return Math.round((Date.parse(iso) - Date.parse(today)) / 86400000);
}

function addDays(iso, n) {
  return new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
}

const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'UTC' });
const weekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' });
const dayMonth = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

// One column for everything overdue, then today and each day of the window.
function expiryCalendar(expiring, today, t) {
  const cols = [{ kind: 'expired', label: t('cal_expired'), sub: t('cal_before'), items: [] }];
  for (let d = 0; d <= EXPIRY_WINDOW_DAYS; d++) {
    const iso = addDays(today, d);
    const date = new Date(`${iso}T00:00:00Z`);
    cols.push(d === 0
      ? { kind: 'today', label: t('cal_today'), sub: `${weekdayShort.format(date).replace('.', '')} ${dayMonth(iso)}`, items: [] }
      : { kind: 'day', label: weekday.format(date), sub: dayMonth(iso), items: [] });
  }
  for (const e of expiring) cols[e.days < 0 ? 0 : e.days + 1].items.push(e);
  return cols;
}

function expiryOf(iso, today) {
  if (!iso) return null;
  const days = daysUntil(iso, today);
  return days < 0 ? 'expired' : days <= EXPIRY_WINDOW_DAYS ? 'soon' : null;
}

function renderPantry(req, res, extra = {}) {
  const today = todayIso();
  const items = allPantry().map((item) => ({
    ...item,
    expiry: expiryOf(item.best_before, today),
    batches: item.batches.map((b) => ({ ...b, expiry: expiryOf(b.best_before, today) })),
  }));

  // Every dated batch that is expired or due within the window, earliest first.
  const expiring = items
    .flatMap((item) =>
      item.batches
        .filter((b) => b.expiry && (b.amount == null || b.amount > 0))
        .map((b) => ({ name: item.name, unit: item.unit, ...b, days: daysUntil(b.best_before, today) }))
    )
    .sort((a, b) => a.best_before.localeCompare(b.best_before));

  res.render('pantry', {
    title: req.t('pantry_title'),
    items,
    expiring,
    calendar: expiring.length ? expiryCalendar(expiring, today, req.t) : [],
    pantryJson: JSON.stringify(pantryMap()).replace(/</g, '\\u003c'),
    ...extra,
  });
}

router.get('/pantry', (req, res) => renderPantry(req, res));

router.post('/pantry', requireAuth, (req, res) => {
  const result = addPantry({
    name: req.body.name,
    amount: req.body.amount,
    unit: req.body.unit,
    best_before: req.body.best_before,
  });
  if (result?.error === 'unit') {
    return renderPantry(req, res.status(400), {
      pantryError: `${req.t('p_unit_mismatch_1')} ${result.unit || req.t('p_unit_pieces')} ${req.t('p_unit_mismatch_2')}`,
      form: req.body,
    });
  }
  res.redirect('/pantry');
});

router.post('/pantry/batch/:id', requireAuth, (req, res) => {
  editBatch(req.params.id, {
    amount: req.body.amount,
    unit: req.body.unit,
    best_before: req.body.best_before,
  });
  res.redirect('/pantry');
});

router.post('/pantry/batch/:id/delete', requireAuth, (req, res) => {
  deleteBatch(req.params.id);
  res.redirect('/pantry');
});

router.post('/pantry/:id/consume', requireAuth, (req, res) => {
  const result = consumePantryItem(req.params.id, {
    amount: req.body.amount,
    unit: req.body.unit,
    batchId: req.body.batch_id,
  });
  if (result.status === 'incompatible') {
    return renderPantry(req, res.status(400), { pantryError: req.t('consume_unit_mismatch') });
  }
  res.redirect('/pantry');
});

router.post('/pantry/:id/delete', requireAuth, (req, res) => {
  deletePantry(req.params.id);
  res.redirect('/pantry');
});

export default router;
