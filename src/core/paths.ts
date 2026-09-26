/**
 * Pure path/glob helpers used by the ignore matcher and by rule-id sanitising.
 * Kept dependency-free so both the engine and the adapters can use them.
 */

const WINDOWS_SEP = /\\/g;

/** Normalises any platform path to forward slashes. */
export function toPosix(p: string): string {
  return p.replace(WINDOWS_SEP, '/');
}

/**
 * Converts an arbitrary string into a safe kebab-case slug that is valid both
 * as a filename and as a path segment on every supported platform.
 *
 * This is the guard against path traversal: rule ids arrive from user-authored
 * frontmatter and are interpolated into generated file paths such as
 * `.cursor/rules/<id>.mdc`.
 */
export function slugify(input: string, fallback = 'rule'): string {
  const slug = toPosix(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Split camelCase/PascalCase so `BadFileName` becomes `bad-file-name`.
    // Besides being more readable, this guarantees the slug differs from the
    // input by more than case, which matters on case-insensitive filesystems
    // where a rename that only changes case is a silent no-op.
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\-]+/, '')
    .replace(/[.\-]+$/, '')
    .toLowerCase();

  if (slug.length === 0) return fallback;
  // Windows reserved device names cannot be used as filenames.
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(slug)) return `${slug}-file`;
  return slug;
}

/** True when the value contains no characters that could escape a path segment. */
export function isSafePathSegment(value: string): boolean {
  return value.length > 0 && slugify(value, '') === value && value !== '.' && value !== '..';
}

interface GlobMatcher {
  regex: RegExp;
  /** Directory prefixes implied by the pattern (used for fast rejection). */
  prefixes: string[];
}

const matcherCache = new Map<string, GlobMatcher>();

function escapeRegex(input: string): string {
  return input.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles a single `.gitignore`-flavoured glob into a RegExp.
 *
 * Supported syntax:
 *  - `*`        any run of characters except `/`
 *  - `**`       any number of path segments, including none
 *  - `?`        one character except `/`
 *  - trailing `/`  directory-only match (also matches everything under it)
 *  - `!` prefix  negation (evaluated by `isIgnored`, later patterns win)
 *  - a pattern without `/`  matches at any depth, like `.gitignore`
 */
export function compileGlob(pattern: string): GlobMatcher {
  const cached = matcherCache.get(pattern);
  if (cached) return cached;

  let raw = toPosix(pattern.trim());
  if (raw.startsWith('!')) raw = raw.slice(1);

  const dirOnly = raw.endsWith('/');
  if (dirOnly) raw = raw.slice(0, -1);

  const anchored = raw.startsWith('/');
  const segments = raw.split('/').filter(s => s.length > 0);
  const hasSlash = anchored || raw.includes('/');

  const segmentPattern = (segment: string): string => {
    let out = '';
    for (let i = 0; i < segment.length; i++) {
      const ch = segment[i];
      if (ch === '*') {
        if (segment[i + 1] === '*') {
          // `**` inside a segment (e.g. `a**b`) degrades to `*`.
          i++;
          out += '[^/]*';
          continue;
        }
        out += '[^/]*';
        continue;
      }
      if (ch === '?') {
        out += '[^/]';
        continue;
      }
      out += escapeRegex(ch);
    }
    return out;
  };

  let body: string;
  if (segments.length === 0) {
    body = '';
  } else {
    // Built segment by segment rather than with `join('/')`, because a middle
    // `**` already consumes its own trailing separator.
    let acc = '';
    let previousWasGlobstar = false;
    segments.forEach((segment, i) => {
      const isLast = i === segments.length - 1;
      const isGlobstar = segment === '**';
      if (i > 0 && !previousWasGlobstar) acc += '/';
      acc += isGlobstar ? (isLast ? '.*' : '(?:[^/]*/)*') : segmentPattern(segment);
      previousWasGlobstar = isGlobstar && !isLast;
    });
    body = acc;
  }

  const prefix = hasSlash ? '^' : '^(?:.*/)?';

  // A pattern whose final segment has no wildcard names a concrete entry, so
  // it also matches everything beneath it - exactly how gitignore treats
  // `node_modules` (with or without the trailing slash). A trailing `/` forces
  // the same behaviour even when the final segment ends in a wildcard.
  const lastSegment = segments[segments.length - 1] ?? '';
  const namesDirectory = dirOnly || !/[*?]/.test(lastSegment);

  const source = body.length === 0
    ? '^$'
    : `${prefix}${body}${namesDirectory ? '(?:/.*)?' : ''}$`;

  const matcher: GlobMatcher = { regex: new RegExp(source), prefixes: [] };
  matcherCache.set(pattern, matcher);
  return matcher;
}

export interface IgnoreDecision {
  ignored: boolean;
  /** The pattern that caused the match, or undefined when not ignored. */
  pattern?: string;
}

/**
 * Evaluates a list of `.gitignore`-style patterns against a relative path.
 * Later patterns win so that negations (`!keep.md`) behave like git.
 */
export function isIgnored(relativePath: string, patterns: string[]): IgnoreDecision {
  if (patterns.length === 0) return { ignored: false };

  const rel = toPosix(relativePath).replace(/^\.\//, '').replace(/^\/+/, '');
  let ignored = false;
  let matchedBy: string | undefined;

  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    const matcher = compileGlob(trimmed);
    if (matcher.regex.test(rel)) {
      ignored = !trimmed.startsWith('!');
      matchedBy = ignored ? trimmed : undefined;
    }
  }

  return { ignored, pattern: matchedBy };
}

/** Returns true when the path is contained within `root` after resolution. */
export function isInsideRoot(root: string, candidate: string): boolean {
  const normalizedRoot = toPosix(root).replace(/\/+$/, '');
  const normalizedCandidate = toPosix(candidate);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}/`)
  );
}
