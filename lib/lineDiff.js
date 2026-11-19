// Minimal line-level diff (LCS-based), no dependencies. Used by /rulebook to
// show what a self-improvement proposal actually changes instead of only the
// full replacement text.

// Returns [{ type: "same" | "add" | "del", text }] turning `before` into `after`.
export function diffLines(before, after) {
  const a = (before || "").split("\n");
  const b = (after || "").split("\n");

  // Strip the common prefix/suffix first -- proposals are "surgical edits",
  // so this usually shrinks the LCS table to a tiny fraction of the text.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const head = a.slice(0, start).map((text) => ({ type: "same", text }));
  const tail = a.slice(endA).map((text) => ({ type: "same", text }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;

  let mid;
  if ((n + 1) * (m + 1) > 25_000_000) {
    // Too big to diff line-by-line in the browser: show it as one replaced block.
    mid = [...midA.map((text) => ({ type: "del", text })), ...midB.map((text) => ({ type: "add", text }))];
  } else {
    // lcs[i][j] = LCS length of midA[i..] and midB[j..], flattened.
    const w = m + 1;
    const lcs = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i * w + j] = midA[i] === midB[j]
          ? lcs[(i + 1) * w + j + 1] + 1
          : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
      }
    }
    mid = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        mid.push({ type: "same", text: midA[i] });
        i++;
        j++;
      } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) {
        mid.push({ type: "del", text: midA[i++] });
      } else {
        mid.push({ type: "add", text: midB[j++] });
      }
    }
    while (i < n) mid.push({ type: "del", text: midA[i++] });
    while (j < m) mid.push({ type: "add", text: midB[j++] });
  }

  return [...head, ...mid, ...tail];
}

// Collapses long unchanged runs, keeping `context` lines around each change.
// Returns the same ops plus { type: "skip", count } placeholders.
export function collapseUnchanged(ops, context = 3) {
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, idx) => {
    if (op.type === "same") return;
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) keep[k] = true;
  });
  const out = [];
  let skipped = 0;
  ops.forEach((op, idx) => {
    if (keep[idx]) {
      if (skipped) out.push({ type: "skip", count: skipped });
      skipped = 0;
      out.push(op);
    } else {
      skipped++;
    }
  });
  if (skipped) out.push({ type: "skip", count: skipped });
  return out;
}

export function diffStats(ops) {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === "add") added++;
    else if (op.type === "del") removed++;
  }
  return { added, removed };
}
