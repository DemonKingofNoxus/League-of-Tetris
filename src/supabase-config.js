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
  url: 'https://cjbhgrvgvntuolslizbp.supabase.co/',

  /* Project API key marked "anon" / "public" */
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqYmhncnZndm50dW9sc2xpemJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4OTI0MjAsImV4cCI6MjEwMjQ2ODQyMH0.EEBcGNFs83Q3nxWAVbuPZXV7HCwElJNokLr0ljtzB_k',

  /*
   * Supabase always wants an email address, but we only ask players for a
   * username. Each username is mapped to "<username>@<emailDomain>". No mail
   * is ever sent to it.
   *
   * It must be a domain with a REAL public suffix. Supabase Auth validates the
   * address and rejects the reserved test TLDs — .invalid, .test, .example,
   * .local, .localhost — with "Email address ... is invalid". Those look like
   * the obvious choice for a fake address and are exactly the ones that fail.
   *
   * A domain you already own is the right answer: it can never collide with a
   * stranger's real mailbox, and it needs no mail server, because nothing is
   * ever delivered to it. This is the site's own Vercel domain.
   *
   * Changing this later orphans every existing account — the addresses are
   * what identify them — so settle on it before real players sign up.
   */
  emailDomain: 'league-of-tetris-one.vercel.app'
};
