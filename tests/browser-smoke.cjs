// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package if not local.
// All Supabase requests are mocked; no real account or family data is created.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const rows = new Map(), tokens = new Map();
    const users = {
      'alice@example.test': { id: '11111111-1111-4111-8111-111111111111', email: 'alice@example.test', aud: 'authenticated', role: 'authenticated' },
      'bob@example.test': { id: '22222222-2222-4222-8222-222222222222', email: 'bob@example.test', aud: 'authenticated', role: 'authenticated' }
    };
    let missingTable = false;
    await context.route('https://wmfplutvrinleialgmyz.supabase.co/**', async route => {
      const req = route.request(), url = new URL(req.url());
      const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname.endsWith('/token')) {
        const user = users[req.postDataJSON().email];
        if (!user) return send({ msg: 'Invalid login credentials' }, 400);
        const expiry = Math.floor(Date.now() / 1000) + 3600;
        const token = [Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: expiry })).toString('base64url'), 'mock'].join('.');
        tokens.set(token, user);
        return send({ access_token: token, refresh_token: 'mock-refresh', expires_in: 3600, token_type: 'bearer', user });
      }
      const user = tokens.get(req.headers().authorization?.replace('Bearer ', ''));
      if (url.pathname.endsWith('/user')) return send(user || {}, user ? 200 : 401);
      if (url.pathname.endsWith('/logout')) return send({});
      if (url.pathname.includes('/rest/v1/family_tree_documents')) {
        if (missingTable) return send({ code: 'PGRST205', message: 'Missing table' }, 404);
        if (!user) return send({ message: 'Not authenticated' }, 401);
        const owner = url.searchParams.get('owner_id')?.replace('eq.', '') || req.postDataJSON()?.owner_id;
        if (owner !== user.id) return send({ message: 'Forbidden' }, 403);
        const existing = rows.get(owner);
        if (req.method() === 'GET') return send(existing ? [existing] : []);
        const input = req.postDataJSON();
        if (req.method() === 'POST' && existing) return send({ code: '23505' }, 409);
        if (req.method() === 'PATCH' && Number(url.searchParams.get('revision')?.replace('eq.', '')) !== existing?.revision) return send([]);
        rows.set(owner, { ...existing, ...input });
        return send([{ revision: input.revision }]);
      }
      return send({ message: 'Unexpected mocked API path: ' + url.pathname }, 400);
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const visible = selector => page.locator(selector).isVisible();
    async function login(email) {
      await page.locator('#auth-email').fill(email);
      await page.locator('#auth-password').fill('test-password-only');
      await page.locator('#sign-in').click();
      await page.locator('#workspace').waitFor({ state: 'visible' });
    }
    await login('alice@example.test');
    assert.equal(await visible('#undo-toast'), false);
    assert.equal(await visible('#empty-canvas'), true);
    await page.locator('#name').fill('Alice Relative');
    await page.locator('#person-submit').click();
    await page.waitForFunction(() => document.querySelector('#sync-status').textContent === 'Saved to cloud');
    assert.equal(rows.get(users['alice@example.test'].id).document.people[0].name, 'Alice Relative');
    await page.locator('#table-tab').click();
    await page.locator('#sidebar-toggle-button').click();
    await page.getByRole('button', { name: 'Edit Alice Relative', exact: true }).click();
    assert.equal(await visible('#sidebar'), true);
    assert.equal(await page.locator('#name').inputValue(), 'Alice Relative');
    assert.equal(await page.locator('#name').evaluate(el => el === document.activeElement), true);
    assert.equal(await visible('#undo-toast'), false);
    await page.getByRole('button', { name: 'Delete Alice Relative', exact: true }).click();
    await page.locator('#confirm-delete-person').click();
    assert.equal(await visible('#undo-toast'), true);
    await page.locator('#toast-undo-button').click();
    assert.equal(await visible('#undo-toast'), false);
    await page.locator('#sign-out').click();
    await page.locator('#auth-form').waitFor({ state: 'visible' });
    await login('bob@example.test');
    assert.equal(await page.locator('#people-table-body tr').count(), 0);
    assert.equal(await page.locator('#recycle-count').textContent(), '');
    assert.equal(await page.locator('#undo-button').isDisabled(), true);
    await page.locator('#sign-out').click();
    await page.locator('#auth-form').waitFor({ state: 'visible' });
    await login('alice@example.test');
    assert.equal(await page.locator('#people-table-body tr').count(), 1);
    await page.reload();
    await page.locator('#workspace').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#people-table-body tr').count(), 1);
    // New nodes must not stack at (0, 0); details and generation visibility survive reload.
    await page.locator('#name').fill('Father');
    await page.locator('#deceased').check();
    await page.locator('#person-notes').fill('Teacher; born in Chennai');
    await page.locator('#person-submit').click();
    await page.locator('#name').fill('Daughter');
    await page.locator('#gender').selectOption('female');
    await page.locator('#person-submit').click();
    assert.equal(await page.evaluate(() => {
      const nodes = cy.nodes();
      return nodes.every((a, i) => nodes.every((b, j) => i === j || Math.hypot(a.position().x - b.position().x, a.position().y - b.position().y) >= 99));
    }), true);
    await page.locator('#person-a').selectOption({ label: 'Alice Relative' });
    await page.locator('#person-b').selectOption({ label: 'Father' });
    await page.locator('#relationship-form button[type=submit]').click();
    await page.locator('#person-a').selectOption({ label: 'Father' });
    await page.locator('#person-b').selectOption({ label: 'Daughter' });
    await page.locator('#relationship-form button[type=submit]').click();
    await page.getByRole('button', { name: 'Collapse descendants of Father', exact: true }).click();
    await page.waitForFunction(() => cy.nodes(':visible').length === 2);
    assert.equal(await page.evaluate(() => cy.nodes(':visible').length), 2);
    assert.equal(await page.evaluate(() => cy.nodes().filter(n => n.data('label') === 'Father †').style('border-style')), 'dashed');
    assert.equal(await page.evaluate(() => cy.nodes().filter(n => n.data('gender') === 'female').style('shape')), 'ellipse');
    await page.waitForFunction(() => document.querySelector('#sync-status').textContent === 'Saved to cloud');
    await page.reload();
    await page.locator('#workspace').waitFor({ state: 'visible' });
    await page.waitForFunction(() => cy.nodes(':visible').length === 2);
    assert.equal(await page.evaluate(() => cy.nodes(':visible').length), 2);
    await page.locator('#table-tab').click();
    await page.getByRole('button', { name: 'Edit Father', exact: true }).click();
    assert.equal(await page.locator('#person-notes').inputValue(), 'Teacher; born in Chennai');
    assert.equal(await page.locator('#deceased').isChecked(), true);
    await page.locator('#person-search').fill('Daughter');
    await page.locator('#search-results button').click();
    await page.waitForFunction(() => cy.nodes(':visible').length === 3);
    assert.equal(await page.evaluate(() => cy.nodes(':visible').length), 3);
    await page.waitForFunction(() => document.querySelector('#sync-status').textContent === 'Saved to cloud');
    missingTable = true;
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#auth-message').textContent.includes('needs setup'));
    assert.equal(await visible('#workspace'), false);
    assert.equal(rows.get(users['alice@example.test'].id).document.people.length, 3);
    assert.deepEqual(errors, []);
    console.log('PASS: auth, cloud save/reload, account isolation, missing-table gate, Undo/sidebar fixes, node spacing, deceased/gender styling, notes, branch collapse persistence, and search expansion');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
