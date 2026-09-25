// Pure model-coordinate layout helpers, shared by the browser and Node tests.
(function (root) {
  function arrangeMembers(members, action) {
    const actions = ['left', 'center-x', 'right', 'top', 'center-y', 'bottom', 'space-x', 'space-y'];
    if (!actions.includes(action)) throw new Error('Unknown arrangement.');
    if (members.length < (action.startsWith('space') ? 3 : 2)) return members;
    const axis = ['left', 'center-x', 'right', 'space-x'].includes(action) ? 'x' : 'y';
    const size = axis === 'x' ? 'width' : 'height';
    const result = members.map(member => ({ ...member }));
    const start = Math.min(...result.map(member => member[axis] - member[size] / 2));
    const end = Math.max(...result.map(member => member[axis] + member[size] / 2));
    if (action.startsWith('space')) {
      result.sort((a, b) => a[axis] - b[axis] || a.id.localeCompare(b.id));
      // Equal edge-to-edge gaps. Expand crowded selections instead of overlapping.
      const gap = Math.max(24, (end - start - result.reduce((sum, member) => sum + member[size], 0)) / (result.length - 1));
      let cursor = start;
      for (const member of result) {
        member[axis] = cursor + member[size] / 2;
        cursor += member[size] + gap;
      }
    } else {
      for (const member of result) {
        member[axis] = ['left', 'top'].includes(action) ? start + member[size] / 2
          : ['right', 'bottom'].includes(action) ? end - member[size] / 2 : (start + end) / 2;
      }
    }
    return result;
  }
  root.arrangeMembers = arrangeMembers;
  function generationLayout(people, relationships) {
    // Leave room between spouses for the branch button and relationship label.
    const memberSpacing = 150;
    const byId = new Map(people.map(person => [person.id, person]));
    const owners = new Map(people.map(person => [person.id, person.id]));
    const rootOf = id => {
      while (owners.get(id) !== id) id = owners.get(id);
      return id;
    };
    const parents = relationships.filter(r => ['parent', 'child'].includes(r.type))
      .map(r => r.type === 'child' ? { from: r.to, to: r.from } : r)
      .filter(r => byId.has(r.from) && byId.has(r.to) && r.from !== r.to);
    const spouseKeys = new Set();
    const spouses = relationships.filter(r => {
      const key = [r.from, r.to].sort().join(':');
      if (r.type !== 'spouse' || !byId.has(r.from) || !byId.has(r.to) || spouseKeys.has(key)) return false;
      spouseKeys.add(key);
      return true;
    }).sort((a, b) => [a.from, a.to].sort().join(':').localeCompare([b.from, b.to].sort().join(':')));
    const groupEdges = () => {
      const edges = new Map([...owners.keys()].map(id => [rootOf(id), new Set()]));
      parents.forEach(r => { if (rootOf(r.from) !== rootOf(r.to)) edges.get(rootOf(r.from)).add(rootOf(r.to)); });
      return edges;
    };
    const reachable = (edges, from, to) => {
      const pending = [from], seen = new Set();
      while (pending.length) {
        const id = pending.pop();
        if (id === to) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        pending.push(...edges.get(id));
      }
      return false;
    };
    let separatedSpouses = 0;
    for (const spouse of spouses) {
      const a = rootOf(spouse.from), b = rootOf(spouse.to);
      if (a === b) continue;
      const edges = groupEdges();
      // Parent order wins when putting spouses on one row would create a cycle.
      if (reachable(edges, a, b) || reachable(edges, b, a)) { separatedSpouses++; continue; }
      owners.set(b, a);
    }
    const groups = new Map();
    people.forEach(person => {
      const id = rootOf(person.id);
      if (!groups.has(id)) groups.set(id, { id, members: [], rank: 0, incoming: [] });
      groups.get(id).members.push(person);
    });
    const compare = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    groups.forEach(group => { group.members.sort(compare); group.width = (group.members.length - 1) * memberSpacing + 70; });
    const edges = groupEdges();
    edges.forEach((children, parent) => children.forEach(child => groups.get(child).incoming.push(parent)));
    const indegrees = new Map([...groups].map(([id, group]) => [id, group.incoming.length]));
    const ready = [...groups.keys()].filter(id => !indegrees.get(id));
    let visited = 0;
    while (ready.length) {
      const id = ready.shift(); visited++;
      edges.get(id).forEach(child => {
        groups.get(child).rank = Math.max(groups.get(child).rank, groups.get(id).rank + 1);
        indegrees.set(child, indegrees.get(child) - 1);
        if (!indegrees.get(child)) ready.push(child);
      });
    }
    if (visited !== groups.size) throw new Error('Generation layout requires parent relationships without cycles.');
    const positions = [];
    const maxRank = Math.max(0, ...[...groups.values()].map(group => group.rank));
    for (let rank = 0; rank <= maxRank; rank++) {
      const row = [...groups.values()].filter(group => group.rank === rank);
      row.forEach(group => { group.ideal = group.incoming.length ? group.incoming.reduce((sum, id) => sum + groups.get(id).x, 0) / group.incoming.length : 0; });
      row.sort((a, b) => a.ideal - b.ideal || compare(a.members[0], b.members[0]));
      let right = -Infinity;
      row.forEach(group => {
        group.x = Math.max(group.ideal, right + 100 + group.width / 2);
        right = group.x + group.width / 2;
      });
      const offset = row.reduce((sum, group) => sum + group.ideal - group.x, 0) / row.length;
      row.forEach(group => {
        group.x += offset;
        group.members.forEach((person, index) => positions.push({ id: person.id, x: group.x - (group.members.length - 1) * memberSpacing / 2 + index * memberSpacing, y: rank * 170 }));
      });
    }
    return { positions, separatedSpouses };
  }
  root.generationLayout = generationLayout;
  if (typeof module !== 'undefined') module.exports = arrangeMembers;
  if (typeof module !== 'undefined') module.exports.generationLayout = generationLayout;
})(typeof window !== 'undefined' ? window : globalThis);
