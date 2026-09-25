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
        const id = url.searchParams.get('id')?.replace('eq.', '') || req.postDataJSON()?.id;
        const existing = rows.get(id);
        if (req.method() === 'GET') return send(id ? (existing?.owner_id === owner ? [existing] : []) : [...rows.values()].filter(row => row.owner_id === owner));
        const input = req.postDataJSON();
        if (req.method() === 'POST' && existing) return send({ code: '23505' }, 409);
        if (req.method() === 'PATCH' && url.searchParams.has('revision') && Number(url.searchParams.get('revision').replace('eq.', '')) !== existing?.revision) return send([]);
        rows.set(id, { ...existing, ...input });
        return send(req.headers().accept?.includes('vnd.pgrst.object') ? rows.get(id) : [rows.get(id)]);
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
    // Search is an on-demand toolbar popover, independent of sidebar visibility.
    await page.locator('#name').focus();
    await page.keyboard.press('Meta+Backslash');
    assert.equal(await visible('#sidebar'), false);
    await page.keyboard.press('Meta+Backslash');
    assert.equal(await visible('#sidebar'), true);
    assert.equal(await visible('#person-search-panel'), false);
    assert.equal(await page.locator('#sidebar #person-search-panel').count(), 0);
    await page.keyboard.press('Meta+Backslash');
    await page.locator('#find-person-button').click();
    assert.equal(await visible('#sidebar'), false);
    assert.equal(await page.locator('#person-search').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await visible('#person-search-panel'), false);
    await page.keyboard.press('Meta+Backslash');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#name').fill('Mobile form access');
    const mobileControls = await page.locator('.sidebar-content').boundingBox();
    assert.ok(mobileControls.height > 80, 'Mobile editing controls must remain usable');
    const accountBar = await page.locator('.account-bar').boundingBox();
    assert.ok((await page.locator('#sidebar').boundingBox()).y >= accountBar.y + accountBar.height, 'Mobile account controls must not overlap the sidebar');
    await page.screenshot({ path: '/tmp/family-tree-mobile-ui.png' });
    await page.locator('#find-person-button').click();
    const mobileSearch = await page.locator('#person-search-panel').boundingBox();
    assert.ok(mobileSearch.x >= 0 && mobileSearch.x + mobileSearch.width <= 390);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#name').fill('Alice Relative');
    await page.locator('#person-submit').click();
    await page.waitForFunction(() => document.querySelector('#sync-status').textContent === 'Saved to cloud');
    assert.equal(rows.get(users['alice@example.test'].id).document.people[0].name, 'Alice Relative');
    async function clickMember(name, target = page) {
      const point = await target.evaluate(name => {
        const node = cy.nodes().filter(n => n.data('label') === name);
        const rect = document.querySelector('#cy').getBoundingClientRect();
        return { x: rect.x + node.renderedPosition().x, y: rect.y + node.renderedPosition().y };
      }, name);
      await target.mouse.click(point.x, point.y);
    }
    await page.locator('#pan-mode').click();
    await page.locator('#sidebar-toggle-button').click();
    await page.waitForTimeout(500);
    await clickMember('Alice Relative');
    await page.waitForFunction(() => document.querySelector('#person-submit').textContent === 'Save Changes');
    assert.equal(await visible('#sidebar'), true);
    assert.equal(await page.locator('#name').inputValue(), 'Alice Relative');
    await page.locator('#person-cancel').click();
    await page.locator('#selection-mode').click();
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
    assert.equal(await page.locator('#person-a option:checked').textContent(), 'Father');
    assert.equal(await page.locator('#person-b option:checked').textContent(), 'Daughter');
    await page.getByRole('button', { name: 'Collapse descendants of Father', exact: true }).click();
    await page.waitForFunction(() => cy.nodes(':visible').length === 2);
    assert.equal(await page.evaluate(() => cy.nodes(':visible').length), 2);
    assert.equal(await page.evaluate(() => cy.nodes().filter(n => n.data('label') === 'Father').style('border-style')), 'dashed');
    assert.equal(await page.evaluate(() => cy.nodes().filter(n => n.data('label') === 'Father').style('border-width')), '1px');
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
    await page.locator('#find-person-button').click();
    await page.locator('#person-search').fill('Daughter');
    await page.locator('#search-results button').click();
    await page.waitForFunction(() => cy.nodes(':visible').length === 3);
    assert.equal(await page.evaluate(() => cy.nodes(':visible').length), 3);
    await page.waitForTimeout(500);
    // A selected member must not turn branch controls into highlighted badges.
    const control = page.getByRole('button', { name: 'Collapse descendants of Father', exact: true });
    assert.equal(await control.evaluate(el => getComputedStyle(el).boxShadow), 'none');
    assert.equal(await control.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 250, 241)');
    await page.evaluate(() => highlightNeighborhood(state.people.find(p => p.name === 'Daughter').id));
    await page.waitForFunction(() => Number(document.querySelector(`[data-parent-id="${state.people.find(p => p.name === 'Alice Relative').id}"]`).style.opacity) < 0.2);
    await page.evaluate(() => clearHighlight());
    await page.waitForFunction(() => document.querySelector('#sync-status').textContent === 'Saved to cloud');
    const originalTree = await page.locator('#tree-select').inputValue();
    await page.locator('#new-tree').click();
    await page.locator('#tree-name').fill('Second family');
    await page.locator('#save-tree').click();
    await page.waitForFunction(() => document.querySelector('#tree-select').selectedOptions[0]?.textContent === 'Second family' && !document.querySelector('#workspace').hidden);
    assert.equal(await page.locator('#people-table-body tr').count(), 0);
    assert.equal(await page.locator('#undo-button').isDisabled(), true);
    await page.locator('#name').fill('Second-tree member');
    await page.locator('#person-submit').click();
    await page.locator('#rename-tree').click();
    await page.locator('#tree-name').fill('Named second family');
    await page.locator('#save-tree').click();
    await page.waitForFunction(() => document.querySelector('#tree-select').selectedOptions[0]?.textContent === 'Named second family');
    await page.locator('#tree-select').selectOption(originalTree);
    await page.waitForFunction(() => !document.querySelector('#workspace').hidden && document.querySelector('#people-table-body').textContent.includes('Daughter'));
    assert.equal(await page.locator('#people-table-body tr').count(), 3);
    await page.locator('#find-person-button').click();
    await page.locator('#person-search').fill('Father');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/family-tree-desktop-ui.png' });
    await page.locator('#person-search').fill('');
    await page.keyboard.press('Escape');
    // Generation controls scale in the same ratio as their member icons, including on hover.
    const scaleSizes = [];
    for (const zoom of [0.4, 1.2]) {
      await page.evaluate(zoom => { cy.stop(); cy.zoom(zoom); cy.pan({ x: 300, y: 200 }); }, zoom);
      await page.waitForTimeout(80);
      scaleSizes.push(await page.locator('.generation-toggle').first().evaluate(el => el.getBoundingClientRect().width));
    }
    assert.ok(Math.abs(scaleSizes[1] / scaleSizes[0] - 3) < 0.01);
    assert.ok(scaleSizes[0] < 10, 'Zoomed-out branch controls should be smaller than nodes');
    await page.locator('#zoom-level').click();
    assert.equal(await page.locator('#zoom-level').textContent(), '100%');
    const positionsBeforeZoom = await page.evaluate(() => cy.nodes().map(n => ({ ...n.position() })));
    const worldCenterBefore = await page.evaluate(() => ({ x: (cy.width() / 2 - cy.pan().x) / cy.zoom(), y: (cy.height() / 2 - cy.pan().y) / cy.zoom() }));
    await page.locator('#zoom-in').click();
    assert.equal(await page.locator('#zoom-level').textContent(), '120%');
    const worldCenterAfter = await page.evaluate(() => ({ x: (cy.width() / 2 - cy.pan().x) / cy.zoom(), y: (cy.height() / 2 - cy.pan().y) / cy.zoom() }));
    assert.ok(Math.abs(worldCenterBefore.x - worldCenterAfter.x) < 0.01 && Math.abs(worldCenterBefore.y - worldCenterAfter.y) < 0.01);
    await page.locator('#zoom-out').click();
    assert.equal(await page.locator('#zoom-level').textContent(), '100%');
    // Real browser wheel input must zoom once, under the pointer, in either tool.
    for (const tool of ['selection', 'pan']) {
      await page.locator(`#${tool}-mode`).click();
      for (const modifier of ['', 'Meta', 'Control']) {
        await page.evaluate(() => { cy.stop(true); cy.zoom(1); cy.pan({ x: 100, y: 100 }); });
        const anchor = await page.evaluate(() => {
          const rect = cy.container().getBoundingClientRect();
          // Browser wheel coordinates use integer CSS pixels; account for fractional layout bounds.
          const client = { x: Math.round(rect.left + rect.width * 0.65), y: Math.round(rect.top + rect.height * 0.45) };
          const rendered = { x: (client.x - rect.left) * cy.width() / rect.width, y: (client.y - rect.top) * cy.height() / rect.height };
          return { client, rendered,
            model: { x: (rendered.x - cy.pan().x) / cy.zoom(), y: (rendered.y - cy.pan().y) / cy.zoom() } };
        });
        await page.mouse.move(anchor.client.x, anchor.client.y);
        if (modifier) await page.keyboard.down(modifier);
        await page.mouse.wheel(0, -120);
        await page.waitForFunction(() => cy.zoom() > 1);
        const zoomed = await page.evaluate(anchor => ({ zoom: cy.zoom(), panning: cy.userPanningEnabled(), pageScale: visualViewport.scale,
          model: { x: (anchor.rendered.x - cy.pan().x) / cy.zoom(), y: (anchor.rendered.y - cy.pan().y) / cy.zoom() } }), anchor);
        assert.ok(Math.abs(zoomed.zoom - Math.pow(10, 120 * 0.18 / 250)) < 0.0001, 'Wheel zoom must not run twice');
        assert.ok(Math.abs(zoomed.model.x - anchor.model.x) < 0.01 && Math.abs(zoomed.model.y - anchor.model.y) < 0.01);
        assert.equal(zoomed.panning, tool === 'pan');
        assert.equal(zoomed.pageScale, 1);
        assert.equal(await page.locator('#zoom-level').textContent(), `${Math.round(zoomed.zoom * 100)}%`);
        await page.mouse.wheel(0, 120);
        await page.waitForFunction(() => Math.abs(cy.zoom() - 1) < 0.0001);
        if (modifier) await page.keyboard.up(modifier);
      }
      // Fine trackpad deltas and line/page wheel units share the same normalized path.
      for (const deltaMode of [0, 1, 2]) {
        const result = await page.evaluate(deltaMode => {
          cy.zoom(1);
          const rect = cy.container().getBoundingClientRect();
          const unit = deltaMode === 1 ? 33 : deltaMode === 2 ? rect.height : 1;
          const count = deltaMode === 0 ? 10 : 1;
          let prevented = true;
          for (let i = 0; i < count; i++) {
            prevented = !cy.container().dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true,
              deltaMode, deltaY: -2 / unit, clientX: rect.left + 50, clientY: rect.top + 50 })) && prevented;
          }
          return { prevented, zoom: cy.zoom(), expected: Math.pow(10, 2 * count * 0.18 / 250) };
        }, deltaMode);
        assert.equal(result.prevented, true);
        assert.ok(Math.abs(result.zoom - result.expected) < 0.0001);
      }
    }
    await page.locator('#selection-mode').click();
    assert.equal(await page.evaluate(() => {
      const before = cy.zoom();
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, metaKey: true });
      document.querySelector('#sidebar').dispatchEvent(event);
      return !event.defaultPrevented && cy.zoom() === before;
    }), true, 'Scrolling outside the canvas must remain untouched');
    await page.evaluate(() => { cy.zoom(cy.minZoom()); });
    assert.equal(await page.locator('#zoom-out').isDisabled(), true);
    await page.evaluate(() => { cy.zoom(cy.maxZoom()); });
    assert.equal(await page.locator('#zoom-in').isDisabled(), true);
    await page.locator('#fit-tree').click();
    assert.deepEqual(await page.evaluate(() => cy.nodes().map(n => ({ ...n.position() }))), positionsBeforeZoom);
    // Fullscreen hides all chrome and restores the previous view on Esc.
    for (const fallback of [false, true]) {
      await page.locator('#table-tab').click();
      if (fallback) await page.evaluate(() => {
        window.originalFullscreen = document.documentElement.requestFullscreen;
        document.documentElement.requestFullscreen = () => Promise.reject(new Error('Test unavailable browser API'));
      });
      await page.locator('#fullscreen-button').click();
      await page.waitForTimeout(300);
      if (!fallback) assert.equal(await page.evaluate(() => !!document.fullscreenElement), true, 'Native fullscreen should be entered');
      assert.equal(await page.evaluate(() => document.body.classList.contains('canvas-fullscreen')), true);
      assert.equal(await visible('.account-bar'), false);
      assert.equal(await visible('.canvas-header'), false);
      assert.equal(await visible('#sidebar'), false);
      const full = await page.locator('#cy').boundingBox();
      const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      assert.equal(full.x, 0); assert.equal(full.y, 0);
      assert.equal(full.width, viewport.width); assert.equal(full.height, viewport.height);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.body.classList.contains('canvas-fullscreen'));
      assert.equal(await visible('#table-view'), true);
      assert.equal(await visible('#sidebar'), true);
      if (fallback) await page.evaluate(() => { document.documentElement.requestFullscreen = window.originalFullscreen; });
    }
    // Exercise actual pointer box selection and native group drag, not synthetic graph events.
    await page.locator('#canvas-tab').click();
    await page.locator('#sidebar-toggle-button').click();
    await page.locator('#selection-mode').click();
    await page.waitForTimeout(500); // Existing canvas fit animation must finish before measuring pointer targets.
    // Half-enclosed icons must not be selected: both shapes, both drag directions,
    // changed zoom/pan, and Shift-selection in Pan mode. Labels are not part of the icon.
    for (const zoom of [0.8, 1.4]) {
      await page.evaluate(zoom => {
        clearHighlight();
        cy.nodes().unselect();
        cy.nodes().forEach((node, i) => node.position({ x: 100 + i * 220, y: 160 }));
        cy.zoom(zoom);
        cy.pan({ x: 80, y: 80 });
      }, zoom);
      const icons = await page.evaluate(() => {
        const rect = document.querySelector('#cy').getBoundingClientRect();
        return cy.nodes().map(n => ({ id: n.id(), x: rect.x + n.renderedPosition().x, y: rect.y + n.renderedPosition().y,
          half: n.renderedOuterWidth() / 2 }));
      });
      for (const reverse of [false, true]) {
        await page.locator(reverse ? '#pan-mode' : '#selection-mode').click();
        if (reverse) await page.keyboard.down('Shift');
        for (const icon of icons) {
          const outside = { x: icon.x - icon.half - 10, y: icon.y - icon.half - 10 };
          const partial = { x: icon.x + 3, y: icon.y + icon.half + 10 };
          const start = reverse ? partial : outside, end = reverse ? outside : partial;
          await page.mouse.move(start.x, start.y);
          await page.mouse.down();
          await page.mouse.move(end.x, end.y, { steps: 10 });
          await page.mouse.up();
          assert.equal(await page.evaluate(() => cy.nodes(':selected').length), 0, 'Partial icon must not be selected');
        }
        if (reverse) await page.keyboard.up('Shift');
      }
    }
    await page.locator('#selection-mode').click();
    const geometry = await page.evaluate(() => {
      const rect = document.querySelector('#cy').getBoundingClientRect();
      return { rect: { x: rect.x, y: rect.y }, nodes: cy.nodes().map(n => ({ id: n.id(), rendered: n.renderedPosition(), width: n.renderedWidth(), position: n.position() })) };
    });
    const minX = Math.min(...geometry.nodes.map(n => n.rendered.x - n.width / 2)) - 12;
    const minY = Math.min(...geometry.nodes.map(n => n.rendered.y - n.width / 2)) - 12;
    const maxX = Math.max(...geometry.nodes.map(n => n.rendered.x + n.width / 2)) + 12;
    const maxY = Math.max(...geometry.nodes.map(n => n.rendered.y + n.width / 2)) + 12;
    await page.mouse.move(geometry.rect.x + minX, geometry.rect.y + minY);
    await page.mouse.down();
    await page.mouse.move(geometry.rect.x + maxX, geometry.rect.y + maxY, { steps: 20 });
    await page.mouse.up();
    await page.waitForFunction(() => cy.nodes(':selected').length === 3);
    const lead = geometry.nodes[0].rendered;
    await page.mouse.move(geometry.rect.x + lead.x, geometry.rect.y + lead.y);
    await page.mouse.down();
    await page.mouse.move(geometry.rect.x + lead.x + 55, geometry.rect.y + lead.y + 35, { steps: 15 });
    await page.mouse.up();
    const moved = await page.evaluate(() => cy.nodes().map(n => ({ id: n.id(), position: n.position() })));
    const deltas = moved.map(n => { const old = geometry.nodes.find(p => p.id === n.id).position; return { x: n.position.x - old.x, y: n.position.y - old.y }; });
    assert.ok(deltas[0].x > 1 && deltas[0].y > 1);
    deltas.forEach(delta => { assert.ok(Math.abs(delta.x - deltas[0].x) < 0.01); assert.ok(Math.abs(delta.y - deltas[0].y) < 0.01); });
    // Arrange only the selected members, with one-step undo/redo and saved positions.
    await page.evaluate(() => {
      cy.nodes().unselect();
      cy.nodes().forEach((node, i) => node.position({ x: [50, 170, 500][i], y: [100, 280, 520][i] }));
      cy.nodes().slice(0, 2).select();
    });
    const beforeAlign = await page.evaluate(() => cy.nodes().map(n => ({ id: n.id(), ...n.position() })));
    await page.locator('#arrange-toggle').click();
    assert.equal(await page.locator('[data-arrange="space-x"]').isDisabled(), true);
    await page.locator('[data-arrange="top"]').click();
    const aligned = await page.evaluate(() => cy.nodes().map(n => ({ id: n.id(), ...n.position() })));
    assert.equal(aligned[0].y, aligned[1].y);
    assert.deepEqual(aligned[2], beforeAlign[2]);
    await page.locator('#selection-mode').focus();
    await page.keyboard.press('Meta+z');
    assert.deepEqual(await page.evaluate(() => cy.nodes().map(n => ({ id: n.id(), ...n.position() }))), beforeAlign);
    await page.keyboard.press('Meta+Shift+z');
    assert.deepEqual(await page.evaluate(() => cy.nodes().map(n => ({ id: n.id(), ...n.position() }))), aligned);
    await page.evaluate(() => { cy.nodes().select(); });
    await page.locator('#arrange-toggle').click();
    await page.locator('[data-arrange="space-x"]').click();
    const gaps = await page.evaluate(() => {
      const n = cy.nodes().sort((a, b) => a.position().x - b.position().x);
      return [1, 2].map(i => n[i].position().x - n[i].outerWidth() / 2 - n[i - 1].position().x - n[i - 1].outerWidth() / 2);
    });
    assert.ok(Math.abs(gaps[0] - gaps[1]) < 0.01 && gaps[0] >= 24);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#arrange-toggle').click();
    const mobileArrange = await page.locator('#arrange-menu').boundingBox();
    assert.ok(mobileArrange.x >= 0 && mobileArrange.x + mobileArrange.width <= 390 && mobileArrange.y >= 0 && mobileArrange.y + mobileArrange.height <= 844);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForFunction(() => document.querySelector('#sync-status').textContent === 'Saved to cloud');
    // Export the selected tree, then import it as a separate named tree.
    const downloaded = page.waitForEvent('download');
    await page.locator('#export-data-button').click();
    const download = await downloaded;
    assert.equal(download.suggestedFilename(), 'My Family Tree.familygraph.json');
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks), exported = JSON.parse(buffer.toString());
    const originalDocument = structuredClone(rows.get(originalTree).document);
    assert.equal(exported.data.people.length, 3);
    const originalCount = rows.size;
    await page.locator('#import-data-input').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"people": []}') });
    await page.waitForFunction(() => document.querySelector('#file-status').textContent.includes('Invalid'));
    assert.equal(rows.size, originalCount);
    await page.locator('#import-data-input').setInputFiles({ name: 'invalid-person.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ people: [{ id: 'bad' }], relationships: [] })) });
    await page.waitForFunction(() => document.querySelector('#file-status').textContent.includes('Invalid person'));
    assert.equal(rows.size, originalCount);
    await page.locator('#import-data-input').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer });
    await page.locator('#tree-dialog').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#tree-name').inputValue(), 'My Family Tree');
    await page.locator('#cancel-tree').click();
    assert.equal(rows.size, originalCount);
    await page.locator('#import-data-input').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer });
    await page.locator('#tree-dialog').waitFor({ state: 'visible' });
    await page.locator('#tree-name').fill('Imported backup');
    await page.locator('#save-tree').click();
    await page.waitForFunction(() => !document.querySelector('#workspace').hidden && document.querySelector('#tree-select').selectedOptions[0]?.textContent === 'Imported backup');
    const importedId = await page.locator('#tree-select').inputValue();
    assert.notEqual(importedId, originalTree);
    assert.deepEqual(rows.get(importedId).document.people, exported.data.people);
    assert.deepEqual(rows.get(importedId).document.relationships, exported.data.relationships);
    assert.deepEqual(rows.get(originalTree).document, originalDocument);
    await page.reload();
    await page.locator('#workspace').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#tree-select').inputValue(), importedId);
    await page.locator('#tree-select').selectOption(originalTree);
    await page.waitForFunction(id => !document.querySelector('#workspace').hidden && document.querySelector('#tree-select').value === id, originalTree);
    // Quick relative creation uses one atomic history/save operation in a separate tree.
    await page.locator('#new-tree').click();
    await page.locator('#tree-name').fill('Quick-add test');
    await page.locator('#save-tree').click();
    await page.waitForFunction(() => !document.querySelector('#workspace').hidden && document.querySelector('#tree-select').selectedOptions[0]?.textContent === 'Quick-add test');
    if (!await visible('#sidebar')) await page.locator('#sidebar-toggle-button').click();
    await page.locator('#name').fill('Anchor');
    await page.locator('#person-submit').click();
    const anchorId = await page.evaluate(() => state.people[0].id);
    for (const type of ['parent', 'child', 'spouse']) {
      await page.evaluate(() => { cy.nodes().unselect(); });
      await page.waitForTimeout(500);
      await clickMember('Anchor');
      await page.screenshot({ path: '/tmp/family-tree-quick-add-ui.png' });
      await page.locator(`#member-quick-actions [data-quick-add="${type}"]`).click();
      assert.equal(await page.locator('#person-form-title').textContent(), `Add ${type[0].toUpperCase() + type.slice(1)}`);
      const before = await page.evaluate(() => ({ people: state.people.length, history: undoStack.length, relationships: state.relationships.length }));
      if (type === 'parent') {
        await page.locator('#person-cancel').click();
        assert.equal(await page.evaluate(() => state.people.length), before.people);
        await page.locator('#member-quick-actions [data-quick-add="parent"]').click();
      }
      await page.locator('#name').fill(`Quick ${type}`);
      if (type === 'child') {
        await page.locator('#dob').fill('2020-01-01');
        await page.locator('#dod').fill('2010-01-01');
        await page.locator('#person-submit').click();
        assert.equal(await page.evaluate(() => state.people.length), before.people);
        await page.locator('#dod').fill('');
      }
      await page.locator('#person-submit').click();
      assert.equal(await page.evaluate(() => undoStack.length), before.history + 1);
      assert.equal(await page.evaluate(({ type, anchorId }) => {
        const person = state.people.find(p => p.name === `Quick ${type}`);
        return state.relationships.some(r => r.type === (type === 'spouse' ? 'spouse' : 'parent') && r.from === (type === 'parent' ? person.id : anchorId) && r.to === (type === 'parent' ? anchorId : person.id));
      }, { type, anchorId }), true);
      await page.locator('#undo-button').click();
      assert.equal(await page.evaluate(() => state.people.length), before.people);
      assert.equal(await page.evaluate(() => state.relationships.length), before.relationships);
      await page.locator('#redo-button').click();
      assert.equal(await page.evaluate(() => state.people.length), before.people + 1);
    }
    await page.waitForFunction(() => document.querySelector('#sync-status').textContent === 'Saved to cloud');
    await page.reload();
    await page.locator('#workspace').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#people-table-body tr').count(), 4);
    // Table editor has the same quick actions and reveals folded ancestors on save.
    await page.getByRole('button', { name: 'Collapse descendants of Quick parent', exact: true }).click();
    await page.locator('#table-tab').click();
    await page.getByRole('button', { name: 'Edit Anchor', exact: true }).click();
    await page.locator('#editor-relative-actions [data-quick-add="child"]').click();
    await page.locator('#name').fill('Visible child');
    await page.locator('#person-submit').click();
    await page.locator('#canvas-tab').click();
    await page.waitForFunction(() => cy.nodes(':visible').length === 5);
    assert.equal(await page.evaluate(() => state.people.find(p => p.name === 'Quick parent').descendantsCollapsed), false);
    await page.locator('#tree-select').selectOption(originalTree);
    await page.waitForFunction(id => !document.querySelector('#workspace').hidden && document.querySelector('#tree-select').value === id, originalTree);
    await page.locator('#canvas-tab').click();
    // Search is also accessible in the dedicated canvas-only tab.
    const canvasPage = await context.newPage();
    await canvasPage.goto(`http://127.0.0.1:${server.address().port}/?view=canvas`);
    await canvasPage.locator('#workspace').waitFor({ state: 'visible' });
    await canvasPage.locator('#find-person-button').click();
    await canvasPage.locator('#person-search').fill('Daughter');
    await canvasPage.locator('#search-results button').click();
    assert.equal(await canvasPage.locator('#person-search-panel').isVisible(), false);
    await canvasPage.locator('#find-person-button').click();
    await canvasPage.keyboard.press('Escape');
    assert.equal(await canvasPage.locator('#person-search-panel').isVisible(), false);
    await canvasPage.locator('#pan-mode').click();
    await canvasPage.locator('#fullscreen-button').click();
    await canvasPage.waitForTimeout(500);
    await clickMember('Father', canvasPage);
    await canvasPage.waitForFunction(() => document.querySelector('#person-submit').textContent === 'Save Changes');
    assert.equal(await canvasPage.locator('#sidebar').isVisible(), true);
    assert.equal(await canvasPage.locator('#name').inputValue(), 'Father');
    assert.equal(await canvasPage.evaluate(() => document.body.classList.contains('canvas-fullscreen')), false);
    await canvasPage.close();
    missingTable = true;
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#auth-message').textContent.includes('needs setup'));
    assert.equal(await visible('#workspace'), false);
    assert.equal(rows.get(users['alice@example.test'].id).document.people.length, 3);
    assert.deepEqual(errors, []);
    console.log('PASS: scaled generation controls, zoom/fit, selection alignment/spacing with undo, atomic quick parent/child/spouse creation, plus all previous browser regressions');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
