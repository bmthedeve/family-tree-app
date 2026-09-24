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
  if (typeof module !== 'undefined') module.exports = arrangeMembers;
})(typeof window !== 'undefined' ? window : globalThis);
