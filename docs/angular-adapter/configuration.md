---
applies_to: [v4]
---

# Angular Config

> What @angular-architects/native-federation-v4/config adds on top of the core federation.config.mjs — Angular skip list, platform inference and locale handling.

The Angular adapter re-exports the core's `withNativeFederation`, `share` and `shareAll` from a wrapper at `@angular-architects/native-federation-v4/config`. The wrappers are thin: same options, same shape, same semantics. They only differ in the Angular-aware defaults they apply. For everything that isn't called out here, refer to the canonical [core configuration reference](../core/configuration.md).

**On this page**

- [Imports](#imports)
- [withNativeFederation differences](#what-withnativefederation-adds)
- [NG_SKIP_LIST](#ng_skip_list)
- [Platform inference](#platform-inference)
- [shareAngularLocales & locale handling](#shareangularlocales--locale-handling)
- [What the schematic generates](#what-the-schematic-generates)

## Imports

```ts
import {
  withNativeFederation,
  share,
  shareAll,
  shareAngularLocales,
  NG_SKIP_LIST,
} from '@angular-architects/native-federation-v4/config';
```

All five symbols are Angular-specific exports. Anything else (helpers, types, advanced overrides) lives in the core — import it from `@softarc/native-federation/config` or `@softarc/native-federation/domain`.

## What `withNativeFederation` Adds

The Angular wrapper does three things and then delegates to the core:

1. If you didn't set `platform` explicitly, it infers it from your shared dependencies (see [below](#platform-inference)).
2. It calls the core's `withNativeFederation` with your config.
3. If `features.ignoreUnusedDeps` is _off_, it strips every `@angular/common/locales/*` entry from the resulting shared map. This preserves backwards-compatibility with v3 setups where Angular's locale data needed to be pulled in differently.

Everything else — `name`, `exposes`, `shared`, `sharedMappings`, `skip`, `chunks`, `features`, build modes, … — comes from the core and lives in `federation.config.mjs`. See the [core configuration reference](../core/configuration.md) for the complete schema.

## NG_SKIP_LIST

The Angular `share` and `shareAll` default to `NG_SKIP_LIST` instead of the core's `DEFAULT_SKIP_LIST`. The list extends the core defaults with packages that should never be shared in an Angular project:

```ts
export const NG_SKIP_LIST: SkipList = [
  ...DEFAULT_SKIP_LIST,
  '@angular-architects/native-federation',
  'zone.js',
  '@angular/localize',
  '@angular/localize/init',
  '@angular/localize/tools',
  '@angular/router/upgrade',
  '@angular/common/upgrade',
  /^@nx\/angular/,
  pkg => pkg.startsWith('@angular/') && !!pkg.match(/\/testing(\/|$)/),
];
```

Why these:

- **`zone.js`** patches global APIs and must run once per realm — sharing across remotes corrupts patching.
- **`@angular/localize`** entries inject globals at boot and aren't safe to load lazily.
- **`*/upgrade`** packages are AngularJS interop and only matter in the host.
- **`@nx/angular`** is dev-only.
- **Any `@angular/.../testing`** entry — these are not part of the runtime.

You can pass your own skip list to `shareAll` or `share`:

```ts
shareAll(
  { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  { skipList: [...NG_SKIP_LIST, /^@my-org\//] },
);
```

For the broader semantics of `skip` (entry-by-entry exclusion vs. the global skip list), see [core configuration → skip](../core/configuration.md#skip).

## Platform Inference

Native Federation builds for either `browser` (default) or `node`. The core requires you to set `platform` explicitly; the Angular wrapper infers it: if any shared dependency starts with `@angular/platform-server` or `@angular/ssr`, it sets `platform: 'node'`. Otherwise it stays on `browser`.

You can always override:

```ts
export default withNativeFederation({
  name: 'mfe1',
  platform: 'node',  // ← explicit wins
  shared: { ... },
});
```

## shareAngularLocales & Locale Handling

Angular ships per-locale data as separate files under `@angular/common/locales`. They aren't proper subpath exports, so the standard share helpers can't pick them up. The adapter has two answers:

### The recommended path: `ignoreUnusedDeps`

Since adapter v20.0.6, locale loading works out of the box if you opt into `ignoreUnusedDeps` (the default for new projects):

```ts
export default withNativeFederation({
  // ...
  features: {
    ignoreUnusedDeps: true,
  },
});
```

The core scans your entry points and only ships the locale files you actually import. Nothing extra to configure.

### The fallback: `shareAngularLocales`

If you can't enable `ignoreUnusedDeps` (for example, you're on an older release), declare the locales explicitly:

```ts
import {
  withNativeFederation,
  shareAll,
  shareAngularLocales,
} from '@angular-architects/native-federation-v4/config';

export default withNativeFederation({
  name: 'mfe1',
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
    ...shareAngularLocales(['en', 'de', 'fr']),
  },
});
```

`shareAngularLocales(keys, opts?)` generates one shared entry per locale key, pre-wiring the `packageInfo.entryPoint` at `node_modules/@angular/common/locales/<key>.js`. Pass `opts.config` to override the default `{ singleton: true, strictVersion: true, requiredVersion: 'auto' }`; pass `opts.legacy: true` to use the old `.mjs` filenames if your `@angular/common` still ships them.

See [Localization](localization.md) for the wider context.

## What the Schematic Generates

For reference, this is the `federation.config.mjs` that `ng add` emits for a remote on v4:

```ts
import { withNativeFederation, shareAll } from '@angular-architects/native-federation-v4/config';

export default withNativeFederation({
  name: 'mfe1',

  exposes: {
    './Component': './projects/mfe1/src/app/app.component.ts',
  },

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          // includeSecondaries is an opt-out of ignoreUnusedDeps, so all of
          // @angular/core is shared to prevent mismatches.
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            build: 'package',
            includeSecondaries: { keepAll: true },
          },
        },
      },
    ),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Add further packages you don't need at runtime
  ],

  features: {
    // ignoreUnusedDeps is enabled by default now
    // ignoreUnusedDeps: true,

    // Opt-in: groups chunks in remoteEntry.json for smaller metadata file
    denseChunking: true,
  },
});
```

Notable defaults: `build: 'package'` for the per-package build mode (each external gets its own meta file — see [build modes](../core/configuration.md#build-modes)), `includeSecondaries.keepAll` for `@angular/core` only (see [below](#why-keepall-for-angularcore)), and `denseChunking: true` to compress the `remoteEntry.json`. The schematic doesn't generate an override for `@angular/common`; only `@angular/core` gets the `keepAll` guard out of the box.

### Why `keepAll` for `@angular/core`?

With `ignoreUnusedDeps` on, the core only shares the secondary entry points (e.g. `@angular/core/rxjs-interop`) that this remote actually imports. That's fine for most packages but _dangerous_ for Angular itself: a different remote might rely on a secondary that this remote omits, and the orchestrator would then load that secondary from a different Angular version, splitting Angular across versions. `includeSecondaries: { keepAll: true }` forces every Angular secondary to ship from the same package, keeping the framework versioned as a unit.

## Related

- [Core: federation.config.mjs reference](../core/configuration.md) — the canonical source for every option.
- [Core: Sharing Dependencies](../core/sharing.md) — share, shareAll, secondary entry points, the downsides of sharing.
- [Localization](localization.md) — locale data in detail.
