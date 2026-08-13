import { realpathSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * Runtime path helpers isolated in their own module so that environments that
 * compile to CommonJS (e.g. the test runner) can mock them instead of
 * evaluating `import.meta`.
 */

/**
 * Directory containing the compiled module files (build/ at runtime, src/ in dev)
 */
export function getModuleDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/**
 * Whether the process entry point is the given sibling module of this file.
 * Follows symlinks so npx/bin shims are recognized as the real entry script.
 */
export function isEntryPoint(moduleFilename: string): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    const entryPath = realpathSync(resolve(process.argv[1]));
    const modulePath = join(getModuleDir(), moduleFilename);
    return entryPath === modulePath;
  } catch {
    return false;
  }
}
