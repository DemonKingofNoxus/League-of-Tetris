/*
 * cloud.js — accounts, gold and leaderboards, over Supabase's REST API.
 *
 * Talks to Supabase with plain fetch rather than the supabase-js SDK, so the
 * game keeps its "no build step, no dependencies, works offline" property. The
 * endpoints used are stable public HTTP APIs:
 *
 *   POST {url}/auth/v1/signup
 *   POST {url}/auth/v1/token?grant_type=password
 *   POST {url}/auth/v1/token?grant_type=refresh_token
 *   POST {url}/rest/v1/rpc/submit_run
 *   GET  {url}/rest/v1/leaderboard
 *
 * Every call resolves to { ok: true, data } or { ok: false, error } — nothing
 * here throws into the game loop, and nothing here blocks play. If Supabase is
 * unreachable or unconfigured the game carries on locally.
 */
(function (LOL) {
  'use strict';

  const CFG = LOL.SUPABASE || {};
  const STORAGE_KEY = 'lot.session';
  const TIMEOUT_MS = 12000;

  const enabled = !!(CFG.url && CFG.anonKey);

  let session = null;   // { access_token, refresh_token, expires_at, user }
  let profile = null;   // { id, username, gold, high_score, ... }

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  function usernameToEmail(username) {
    return String(username).trim().toLowerCase() + '@' +
           (CFG.emailDomain || 'players.invalid');
  }

  /* Kept strict so a username always makes a valid email local-part, and so
     the leaderboard cannot be used to render surprising strings. */
  function validateUsername(username) {
    const name = String(username || '').trim();
    if (name.length < 3) return 'Username needs at least 3 characters.';
    if (name.length > 16) return 'Username can be at most 16 characters.';
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      return 'Use letters, numbers and underscore only.';
    }
    return null;
  }

  function validatePassword(password) {
    if (String(password || '').length < 6) {
      return 'Password needs at least 6 characters.';
    }
    return null;
  }

  function saveSession(s) {
    session = s;
    try {
      if (s) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* Private browsing can refuse storage; staying signed in for this tab
         only is an acceptable downgrade. */
    }
  }

  function loadSession() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function request(path, options) {
    options = options || {};
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

    const headers = {
      'apikey': CFG.anonKey,
      'Content-Type': 'application/json'
    };
    if (options.auth !== false && session && session.access_token) {
      headers.Authorization = 'Bearer ' + session.access_token;
    } else {
      headers.Authorization = 'Bearer ' + CFG.anonKey;
    }
    Object.keys(options.headers || {}).forEach(function (k) {
      headers[k] = options.headers[k];
    });

    return fetch(CFG.url.replace(/\/$/, '') + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    }).then(function (res) {
      clearTimeout(timer);
      const count = res.headers.get('content-range');
      return res.text().then(function (text) {
        let data = null;
        if (text) { try { data = JSON.parse(text); } catch (err) { data = text; } }
        if (!res.ok) {
          const message = (data && (data.msg || data.message || data.error_description ||
                                    data.error || data.hint)) || ('HTTP ' + res.status);
          return { ok: false, error: String(message), status: res.status };
        }
        return { ok: true, data: data, count: count };
      });
    }).catch(function (err) {
      clearTimeout(timer);
      return {
        ok: false,
        error: err.name === 'AbortError' ? 'The server took too long to answer.'
                                         : 'Could not reach the server.'
      };
    });
  }

  /* Supabase access tokens are short-lived; swap the refresh token for a new
     pair when the old one is close to expiry. */
  function ensureFreshSession() {
    if (!session || !session.refresh_token) return Promise.resolve(false);
    const expiresAt = session.expires_at || 0;
    if (Date.now() / 1000 < expiresAt - 60) return Promise.resolve(true);

    return request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      auth: false,
      body: { refresh_token: session.refresh_token }
    }).then(function (res) {
      if (!res.ok) { saveSession(null); return false; }
      storeAuthResponse(res.data);
      return true;
    });
  }

  function storeAuthResponse(data) {
    if (!data || !data.access_token) return;
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ||
                  Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: data.user || null
    });
  }

  /* ------------------------------------------------------------------ */
  /* auth                                                                */
  /* ------------------------------------------------------------------ */

  function signUp(username, password) {
    if (!enabled) return Promise.resolve({ ok: false, error: 'Accounts are not configured.' });

    const nameError = validateUsername(username) || validatePassword(password);
    if (nameError) return Promise.resolve({ ok: false, error: nameError });

    return request('/auth/v1/signup', {
      method: 'POST',
      auth: false,
      body: {
        email: usernameToEmail(username),
        password: password,
        data: { username: String(username).trim() }
      }
    }).then(function (res) {
      if (!res.ok) {
        /* Supabase reports a taken address in the language of emails, which
           would be baffling to someone who only typed a username. */
        if (/already registered|already exists|duplicate/i.test(res.error)) {
          return { ok: false, error: 'That username is taken.' };
        }
        return res;
      }
      /* With email confirmation switched off the signup response already
         carries a session. If it does not, sign in explicitly. */
      if (res.data && res.data.access_token) {
        storeAuthResponse(res.data);
        return loadProfile();
      }
      return signIn(username, password);
    });
  }

  function signIn(username, password) {
    if (!enabled) return Promise.resolve({ ok: false, error: 'Accounts are not configured.' });

    return request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      auth: false,
      body: { email: usernameToEmail(username), password: password }
    }).then(function (res) {
      if (!res.ok) {
        if (/invalid login|invalid grant|credentials/i.test(res.error)) {
          return { ok: false, error: 'Wrong username or password.' };
        }
        if (/not confirmed/i.test(res.error)) {
          return { ok: false, error: 'Email confirmation is still switched on in Supabase.' };
        }
        return res;
      }
      storeAuthResponse(res.data);
      return loadProfile();
    });
  }

  function signOut() {
    saveSession(null);
    profile = null;
    return Promise.resolve({ ok: true });
  }

  /* Restore a stored session on page load, if there is one. */
  function restore() {
    if (!enabled) return Promise.resolve({ ok: false, error: 'not configured' });
    session = loadSession();
    if (!session) return Promise.resolve({ ok: false, error: 'no session' });
    return ensureFreshSession().then(function (alive) {
      if (!alive) return { ok: false, error: 'session expired' };
      return loadProfile();
    });
  }

  /* ------------------------------------------------------------------ */
  /* profile, runs, leaderboard                                          */
  /* ------------------------------------------------------------------ */

  function loadProfile() {
    return ensureFreshSession().then(function () {
      return request('/rest/v1/profiles?select=*&limit=1');
    }).then(function (res) {
      /* RLS narrows this to the caller's own row. */
      if (res.ok && Array.isArray(res.data) && res.data.length) {
        profile = res.data[0];
        return { ok: true, data: profile };
      }
      if (res.ok) return { ok: false, error: 'Profile not found. Is the schema installed?' };
      return res;
    });
  }

  /*
   * Submit a finished run. The database function takes the maximum of the old
   * and new high score and adds the gold, so a weaker run can never lower a
   * record and the client never writes those columns directly.
   */
  function submitRun(run) {
    if (!enabled || !session) {
      return Promise.resolve({ ok: false, error: 'not signed in' });
    }
    return ensureFreshSession().then(function (alive) {
      if (!alive) return { ok: false, error: 'session expired' };
      return request('/rest/v1/rpc/submit_run', {
        method: 'POST',
        body: {
          p_score: run.score | 0,
          p_level: run.level | 0,
          p_rows: run.rows | 0,
          p_pure_rows: run.pure | 0,
          p_gold: run.gold | 0
        }
      });
    }).then(function (res) {
      if (res.ok && res.data) profile = Array.isArray(res.data) ? res.data[0] : res.data;
      return res.ok ? { ok: true, data: profile } : res;
    });
  }

  function leaderboard(limit) {
    if (!enabled) return Promise.resolve({ ok: false, error: 'not configured' });
    const n = Math.max(1, Math.min(100, limit || 100));
    return request('/rest/v1/leaderboard?select=username,high_score,best_level,gold' +
                   '&order=high_score.desc&limit=' + n);
  }

  /* Rank is "how many players scored strictly more than me, plus one". Asked
     for as a HEAD-style count so the rows themselves are never transferred. */
  function myRank() {
    if (!enabled || !profile) return Promise.resolve({ ok: false, error: 'not signed in' });
    const score = profile.high_score | 0;
    return request('/rest/v1/leaderboard?select=username&high_score=gt.' + score, {
      headers: { 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }
    }).then(function (res) {
      if (!res.ok) return res;
      const total = res.count ? Number(String(res.count).split('/')[1]) : NaN;
      if (isNaN(total)) return { ok: false, error: 'no count returned' };
      return { ok: true, data: { rank: total + 1, score: score } };
    });
  }

  LOL.Cloud = {
    enabled: enabled,
    get session() { return session; },
    get profile() { return profile; },
    get username() { return profile && profile.username; },
    validateUsername: validateUsername,
    validatePassword: validatePassword,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    restore: restore,
    loadProfile: loadProfile,
    submitRun: submitRun,
    leaderboard: leaderboard,
    myRank: myRank
  };

})(window.LOL);
