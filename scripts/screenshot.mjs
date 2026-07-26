/**
 * Logs into the running app and screenshots pages in both themes, so UI changes
 * can be eyeballed without clicking through the app by hand.
 *
 * Usage:  pnpm screenshot [page ...]      (default: dashboard)
 *   pnpm screenshot                       → dashboard, light + dark
 *   pnpm screenshot dashboard tasks       → both pages, both themes
 *
 * Requires the stack to be up (`docker compose up -d`) and GLOO_EMAIL /
 * GLOO_PASSWORD in .env — the same admin credentials you log in with.
 * Output lands in .screenshots/ (gitignored).
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = `${ROOT}.screenshots`;
const BASE_URL = process.env.GLOO_URL ?? 'http://localhost:5173';

const PAGES = { dashboard: '/', tasks: '/tasks' };

/** Read .env without pulling in a dotenv dependency. */
function envFromFile() {
  const vars = {};
  try {
    for (const line of readFileSync(`${ROOT}.env`, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (match) vars[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // No .env: fall through to process.env only.
  }
  return vars;
}

const env = { ...envFromFile(), ...process.env };
const email = env.GLOO_EMAIL;
const password = env.GLOO_PASSWORD;

if (!email || !password) {
  console.error('Missing GLOO_EMAIL / GLOO_PASSWORD (put them in .env, which is gitignored).');
  process.exit(1);
}

const requested = process.argv.slice(2).length ? process.argv.slice(2) : ['dashboard'];
const unknown = requested.filter((name) => !(name in PAGES));
if (unknown.length) {
  console.error(`Unknown page(s): ${unknown.join(', ')}. Known: ${Object.keys(PAGES).join(', ')}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
// The app pins its own strings to pt-BR but never sets an I18nProvider locale, so
// HeroUI's Calendar follows the browser. Match a real user's browser here or the
// month and weekday names come out in English.
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
});
const page = await context.newPage();

// Surface app-side failures instead of silently shooting a broken page.
const problems = [];
page.on('console', (msg) => msg.type() === 'error' && problems.push(msg.text()));
page.on('pageerror', (err) => problems.push(String(err)));

await page.goto(BASE_URL, { waitUntil: 'networkidle' });

if (page.url().includes('/login') || (await page.getByLabel(/e-?mail/i).count())) {
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 15000 });
}

for (const name of requested) {
  await page.goto(`${BASE_URL}${PAGES[name]}`, { waitUntil: 'networkidle' });

  for (const theme of ['light', 'dark']) {
    // The app toggles a `dark` class on <html>; set it directly so we don't
    // depend on the toggle's position in the sidebar.
    await page.evaluate((mode) => {
      document.documentElement.classList.toggle('dark', mode === 'dark');
    }, theme);
    // Let the 200ms surface transition settle before capturing.
    await page.waitForTimeout(400);

    const file = `${OUT_DIR}/${name}-${theme}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`wrote ${file.replace(ROOT, '')}`);
  }
}

await browser.close();

if (problems.length) {
  console.warn(`\n${problems.length} console error(s) during capture:`);
  for (const problem of new Set(problems)) console.warn(`  ${problem}`);
}
