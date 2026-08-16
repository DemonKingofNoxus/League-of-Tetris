/*
 * supabase-config.js — fill these in to switch on accounts and leaderboards.
 *
 * Leave them empty and the game still runs exactly as before: high scores stay
 * in memory for the session, gold is tracked for the run only, and the account
 * panel says it is offline. Nothing else changes.
 *
 * Both values below are safe to commit. The anon key is designed to be public
 * — it is the Row Level Security policies in supabase/schema.sql that decide
 * what anyone holding it may actually do.
 *
 * Setup is in README.md under "Accounts and leaderboards".
 */
window.LOL = window.LOL || {};

LOL.SUPABASE = {
  /* Project URL, e.g. 'https://abcdefghijklm.supabase.co' */
  url: '',

  /* Project API key marked "anon" / "public" */
  anonKey: '',

  /*
   * Supabase always wants an email address, but we only ask players for a
   * username. Each username is mapped to "<username>@<emailDomain>", which is
   * never sent anywhere. Keep this on a domain you do not own, so a real
   * mailbox can never collide with a player account.
   */
  emailDomain: 'players.league-of-tetris.invalid'
};
