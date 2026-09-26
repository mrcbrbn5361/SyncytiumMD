/**
 * Single source of truth for the package version.
 *
 * Kept as a literal (instead of importing package.json) so the value is
 * inlined by the bundler and available in every entry point without extra
 * runtime file resolution. `tests/version.test.ts` asserts this stays in
 * sync with `package.json`.
 */
export const VERSION = '0.2.0';
