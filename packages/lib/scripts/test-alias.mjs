/**
 * Resolve hook so `node --test` can load the app's source directly.
 *
 * The SvelteKit/Vite build resolves `$lib/*` through `tsconfig.json` paths, but
 * node has no idea that mapping exists, so every test that imported a `$lib`
 * module died with ERR_MODULE_NOT_FOUND before a single assertion ran. Nothing
 * in `tests/` was executable. These hooks close the two gaps node does have no
 * opinion about:
 *
 *   1. `$lib/foo` is an alias, and may name a directory (`$lib/util`).
 *   2. The source uses extensionless relative imports (`./util/FixedNumber`),
 *      which is legal under a bundler and illegal under ESM.
 *
 * Run via `yarn test`, which also passes `--experimental-transform-types`:
 * `FixedNumber.ts` uses TypeScript parameter properties, and node's default
 * strip-only mode rejects those with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./test-resolver.mjs", import.meta.url);
