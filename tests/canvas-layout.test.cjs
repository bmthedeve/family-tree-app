const { test } = require('node:test');
const assert = require('node:assert/strict');
const arrange = require('../canvas-layout.js');
const { generationLayout } = arrange;
const members = [
  { id: 'a', x: 40, y: 70, width: 60, height: 60 },
  { id: 'b', x: 200, y: 300, width: 80, height: 70 },
  { id: 'c', x: 540, y: 600, width: 50, height: 90 }
];
for (const [action, axis, size, offset] of [
  ['left', 'x', 'width', -0.5], ['center-x', 'x', 'width', 0], ['right', 'x', 'width', 0.5],
  ['top', 'y', 'height', -0.5], ['center-y', 'y', 'height', 0], ['bottom', 'y', 'height', 0.5]
]) {
  test(`${action} aligns icon bounds without changing the other axis or input`, () => {
    const original = structuredClone(members);
    const arranged = arrange(members, action);
    const values = arranged.map(member => member[axis] + member[size] * offset);
    assert.ok(values.every(value => value === values[0]));
    arranged.forEach((member, i) => assert.equal(member[axis === 'x' ? 'y' : 'x'], original[i][axis === 'x' ? 'y' : 'x']));
    assert.deepEqual(members, original);
  });
}
for (const [action, axis, size] of [['space-x', 'x', 'width'], ['space-y', 'y', 'height']]) {
  test(`${action} gives equal gaps with unequal icon sizes`, () => {
    const arranged = arrange(members, action);
    const gaps = arranged.slice(1).map((member, i) => member[axis] - member[size] / 2 - (arranged[i][axis] + arranged[i][size] / 2));
    assert.equal(gaps[0], gaps[1]);
    assert.ok(gaps[0] >= 24);
    assert.equal(arranged[0][axis], members[0][axis]);
    assert.equal(arranged[2][axis], members[2][axis]);
  });
}
test('crowded spacing expands to avoid overlap, with deterministic ordering', () => {
  const arranged = arrange(members.map(member => ({ ...member, x: 0 })), 'space-x');
  assert.deepEqual(arranged.map(member => member.id), ['a', 'b', 'c']);
  arranged.slice(1).forEach((member, i) => assert.equal(member.x - member.width / 2 - (arranged[i].x + arranged[i].width / 2), 24));
});
test('insufficient selections do not change layout', () => {
  assert.deepEqual(arrange(members.slice(0, 1), 'left'), members.slice(0, 1));
  assert.deepEqual(arrange(members.slice(0, 2), 'space-x'), members.slice(0, 2));
});

test('generation layout keeps parents above children, couples adjacent, and nodes separate', () => {
  const people = ['grandparent', 'mother', 'father', 'child', 'sibling', 'unrelated'].map(id => ({ id, name: id }));
  const relationships = [
    { from: 'grandparent', to: 'mother', type: 'parent' },
    { from: 'mother', to: 'father', type: 'spouse' },
    { from: 'father', to: 'mother', type: 'spouse' },
    ...['mother', 'father'].flatMap(from => ['child', 'sibling'].map(to => ({ from, to, type: 'parent' })))
  ];
  const before = structuredClone(people);
  const result = generationLayout(people, relationships);
  const nodes = new Map(result.positions.map(p => [p.id, p]));
  relationships.filter(r => r.type === 'parent').forEach(r => assert.ok(nodes.get(r.from).y < nodes.get(r.to).y));
  assert.equal(nodes.get('mother').y, nodes.get('father').y);
  assert.equal(Math.abs(nodes.get('mother').x - nodes.get('father').x), 150);
  result.positions.forEach((a, i) => result.positions.forEach((b, j) => { if (i !== j) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 100); }));
  assert.deepEqual(people, before);
  assert.deepEqual(generationLayout([...people].reverse(), [...relationships].reverse()).positions.sort((a, b) => a.id.localeCompare(b.id)), [...result.positions].sort((a, b) => a.id.localeCompare(b.id)));
});

test('generation layout prioritizes ancestry over incompatible spouse rows', () => {
  const people = ['a', 'b', 'c'].map(id => ({ id, name: id }));
  const result = generationLayout(people, [{ from: 'a', to: 'b', type: 'parent' }, { from: 'b', to: 'c', type: 'parent' }, { from: 'a', to: 'c', type: 'spouse' }]);
  assert.equal(result.separatedSpouses, 1);
  assert.deepEqual(result.positions.map(p => p.y), [0, 170, 340]);
});

test('generation layout handles empty and disconnected trees, and rejects ancestry cycles', () => {
  assert.deepEqual(generationLayout([], []).positions, []);
  const people = ['a', 'b'].map(id => ({ id, name: id }));
  assert.equal(generationLayout(people, []).positions.length, 2);
  assert.throws(() => generationLayout(people, [{ from: 'a', to: 'b', type: 'parent' }, { from: 'b', to: 'a', type: 'parent' }]), /cycles/);
});
