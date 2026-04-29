---
applies_to: [v4]
---

# `federation.config.js`

> The complete federation.config.js reference — name, exposes, shared, sharedMappings, skip, chunks, feature flags, overrides and build modes.

Every host and remote declares a `federation.config.js` that is passed to `withNativeFederation`. This page is the single reference for every field, every feature flag and every knob you can turn to shape the output of a Native Federation build.

**On this page**

- [The `withNativeFederation` helper](#the-withnativefederation-helper)
- [Top-level options](#top-level-options)
- [name](#name)
- [exposes](#exposes)
- [shared & share helpers](#shared--the-share-helpers)
- [sharedMappings](#sharedmappings)
- [skip](#skip)
- [chunks](#chunks)
- [build modes](#build-modes-on-a-shared-entry)
- [features](#feature-flags)
- [platform & share scope](#platform--sharescope)
- [Common recipes](#common-recipes)

## The `withNativeFederation` Helper

The helper normalizes your config — it applies defaults, resolves the skip list, reads mapped paths from your `tsconfig`, and returns a `NormalizedFederationConfig` for the builder to consume:

```js
import { withNativeFederation, shareAll } from '@softarc/native-federation/config';

export default withNativeFederation({
  name: 'shell',
  exposes: { /* ... */ },
  shared: { ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }) },
});
```

## Top-level Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | `''` | The remote's name. Used as the key in the host manifest and in the generated `remoteEntry.json`. |
| `exposes` | `Record<string, string>` | `{}` | Map of public keys (e.g. `'./component'`) to file paths. Every entry becomes a module a host can load via `loadRemoteModule`. |
| `shared` | `SharedExternalsConfig` | *all deps* | Packages to share between host and remotes. If omitted, the core shares every dependency found in `package.json` with sensible defaults. See [Sharing Dependencies](sharing.md). |
| `sharedMappings` | `string[]` | all `tsconfig` paths | Paths mapped in your `tsconfig` that should be treated as shared (monorepo-internal libraries). |
| `platform` | `'browser' \| 'node'` | `'browser'` | Default platform for shared externals that don't set their own. |
| `chunks` | `boolean` | `true` | Default code-splitting behavior for shared dependencies. Set to `false` to bundle each shared package as a single file. |
| `skip` | `string[]` | *see skip list* | Packages (or mapped paths) to exclude from sharing. Merged with the built-in skip list. |
| `externals` | `string[]` | `[]` | Extra externals to expose to your bundler via `federationBuilder.externals` on top of the shared ones. |
| `shareScope` | `string` | *undefined* | Optional share scope name, propagated to every shared external. |
| `features` | `{ mappingVersion?, ignoreUnusedDeps?, denseChunking? }` | see below | Opt-in feature flags — [details below](#feature-flags). |

## name

The remote's stable identifier. It is written into `remoteEntry.json`, used as the manifest key hosts reference, and as the namespace for `loadRemoteModule` calls. It also determines the cache folder — `node_modules/.cache/native-federation/<name>`.

Use npm-style names: `'mfe1'`, `'@org/mfe1'`, or `'team/mfe1'`. Stick to one remote per team or bounded context — that's the grain the mental model is designed for.

> **Note:** If `name` is missing or empty, the build logs a warning and falls back to `'shell'` for the cache folder — which will collide with other nameless projects in the same workspace.

## exposes

A remote's `exposes` object declares which internal modules can be loaded into a host. Keys are the public specifiers that hosts use when calling `loadRemoteModule`; values are paths to the source file, relative to the workspace root.

```js
exposes: {
  './Component': './projects/mfe1/src/bootstrap.ts',
  './routes':    './projects/mfe1/src/routes.ts',
}
```

Each entry ends up in `remoteEntry.json` as:

```json
{
  "exposes": [
    { "key": "./Component", "outFileName": "Component-5EECHNWY.js" }
  ]
}
```

A host then imports it as `mfe1/./Component` via the import map. Hosts that don't expose modules simply omit the field.

## shared & the share helpers

The `shared` object lists every npm package that should be extracted into its own ESM bundle and reused between host and remotes. Declare each entry by hand, or use the `share` / `shareAll` helpers. If the property is omitted, `withNativeFederation` falls back to `shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto', platform: 'browser' })`.

```js
import { withNativeFederation, shareAll } from '@softarc/native-federation/config';

export default withNativeFederation({
  name: 'mfe1',
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
  },
});
```

Every per-package option (`singleton`, `strictVersion`, `requiredVersion`, `includeSecondaries`, `build`, `chunks`, `platform`, `shareScope`) is documented on [Sharing Dependencies](sharing.md).

### Empty vs. populated `shared`

An explicit empty object (`shared: {}`) means **share nothing**: the bundler inlines every dependency into the remote, which lets esbuild aggressively tree-shake — great for a single MFE in isolation, bad when you have many remotes pulling in the same libraries independently.

### `shareAll` with overrides

`shareAll` walks your `package.json`'s `dependencies` and applies the same defaults to every one. Since v21.1, the second argument lets you deviate for specific packages without rewriting the whole thing:

```js
shared: {
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
        'rxjs': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: { resolveGlob: true },
        },
      },
    }
  ),
}
```

## sharedMappings

Paths declared in your `tsconfig.json` (or `tsconfig.base.json`) are treated as shared libraries by default — perfect for monorepo-internal packages:

```json
{
  "compilerOptions": {
    "paths": {
      "shared-lib": ["libs/shared-lib/index.ts"]
    }
  }
}
```

Use `sharedMappings` to limit the set of mapped paths considered, or `skip` to drop specific ones. Wildcard paths (`@org/lib/*`) are supported but only when `features.ignoreUnusedDeps` is enabled — without it, the builder can't know which expansions are actually imported and strips them to stay safe.

## skip

`withNativeFederation` merges your `skip` with the built-in [`DEFAULT_SKIP_LIST`](#the-default-skip-list). Each entry can be a string, a regular expression or a predicate — the full package name (including any secondary entry point) is matched against all three forms:

```js
skip: [
  'rxjs/ajax',
  'rxjs/fetch',
  'rxjs/testing',
  'rxjs/webSocket',
  /^@types\//,
]
```

> **Note:** **"Skip" doesn't remove the package.** The package is still installed and still bundled into the micro-frontend — it just isn't extracted into a shared external. A skipped package continues to run locally in that remote; it just isn't de-duplicated across remotes.

### The default skip list

Exported from `@softarc/native-federation/config` as `DEFAULT_SKIP_LIST`. Out of the box it covers:

- every Native Federation package itself (`@softarc/native-federation`, `-core`, `-esbuild`, `-runtime`, `-orchestrator`, `vanilla-native-federation`)
- `es-module-shims` — the import-map polyfill
- `tslib/` and everything under `@types/`

## chunks

By default, large shared packages are split into chunks that load on demand. Toggle this globally at the top level — or per-package via the `chunks` field on a shared entry:

```js
// disable globally
chunks: false,

// disable only for one package (requires build: 'package')
shared: {
  ...shareAll(
    { singleton: true, strictVersion: true, requiredVersion: 'auto' },
    {
      overrides: {
        'large-lib': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          chunks: false,
          build: 'package',
        },
      },
    }
  ),
},
```

> **Note:** Per-package `chunks` is ignored when `build` is `'default'` — all default-mode externals share one build step, so they share one `chunks` setting. Switch the package to `build: 'package'` (or `'separate'`) to get an isolated bundle with its own chunk configuration.

## Build modes on a shared entry

The `build` field on each shared entry controls how the core groups packages when handing them to the bundler. There are three modes:

| Mode | Behavior | When to use |
| --- | --- | --- |
| `'default'` | Every `default` external on a given platform is bundled in a **single** build step. Produces one `browser-shared` (or `node-shared`) meta file in the cache and the shortest build time. | The baseline. Use unless you have a specific reason not to. |
| `'separate'` | Each entry gets its own build step, producing one meta file per external. | Edge cases where a single package needs different bundler settings from the rest — rarely needed. |
| `'package'` | The package and all its secondaries are built together as an isolated package bundle. | Required whenever you want per-package `chunks`, or when a single package needs its own bundler pass (custom chunking, isolated polyfills, wildcard exports that must not bleed into the shared bundle). |

## Feature Flags

All feature flags live under `features` on the config. None of them change behavior unless explicitly set.

| Flag | Default | Effect |
| --- | --- | --- |
| `ignoreUnusedDeps` | `true` | Drops shared externals that aren't actually imported by the entry points. Required for wildcard mapped paths. |
| `denseChunking` | `false` | Groups chunks by bundle name in `remoteEntry.json` so each shared package references its chunk bundle by name rather than listing chunks individually. Produces a smaller, more cache-friendly `remoteEntry.json`. |
| `mappingVersion` | `false` | Emits version information for shared mapped paths (monorepo-internal libraries). |

### When to leave `ignoreUnusedDeps` on (and when to override it)

The feature is on by default because most builds benefit from it: unused secondaries never enter `remoteEntry.json`, build output stays small, and glob-expanded libraries (RxJS, Material) don't explode. But it has a subtle interaction with cross-remote version resolution — if two remotes share different versions of Angular and one of them hasn't used `@angular/core/rxjs-interop`, the orchestrator can end up splitting the framework across versions. Opt out per-package with `includeSecondaries: { keepAll: true }` for tightly-coupled framework libraries. See [Downsides of treeshaking shared packages](sharing.md#downsides-of-treeshaking-shared-packages) for the full scenario.

## platform & shareScope

`platform` at the top level sets the default target (`'browser'` or `'node'`) for any shared external that doesn't declare one itself. Mix both in a single config — the builder splits the work into four buckets (`browser-shared`, `node-shared`, `browser-<pkg>`, `node-<pkg>`) and bundles each in its own step.

`shareScope`, if set, is propagated to every shared external that doesn't already have its own scope. It's passed through to `remoteEntry.json` so the orchestrator can honour it at load time.

## Common Recipes

### Share everything the root `package.json` declares

```js
shared: {
  ...shareAll({
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
  }),
},
skip: [
  'rxjs/ajax',
  'rxjs/fetch',
  'rxjs/testing',
  'rxjs/webSocket',
],
features: { ignoreUnusedDeps: true },
```

### Hand-pick a small set of shared packages

```js
shared: {
  ...share({
    '@angular/core': {
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
      includeSecondaries: { keepAll: true },
    },
    'rxjs': {
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
      includeSecondaries: { resolveGlob: true, skip: 'rxjs/internal/testing/*' },
    },
  }),
},
features: { ignoreUnusedDeps: true },
```

### Avoid cross-version splits on a framework library

```js
shared: {
  ...share({
    '@angular/core': {
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
      includeSecondaries: { keepAll: true },
    },
  }),
},
features: { ignoreUnusedDeps: true },
```

### Isolate one package with its own chunking strategy

```js
shared: {
  ...shareAll(
    { singleton: true, strictVersion: true, requiredVersion: 'auto' },
    {
      overrides: {
        'very-large-lib': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          build: 'package',
          chunks: false,
        },
      },
    }
  ),
},
```

### A minimal remote with no sharing (smallest possible bundle)

```js
export default withNativeFederation({
  name: 'mfe1',
  exposes: { './Component': './projects/mfe1/src/bootstrap.ts' },
  shared: {},
  skip: [],
});
```

## Full Example

```js
import { withNativeFederation, shareAll } from '@softarc/native-federation/config';

export default withNativeFederation({
  name: 'shell',

  exposes: {
    './header': './shell/header',
  },

  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
      includeSecondaries: false,
    }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
  ],

  features: {
    ignoreUnusedDeps: true,
    denseChunking: true,
  },
});
```

For details on each `shared` entry's options — `singleton`, `strictVersion`, `requiredVersion`, `includeSecondaries`, `chunks`, `build`, `platform` — see [Sharing Dependencies](sharing.md).
