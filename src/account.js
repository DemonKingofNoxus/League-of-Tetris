/*
 * account.js — sign in / sign up panel, and the leaderboards.
 *
 * All of this is optional decoration around the game: if Supabase is not
 * configured, or is unreachable, the panels say so and the game is unaffected.
 */
(function (LOL) {
  'use strict';

  const Cloud = LOL.Cloud;

  const el = {};
  ['account-body', 'account-msg', 'lb-list', 'lb-you', 'lb-open',
   'lb-modal', 'lb-modal-list', 'lb-modal-close', 'ui-gold', 'ui-gold-total'
  ].forEach(function (id) {
    el[id.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] =
      document.getElementById(id);
  });

  /* Usernames are constrained to [A-Za-z0-9_] in the database, but they still
     arrive as untrusted strings from another player's account, so escape
     rather than trusting the constraint to hold forever. */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(n) { return Number(n || 0).toLocaleString(); }

  function message(text, kind) {
    el.accountMsg.textContent = text || '';
    el.accountMsg.className = 'account-msg' + (kind ? ' ' + kind : '');
  }

  let busy = false;
  function setBusy(on) {
    busy = on;
    Array.prototype.forEach.call(
      el.accountBody.querySelectorAll('button, input'),
      function (node) { node.disabled = on; });
  }

  /* ------------------------------------------------------------------ */
  /* panel rendering                                                     */
  /* ------------------------------------------------------------------ */

  function clearGoldTotal() {
    if (el.uiGoldTotal) el.uiGoldTotal.textContent = '';
  }

  /* Shown after a failure, so the fix is one click away rather than buried in
     a README. */
  function offerDiagnostics() {
    if (document.getElementById('btn-diagnose')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'btn-diagnose';
    button.className = 'ghost';
    button.textContent = 'Check connection';
    button.addEventListener('click', function () {
      message('Checking…');
      Cloud.diagnose().then(function (report) {
        const bad = report.checks.filter(function (c) { return !c.ok; });
        if (!bad.length) {
          message('Everything reachable. Try again.', 'good');
          return;
        }
        message(bad[0].check + ' failed — ' + bad[0].detail +
                '  (full report in the browser console)', 'bad');
      });
    });
    el.accountMsg.parentNode.appendChild(button);
  }

  function renderSignedOut() {
    clearGoldTotal();
    el.accountBody.innerHTML =
      '<form class="auth-form" autocomplete="on">' +
      '  <input id="auth-user" name="username" placeholder="username" ' +
      '         autocomplete="username" maxlength="16" spellcheck="false">' +
      '  <input id="auth-pass" name="password" type="password" placeholder="password" ' +
      '         autocomplete="current-password" maxlength="72">' +
      '  <div class="auth-buttons">' +
      '    <button type="submit" id="btn-signin">Sign in</button>' +
      '    <button type="button" id="btn-signup" class="ghost">Create account</button>' +
      '  </div>' +
      '</form>' +
      '<p class="auth-note">Username and password only — no email, nothing to confirm.</p>';

    const form = el.accountBody.querySelector('.auth-form');
    form.addEventListener('submit', function (e) { e.preventDefault(); doSignIn(); });
    document.getElementById('btn-signup').addEventListener('click', doSignUp);
  }

  function renderSignedIn(p) {
    el.accountBody.innerHTML =
      '<div class="account-in">' +
      '  <div class="who"><b>' + esc(p.username) + '</b><span>signed in</span></div>' +
      '  <dl class="account-stats">' +
      '    <div><dt>Gold</dt><dd class="gold">' + num(p.gold) + '</dd></div>' +
      '    <div><dt>Best</dt><dd>' + num(p.high_score) + '</dd></div>' +
      '    <div><dt>Level</dt><dd>' + num(p.best_level) + '</dd></div>' +
      '    <div><dt>Games</dt><dd>' + num(p.games_played) + '</dd></div>' +
      '  </dl>' +
      '  <button type="button" id="btn-signout" class="ghost">Sign out</button>' +
      '</div>';
    document.getElementById('btn-signout').addEventListener('click', doSignOut);
    /* The big number is this run's gold; the header carries the banked total,
       labelled so the two are not read as the same figure. */
    if (el.uiGoldTotal) el.uiGoldTotal.textContent = num(p.gold) + ' banked';
  }

  function renderOffline() {
    clearGoldTotal();
    el.accountBody.innerHTML =
      '<p class="auth-note offline">Accounts are switched off.<br>' +
      'Fill in <code>src/supabase-config.js</code> and run ' +
      '<code>supabase/schema.sql</code> to enable sign-up, saved gold and the ' +
      'public leaderboard. Until then scores stay in this browser session.</p>';
  }

  function refreshPanel() {
    if (!Cloud.enabled) { renderOffline(); return; }
    if (Cloud.profile) renderSignedIn(Cloud.profile);
    else renderSignedOut();
  }

  /* ------------------------------------------------------------------ */
  /* actions                                                             */
  /* ------------------------------------------------------------------ */

  function credentials() {
    return {
      username: (document.getElementById('auth-user') || {}).value || '',
      password: (document.getElementById('auth-pass') || {}).value || ''
    };
  }

  function handleAuthResult(res, successText) {
    setBusy(false);
    if (!res.ok) {
      message(res.error, 'bad');
      offerDiagnostics();
      return;
    }
    refreshPanel();
    message(successText, 'good');
    refreshLeaderboards();
  }

  function doSignIn() {
    if (busy) return;
    const c = credentials();
    message('Signing in…');
    setBusy(true);
    Cloud.signIn(c.username, c.password).then(function (res) {
      handleAuthResult(res, 'Signed in.');
    });
  }

  function doSignUp() {
    if (busy) return;
    const c = credentials();
    const problem = Cloud.validateUsername(c.username) || Cloud.validatePassword(c.password);
    if (problem) { message(problem, 'bad'); return; }
    message('Creating account…');
    setBusy(true);
    Cloud.signUp(c.username, c.password).then(function (res) {
      handleAuthResult(res, 'Account created. You are signed in.');
    });
  }

  function doSignOut() {
    Cloud.signOut().then(function () {
      refreshPanel();
      message('Signed out. Scores are local again.');
      refreshLeaderboards();
    });
  }

  /* ------------------------------------------------------------------ */
  /* leaderboards                                                        */
  /* ------------------------------------------------------------------ */

  function rowsHtml(entries, highlightName) {
    return entries.map(function (row, i) {
      const mine = highlightName && row.username === highlightName;
      return '<li' + (mine ? ' class="mine"' : '') + '>' +
             '<span class="rank">' + (i + 1) + '</span>' +
             '<span class="who">' + esc(row.username) + '</span>' +
             '<span class="pts">' + num(row.high_score) + '</span>' +
             '</li>';
    }).join('');
  }

  function refreshLeaderboards() {
    if (!Cloud.enabled) {
      el.lbList.innerHTML = '<li class="empty">leaderboard needs an account setup</li>';
      el.lbYou.innerHTML = '';
      return;
    }

    Cloud.leaderboard(10).then(function (res) {
      if (!res.ok || !Array.isArray(res.data)) {
        el.lbList.innerHTML = '<li class="empty">could not load the leaderboard</li>';
        return;
      }
      el.lbList.innerHTML = res.data.length
        ? rowsHtml(res.data, Cloud.username)
        : '<li class="empty">nobody has scored yet</li>';
    });

    if (!Cloud.profile) { el.lbYou.innerHTML = ''; return; }

    Cloud.myRank().then(function (res) {
      if (!res.ok) { el.lbYou.innerHTML = ''; return; }
      el.lbYou.innerHTML =
        '<span class="label">You</span>' +
        '<span class="rank">#' + num(res.data.rank) + '</span>' +
        '<span class="who">' + esc(Cloud.username) + '</span>' +
        '<span class="pts">' + num(res.data.score) + '</span>';
    });
  }

  function openTop100() {
    /* Open even when offline: a button that silently does nothing reads as
       broken. Say why instead. */
    el.lbModal.classList.remove('hidden');
    if (!Cloud.enabled) {
      el.lbModalList.innerHTML =
        '<li class="empty">The leaderboard needs an account backend. ' +
        'See "Accounts and leaderboards" in the README.</li>';
      return;
    }
    el.lbModalList.innerHTML = '<li class="empty">loading…</li>';
    Cloud.leaderboard(100).then(function (res) {
      if (!res.ok || !Array.isArray(res.data)) {
        el.lbModalList.innerHTML = '<li class="empty">could not load the leaderboard</li>';
        return;
      }
      el.lbModalList.innerHTML = res.data.length
        ? rowsHtml(res.data, Cloud.username)
        : '<li class="empty">nobody has scored yet</li>';
    });
  }

  function closeTop100() { el.lbModal.classList.add('hidden'); }

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */

  function init() {
    refreshPanel();
    refreshLeaderboards();

    el.lbOpen.addEventListener('click', openTop100);
    el.lbModalClose.addEventListener('click', closeTop100);
    el.lbModal.addEventListener('click', function (e) {
      if (e.target === el.lbModal) closeTop100();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeTop100();
    });

    if (Cloud.enabled) {
      Cloud.restore().then(function (res) {
        if (res.ok) { refreshPanel(); refreshLeaderboards(); }
      });
    }
  }

  LOL.Account = {
    init: init,
    refreshPanel: refreshPanel,
    refreshLeaderboards: refreshLeaderboards,
    message: message
  };

})(window.LOL);
