const { test } = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../cloud-store.js');
const empty = () => ({ people: [], relationships: [], recycleBin: [] });
const documentFor = (name) => ({ ...empty(), people: [{ id: 'p1', name }] });
function storage() {
  const map = new Map();
  return { getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
}
function server() {
  const rows = new Map();
  let failure = null;
  return {
    rows, fail(error) { failure = error; },
    client: {
      from(table) {
        assert.equal(table, 'family_tree_documents');
        let mode = 'read', value, filters = {};
        const query = {
          select() { return query; },
          eq(key, val) { filters[key] = val; return query; },
          insert(row) { mode = 'insert'; value = row; return query; },
          update(row) { mode = 'update'; value = row; return query; },
          async maybeSingle() {
            if (failure) return { data: null, error: failure };
            const owner = filters.owner_id || value?.owner_id;
            const id = filters.id || value?.id || owner;
            const existing = rows.get(id);
            if (existing?.owner_id && existing.owner_id !== owner) return { data: null, error: new Error('Forbidden') };
            if (mode === 'read') return { data: structuredClone(existing || null), error: null };
            if (mode === 'insert' && existing) return { data: null, error: { code: '23505' } };
            if (mode === 'update' && (!existing || existing.revision !== filters.revision)) return { data: null, error: null };
            rows.set(id, structuredClone({ ...existing, ...value }));
            return { data: { revision: value.revision }, error: null };
          }
        };
        return query;
      }
    }
  };
}

test('new accounts start empty, saves and recycle bins remain account scoped', async () => {
  const backend = server(), drafts = storage();
  const a = new Store(backend.client, 'user-a', drafts);
  const b = new Store(backend.client, 'user-b', drafts);
  assert.deepEqual(await a.load(), empty());
  assert.deepEqual(await b.load(), empty());
  const tree = documentFor('Alice');
  tree.recycleBin.push({ person: { name: 'Deleted relative' } });
  a.queue(tree); await a.flush();
  assert.equal(backend.rows.get('user-a').document.people[0].name, 'Alice');
  assert.equal(backend.rows.has('user-b'), false);
  assert.deepEqual(await b.load(), empty());
  assert.equal(drafts.getItem(a.key), null);
  a.close(); b.close();
});

test('failed saves retain draft and can be retried after reload', async () => {
  const backend = server(), drafts = storage();
  const a = new Store(backend.client, 'user-a', drafts);
  await a.load(); backend.fail(new Error('offline'));
  a.queue(documentFor('Recover me'));
  await assert.rejects(a.flush(), /offline/);
  assert.ok(drafts.getItem(a.key)); a.close();
  backend.fail(null);
  const reload = new Store(backend.client, 'user-a', drafts);
  assert.equal((await reload.load()).people[0].name, 'Recover me');
  await reload.flush();
  assert.equal(backend.rows.get('user-a').revision, 1); reload.close();
});

test('stale tab updates and simultaneous first saves never overwrite cloud data', async () => {
  const backend = server();
  const a = new Store(backend.client, 'same-user', storage());
  const b = new Store(backend.client, 'same-user', storage());
  await a.load(); await b.load();
  a.queue(documentFor('First')); await a.flush();
  b.queue(documentFor('Stale')); await assert.rejects(b.flush(), /Another tab/);
  assert.equal(backend.rows.get('same-user').document.people[0].name, 'First');
  const c = new Store(backend.client, 'same-user', storage()); await c.load();
  a.queue(documentFor('New revision')); await a.flush();
  c.queue(documentFor('Old revision')); await assert.rejects(c.flush(), /Another tab/);
  assert.equal(backend.rows.get('same-user').document.people[0].name, 'New revision');
  a.close(); b.close(); c.close();
});

test('a failed initial load cannot save an empty tree over existing data', async () => {
  const backend = server(); backend.fail(new Error('missing table'));
  const a = new Store(backend.client, 'user-a', storage());
  await assert.rejects(a.load(), /missing table/);
  a.queue(empty()); await a.flush();
  assert.equal(backend.rows.size, 0); a.close();
});

test('draft from older cloud revision is recoverable but cannot silently overwrite', async () => {
  const backend = server(), drafts = storage();
  backend.rows.set('user-a', { revision: 3, document: documentFor('Cloud') });
  drafts.setItem('family-tree-draft-v1:user-a', JSON.stringify({ revision: 2, document: documentFor('Draft') }));
  const a = new Store(backend.client, 'user-a', drafts);
  assert.equal((await a.load()).people[0].name, 'Draft');
  assert.equal(a.conflict, true);
  await assert.rejects(a.flush(), /Another tab/);
  assert.equal(backend.rows.get('user-a').document.people[0].name, 'Cloud'); a.close();
});

test('one owner can save multiple trees with separate revisions and recovery drafts', async () => {
  const backend = server(), drafts = storage();
  const first = new Store(backend.client, 'owner', drafts, () => {}, 'tree-one', 'First family');
  const second = new Store(backend.client, 'owner', drafts, () => {}, 'tree-two', 'Second family');
  await first.load(); await second.load();
  first.queue(documentFor('First person')); second.queue(documentFor('Second person'));
  assert.notEqual(first.key, second.key);
  await first.flush(); await second.flush();
  assert.equal(backend.rows.get('tree-one').document.people[0].name, 'First person');
  assert.equal(backend.rows.get('tree-two').document.people[0].name, 'Second person');
  assert.equal(backend.rows.get('tree-one').name, 'First family');
  assert.equal(backend.rows.get('tree-two').name, 'Second family');
  assert.equal(first.revision, 1); assert.equal(second.revision, 1);
  first.close(); second.close();
});

test('legacy drafts only migrate into the original owner-ID tree', async () => {
  const backend = server(), drafts = storage();
  drafts.setItem('family-tree-draft-v1:owner', JSON.stringify({ revision: 0, document: documentFor('Legacy') }));
  const other = new Store(backend.client, 'owner', drafts, () => {}, 'another-tree');
  assert.deepEqual(await other.load(), empty());
  const original = new Store(backend.client, 'owner', drafts);
  assert.equal((await original.load()).people[0].name, 'Legacy');
  assert.equal(drafts.getItem('family-tree-draft-v1:owner'), null);
  other.close(); original.close();
});
