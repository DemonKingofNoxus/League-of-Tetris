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

  /*
   * Normalise the project URL before anything uses it.
   *
   * A URL entered without a scheme ("abc.supabase.co") is not an absolute URL,
   * so fetch resolves it against the page instead — every call then goes to
   * your own host and comes back 404, with nothing at all appearing in the
   * Supabase logs. That failure is very hard to read from the outside, so fix
   * it here and say so loudly.
   */
  function normaliseUrl(raw) {
    let url = String(raw || '').trim().replace(/\/+$/, '');
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) {
      console.warn('[cloud] Supabase url "' + url + '" has no https:// — assuming https://' + url);
      url = 'https://' + url;
    }
    return url;
  }

  const BASE = normaliseUrl(CFG.url);

  function configProblem() {
    if (!CFG.url) return 'No Supabase url set in src/supabase-config.js.';
    if (!CFG.anonKey) return 'No anonKey set in src/supabase-config.js.';
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(BASE)) {
      /* Not fatal — self-hosted projects live anywhere — but the usual cause
         is a pasted dashboard page URL rather than the project URL. */
      console.warn('[cloud] "' + BASE + '" does not look like a Supabase project url. ' +
                   'Expected something like https://abcdefgh.supabase.co');
    }
    if (/^ey/.test(CFG.anonKey) === false && CFG.anonKey.indexOf('sb_') !== 0) {
      console.warn('[cloud] anonKey does not look like a Supabase key.');
    }
    const domainProblem = emailDomainProblem();
    if (domainProblem) console.warn('[cloud] ' + domainProblem);
    return null;
  }

  /*
   * Supabase Auth validates the address it is given, and rejects the reserved
   * test TLDs from RFC 2606 and RFC 6761. They are the intuitive pick for a
   * synthetic address and the ones that always fail, so catch it here instead
   * of letting every signup die with a confusing message about email.
   */
  const RESERVED_TLDS = ['invalid', 'test', 'example', 'localhost', 'local'];

  function emailDomainProblem() {
    const domain = String(CFG.emailDomain || '').trim().toLowerCase();
    if (!domain) return 'No emailDomain set in src/supabase-config.js.';
    if (domain.indexOf('.') === -1) {
      return 'emailDomain "' + domain + '" has no dot; Supabase will reject it.';
    }
    const tld = domain.split('.').pop();
    if (RESERVED_TLDS.indexOf(tld) !== -1) {
      return 'emailDomain "' + domain + '" ends in the reserved TLD ".' + tld +
             '". Supabase Auth rejects these — use a domain you own, such as ' +
             'the one this game is hosted on.';
    }
    return null;
  }

  const enabled = !!(CFG.url && CFG.anonKey);
  if (enabled) configProblem();

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

    const target = BASE + path;
    return fetch(target, {
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
          let message = (data && (data.msg || data.message || data.error_description ||
                                  data.error || data.hint)) || ('HTTP ' + res.status);
          /* A bare status code is useless for diagnosis. Name the endpoint,
             and translate the two 404s that actually happen. */
          if (res.status === 404) {
            if (path.indexOf('/rest/v1/') === 0) {
              message = 'Not found: ' + path.split('?')[0] +
                        '. The table, view or function is missing — run ' +
                        'supabase/schema.sql, then NOTIFY pgrst, \'reload schema\';';
            } else {
              message = 'Not found: ' + target + '. Check the url in supabase-config.js.';
            }
          }
          return { ok: false, error: String(message), status: res.status, url: target };
        }
        return { ok: true, data: data, count: count };
      });
    }).catch(function (err) {
      clearTimeout(timer);
      return {
        ok: false,
        url: target,
        error: err.name === 'AbortError'
          ? 'The server took too long to answer (' + target + ').'
          : 'Could not reach ' + target + '. Check the url, and that the ' +
            'browser is not blocking the request.'
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
        /* Supabase reports both of these in the language of emails, which
           would be baffling to someone who only typed a username. */
        if (/already registered|already exists|duplicate/i.test(res.error)) {
          return { ok: false, error: 'That username is taken.' };
        }
        if (/email address.*invalid|invalid.*email/i.test(res.error)) {
          return {
            ok: false,
            error: 'Supabase rejected the generated address (' +
                   usernameToEmail(username) + '). Change emailDomain in ' +
                   'src/supabase-config.js to a domain with a real public ' +
                   'suffix — reserved TLDs like .invalid are refused.'
          };
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

  /*
   * Check every piece the game depends on, and say which one is broken.
   * Run it from the browser console:  await LOL.Cloud.diagnose()
   */
  function diagnose() {
    const report = { url: BASE, configured: enabled, checks: [] };

    function note(name, ok, detail) {
      report.checks.push({ check: name, ok: ok, detail: detail || '' });
    }

    if (!enabled) {
      note('config', false, configProblem());
      console.table(report.checks);
      return Promise.resolve(report);
    }
    note('config', true, BASE);
    const domainProblem = emailDomainProblem();
    note('email domain', !domainProblem, domainProblem || CFG.emailDomain);

    return request('/auth/v1/health', { auth: false }).then(function (res) {
      note('auth service reachable', res.ok, res.ok ? '' : res.error);
      return request('/rest/v1/profiles?select=id&limit=1');
    }).then(function (res) {
      note('profiles table', res.ok, res.ok ? '' : res.error);
      return request('/rest/v1/leaderboard?select=username&limit=1');
    }).then(function (res) {
      note('leaderboard view', res.ok, res.ok ? '' : res.error);
      /* Called with no arguments on purpose: a missing function answers 404,
         while a present one answers 400 or 401. But a network failure has no
         status at all, and must not be read as "installed". */
      return request('/rest/v1/rpc/submit_run', { method: 'POST', body: {} });
    }).then(function (res) {
      const reached = res.ok || typeof res.status === 'number';
      const installed = reached && (res.ok || res.status !== 404);
      note('submit_run function', installed,
           !reached ? res.error : (installed ? '' : 'missing — run supabase/schema.sql'));
      report.ok = report.checks.every(function (c) { return c.ok; });
      console.table(report.checks);
      if (!report.ok) {
        console.warn('[cloud] see the failing rows above; README -> ' +
                     '"Accounts and leaderboards" has the fixes.');
      }
      return report;
    });
  }

  LOL.Cloud = {
    enabled: enabled,
    baseUrl: BASE,
    diagnose: diagnose,
    get session() { return session; },
    get profile() { return profile; },
    get username() { return profile && profile.username; },
    validateUsername: validateUsername,
    validatePassword: validatePassword,
    emailDomainProblem: emailDomainProblem,
    usernameToEmail: usernameToEmail,
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
