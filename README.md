# Shitzu Apes App Monorepo

Yarn workspaces monorepo holding the two frontends and their shared code.

## Layout

```
apps/
  shitzu-app/      # app.shitzuapes.xyz — shitzu routes, config, env
  meme-cooking/    # meme.cooking (production/staging/testnet) — board routes, config, env
packages/
  lib/             # shared source (components, near/solana/evm, bridge, api, stores, tests)
  static/          # shared static assets served by both apps
charting_library/  # git submodule (TradingView); copied into the packages by script
```

Both apps alias `$lib` to `packages/lib/src` and serve assets from `packages/static`
(see `files.lib` / `files.assets` in each `svelte.config.js`).

## Setup

```sh
corepack enable                    # once — activates the pinned Yarn 4 from package.json
yarn install                       # installs every workspace
./copy_charting_library_files.sh   # required once after cloning the submodule
```

Yarn 4 is pinned via `packageManager` in the root `package.json`; `.yarnrc.yml`
keeps the `node-modules` linker so SvelteKit/Vite tooling behaves as before.

## Development

```sh
yarn dev:shitzu   # shitzu app on :5173
yarn dev:meme     # meme.cooking app on :5173
```

Each app reads its own `.env*` files from its directory.

## Checks

```sh
yarn check        # svelte-check for packages/lib and both apps
yarn test         # node --test suite in packages/lib
yarn lint         # eslint + prettier
yarn format       # prettier --write
```

## Builds

```sh
yarn build:shitzu                 # mode production
yarn workspace meme-cooking build --mode production   # or staging / testnet
```

Deploys run per app from `.github/workflows/`; the Cloudflare Pages output lives in
`apps/<app>/.svelte-kit/cloudflare`.
