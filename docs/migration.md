---
applies_to: [v3, v4]
---

# Migration to v4

> Migrate a Native Federation project from v3 to v4 — switch federation.config.js to ESM, enable ESM in package.json, and opt in to the stable Orchestrator runtime.

The steps below cover the framework-agnostic parts of the v3 -> v4 upgrade — the two files every Native Federation project owns, regardless of whether it is built with Angular, React, Vite or a custom stack. For Angular-specific changes (builder, schematics, `main.ts`), see [Angular Adapter -> Migration to v4](angular-adapter/migration-v4.md).

> **Note:** **What changes at this layer:** `federation.config.js` switches from CommonJS to ESM, and `package.json` opts the project into ESM with `"type": "module"`. That's it — the file layout is unchanged.

## 1. Clear stale caches

Before the first v4 build, wipe the caches your old build produced. Mixing v3 artifacts with v4 output is the most common source of "it runs but the browser can't find a chunk" errors.

```
📁 project-root/
├── 📁 dist/                   ← previously bundled artifacts
└── 📁 node_modules/
    └── 📁 .cache/             ← native federation cache
```

If you use Angular, also remove `.angular/`.

## 2. Enable ESM in `package.json`

Native Federation 4 is fully ESM — both the config file and the emitted artifacts. Set `"type": "module"` on every project that owns a `federation.config.js`:

```jsonc
{
  "name": "mfe1",
  "version": "1.2.3",
  "type": "module",           // (optional) for full ESM micro frontends.
  "dependencies": {
    "@softarc/native-federation-runtime": "~4.0.0"
  },
  "devDependencies": {
    "@softarc/native-federation": "~4.0.0",
    "@softarc/native-federation-orchestrator": "^4.0.0"
  }
}
```

> **Warning:** If `"type": "module"` breaks a legacy CommonJS script you still need, rename that script to `.cjs` — Node falls back to CommonJS for that extension regardless of the package-wide setting.

## 3. Convert `federation.config.js` to ESM:

The config shape is the same as in v3. Only the module syntax changes: `require(...)` becomes `import`, and `module.exports` becomes `export default`. Also the file name changes to `federation.config.mjs`.

### Before (v3, CommonJS)

```js
const { withNativeFederation, share, shareAll } = require('@softarc/native-federation/config');

module.exports = withNativeFederation({
  name: 'mfe1',

  exposes: {
    './Component': './src/bootstrap.ts',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
    ...share({ '@angular/core': { singleton: true, strictVersion: true, requiredVersion: 'auto' } }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
  ],
});
```

### After (v4, ESM)

```js
import { withNativeFederation, shareAll } from '@softarc/native-federation/config';

export default withNativeFederation({
  name: 'team/mfe1',

  exposes: {
    './Component': './src/bootstrap.ts',
  },

  shared: {
    // shareAll still works. In v4 you can also merge per-package overrides
    // straight into the shareAll call — no need for a trailing share(...).
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto' },
      {
        overrides: {
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: { keepAll: true },
          },
        },
      },
    ),
  },

  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],

  features: {
    ignoreUnusedDeps: true, // on by default in v4
    denseChunking: true,    // opt-in: groups chunks in remoteEntry.json for smaller payloads
  },
});
```

> **Note:** The `features` block is new in v4. See [Configuration -> Feature Flags](core/configuration.md#features) for the full list.

## 4. Adopt the Orchestrator (recommended)

The [Orchestrator](orchestrator/index.md) — `@softarc/native-federation-orchestrator` — is now **stable** and is the recommended browser runtime for v4 hosts. It speaks the same `remoteEntry.json` contract as the default `@softarc/native-federation-runtime`, so remotes built by the Core work unchanged. On top of that it adds:

- Semver-range resolution when remotes disagree on a shared version.
- Persistent caching of `remoteEntry.json` in `localStorage` or `sessionStorage`.
- A pluggable logger, storage backend and import-map shim configuration.

Switching is an install + import change on the host; the emitted artifacts stay the same. The exact host bootstrap code depends on your framework — see the [Orchestrator overview](orchestrator/index.md) for configuration options, or [Angular Adapter -> Runtime](angular-adapter/runtime.md) for the Angular-specific bootstrap.

> **Warning:** **SSR note.** The Orchestrator is client-side only today. If you need remote modules to execute during server-side rendering, keep using the default Runtime on the SSR path.

## That's it

With the two files above updated and caches cleared, your project builds and runs on Native Federation 4. If something broke along the way, please [open an issue](https://github.com/native-federation) — we want to hear about it.

## Where to Go Next

- [`federation.config.js` reference](core/configuration.md) — every field, every feature flag.
- [Orchestrator overview](orchestrator/index.md) — why it's worth switching.
- [Angular Adapter -> Migration to v4](angular-adapter/migration-v4.md) — the `angular.json` builder, schematics and `main.ts` changes.
