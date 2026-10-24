// Optional single sign-on through an OpenID Connect provider (e.g. Keycloak),
// authorization code flow with PKCE. Off unless OIDC_ISSUER is set. Accounts are
// bound by the provider's `sub`; the first login links the local account with
// the same username, or creates one (unless OIDC_AUTO_CREATE=false).

import * as client from 'openid-client';
import {
  getUserById,
  getUserByUsername,
  getUserBySub,
  linkSub,
  createSsoUser,
  setAdmin,
} from '../models/users.js';

const ISSUER = process.env.OIDC_ISSUER || '';

export function oidcEnabled() {
  return !!ISSUER;
}

// Discovery is cached; a failed attempt is dropped so the next login retries
// instead of staying broken until a restart (e.g. Keycloak started later).
let configPromise = null;
function config() {
  if (!configPromise) {
    const options = ISSUER.startsWith('http://') ? { execute: [client.allowInsecureRequests] } : undefined;
    configPromise = client
      .discovery(new URL(ISSUER), process.env.OIDC_CLIENT_ID || '', process.env.OIDC_CLIENT_SECRET || '', undefined, options)
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

// Returns the provider URL to send the browser to, plus the checks the
// callback has to verify.
export async function startLogin(redirectUri) {
  const cfg = await config();
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const url = client.buildAuthorizationUrl(cfg, {
    redirect_uri: redirectUri,
    scope: 'openid profile',
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    nonce,
  });
  return { url: url.href, flow: { state, nonce, verifier } };
}

// Exchanges the code from the callback URL; returns the ID token and its
// verified claims.
export async function finishLogin(currentUrl, flow) {
  const cfg = await config();
  const tokens = await client.authorizationCodeGrant(cfg, currentUrl, {
    pkceCodeVerifier: flow.verifier,
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    idTokenExpected: true,
  });
  return { idToken: tokens.id_token, claims: tokens.claims() };
}

export async function logoutUrl(idToken, postLogoutRedirectUri) {
  const cfg = await config();
  return client.buildEndSessionUrl(cfg, {
    id_token_hint: idToken,
    post_logout_redirect_uri: postLogoutRedirectUri,
  }).href;
}

// Maps verified claims to a local account: { user } or { error: <i18n key> }.
export function userFromClaims(claims) {
  let user = getUserBySub(claims.sub);
  if (!user) {
    const username = String(claims.preferred_username || '');
    const existing = getUserByUsername(username);
    if (existing) {
      if (existing.oidc_sub) return { error: 'sso_conflict' };
      linkSub(existing.id, claims.sub);
    } else {
      if (process.env.OIDC_AUTO_CREATE === 'false') return { error: 'sso_no_account' };
      const r = createSsoUser({ username, display_name: claims.name, sub: claims.sub });
      if (r.error) return { error: 'sso_bad_username' };
    }
    user = getUserBySub(claims.sub);
  }

  // With OIDC_ADMIN_GROUP set, the provider decides admin rights on every login.
  const adminGroup = process.env.OIDC_ADMIN_GROUP;
  if (adminGroup) {
    const groups = Array.isArray(claims.groups) ? claims.groups : [];
    const admin = groups.some((g) => g === adminGroup || g === `/${adminGroup}`);
    if (!!user.is_admin !== admin) {
      setAdmin(user.id, admin);
      user = getUserById(user.id);
    }
  }
  return { user };
}
