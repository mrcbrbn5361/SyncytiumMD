/**
 * Minimal unified-diff generator used by `syncytium diff`.
 *
 * Implemented as a plain LCS walk so that `diff` can report *what* drifted,
 * not just *that* it drifted, without pulling in a dependency.
 */

export interface DiffOptions {
  /** Maximum number of hunk lines to render before truncating. */
  maxHunkLines?: number;
  /** Lines of unchanged context around each change. */
  context?: number;
}

export interface DiffResult {
  changedLines: number;
  patch: string;
  truncated: boolean;
}

const DEFAULT_CONTEXT = 3;
const DEFAULT_MAX_HUNK_LINES = 60;

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

/** Longest-common-subsequence table walk, emitting +/-/space operations. */
function diffLines(a: string[], b: string[]): { op: ' ' | '-' | '+'; line: string }[] {
  const n = a.length;
  const m = b.length;

  // Guard against pathological memory use on very large files.
  if (n * m > 4_000_000) {
    return [
      ...a.map(line => ({ op: '-' as const, line })),
      ...b.map(line => ({ op: '+' as const, line }))
    ];
  }

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: { op: ' ' | '-' | '+'; line: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ op: ' ', line: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ op: '-', line: a[i] });
      i++;
    } else {
      ops.push({ op: '+', line: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ op: '-', line: a[i++] });
  while (j < m) ops.push({ op: '+', line: b[j++] });
  return ops;
}

export function createUnifiedDiff(
  filePath: string,
  oldText: string,
  newText: string,
  options?: DiffOptions
): DiffResult {
  const context = options?.context ?? DEFAULT_CONTEXT;
  const maxHunkLines = options?.maxHunkLines ?? DEFAULT_MAX_HUNK_LINES;

  const ops = diffLines(splitLines(oldText), splitLines(newText));
  const changedLines = ops.reduce((acc, op) => acc + (op.op === ' ' ? 0 : 1), 0);
  if (changedLines === 0) return { changedLines: 0, patch: '', truncated: false };

  // Mark which indices belong to a change so we can grow context around them.
  const isChange = ops.map(op => op.op !== ' ');
  const keep = new Array<boolean>(ops.length).fill(false);
  for (let k = 0; k < ops.length; k++) {
    if (!isChange[k]) continue;
    for (let y = Math.max(0, k - context); y <= Math.min(ops.length - 1, k + context); y++) {
      keep[y] = true;
    }
  }

  const header = `--- a/${filePath}\n+++ b/${filePath} (syncytium generated)`;
  const body: string[] = [];
  let truncated = false;

  let oldLine = 1;
  let newLine = 1;
  let cursor = 0;

  while (cursor < ops.length) {
    if (!keep[cursor]) {
      if (ops[cursor].op !== ' ') oldLine++;
      else newLine++;
      cursor++;
      continue;
    }

    // Expand the run to the full context window, then emit one hunk.
    let end = cursor;
    while (end < ops.length) {
      if (keep[end]) {
        end++;
        continue;
      }
      // Skip a short gap of unchanged lines so hunks stay compact.
      let lookahead = end;
      let unchanged = 0;
      while (lookahead < ops.length && !keep[lookahead] && unchanged <= context * 2) {
        lookahead++;
        unchanged++;
      }
      if (lookahead < ops.length && keep[lookahead] && unchanged <= context * 2) {
        end = lookahead;
        continue;
      }
      break;
    }

    body.push(`@@ -${oldLine},${end - cursor} +${newLine},${end - cursor} @@`);
    for (let k = cursor; k < end; k++) {
      const op = ops[k];
      const prefix = op.op === ' ' ? ' ' : op.op === '-' ? '-' : '+';
      if (body.length > maxHunkLines) {
        truncated = true;
        break;
      }
      body.push(`${prefix}${op.line}`);
      if (op.op === ' ') {
        oldLine++;
        newLine++;
      } else if (op.op === '-') {
        oldLine++;
      } else {
        newLine++;
      }
    }
    if (truncated) {
      body.push('… (diff truncated, run `syncytium diff --full` for the complete patch)');
      break;
    }
    cursor = end;
  }

  return { changedLines, patch: [header, ...body].join('\n'), truncated };
}

/** Compact one-line summary of a file diff, used for `--json` and MCP output. */
export function summarizeDiff(filePath: string, oldText: string, newText: string): string {
  const { changedLines } = createUnifiedDiff(filePath, oldText, newText, { maxHunkLines: 1 });
  return `${changedLines} line(s) differ from generated source of truth (.syncytium/)`;
}
