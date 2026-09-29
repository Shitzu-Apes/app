/**
 * Resolve hook so `node --test` can load the app's source directly.
 *
 * The SvelteKit/Vite build resolves `$lib/*` through `tsconfig.json` paths, but
 * node has no idea that mapping exists, so every test that imported a `$lib`
 * module died with ERR_MODULE_NOT_FOUND before a single assertion ran. Nothing
 * in `tests/` was executable. This hook closes the two gaps node has no opinion
 * about:
 *
 *   1. `$lib/foo` is an alias, and may name a directory (`$lib/util`).
 *   2. The source uses extensionless relative imports (`./util/FixedNumber`),
 *      which is legal under a bundler and illegal under ESM.
 *
 * Run via `yarn test`, which also passes `--experimental-transform-types`:
 * `FixedNumber.ts` uses TypeScript parameter properties, and node's default
 * strip-only mode rejects those with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX.
 *
 * Deliberately *not* handled here: SvelteKit's `$app/*` virtual modules,
 * `import.meta.env`, and `.svelte` imports. Stubbing those was tried and does not
 * work — node does not run `load` hooks for TypeScript under type stripping, so
 * `import.meta.env` cannot be injected, and the wallet modules that read it at
 * module scope then cannot be imported at all. Any module that reaches a
 * SvelteKit-only API is therefore not unit-testable as written, and the way out
 * is to keep that API out of the module: pure logic takes its data as an
 * argument rather than importing a module that also owns wallet state.
 */
import { statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = new URL("../", import.meta.url);
const LIB = new URL("./src/", ROOT);

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** The candidates a bundler would try for a specifier with no extension. */
function candidates(base) {
  return [`${base}.ts`, resolvePath(base, "index.ts")];
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("$lib/")) {
    const base = fileURLToPath(new URL(specifier.slice("$lib/".length), LIB));
    for (const path of candidates(base)) {
      if (isFile(path)) return next(pathToFileURL(path).href, context);
    }
  }

  // Only relative specifiers from a real file: bare package specifiers must
  // still reach node so node_modules resolution and `exports` maps keep working.
  const parent = context.parentURL;
  if (specifier.startsWith(".") && parent?.startsWith("file:")) {
    const base = resolvePath(dirname(fileURLToPath(parent)), specifier);
    for (const path of candidates(base)) {
      if (isFile(path)) return next(pathToFileURL(path).href, context);
    }
  }

  return next(specifier, context);
}
