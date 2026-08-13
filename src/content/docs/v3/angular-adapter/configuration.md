# Angular Config

> The @angular-architects/native-federation/config entry point — what it re-exports, what shareAngularLocales adds, and what the generated federation.config.js contains.

Every federated project has a `federation.config.js` in its root. The Angular adapter does not define its own config format: `@angular-architects/native-federation/config` re-exports the [core's](../core/configuration.md) helpers and adds one Angular-specific helper on top.

The file is CommonJS. The builder loads it as `<dirname(tsConfig)>/federation.config.js`, so it lives next to the `tsconfig.json` the project's build target points at.

## Imports

```js
const {
  withNativeFederation,
  share,
  shareAll,
  shareAngularLocales,
  findRootTsConfigJson,
  DEFAULT_SKIP_LIST,
} = require('@angular-architects/native-federation/config');
```

| Export | Origin | Purpose |
| --- | --- | --- |
| `withNativeFederation` | core | Normalizes the config object into what the builder consumes. |
| `share` | core | Expands a shared map — resolves `'auto'` versions, pulls in transient deps and secondary entry points. |
| `shareAll` | core | Shares everything in the project's `package.json` dependencies, then runs `share` over the result. |
| `findRootTsConfigJson` | core | Locates `tsconfig.base.json`, else `tsconfig.json`, from the nearest `package.json` upward. |
| `DEFAULT_SKIP_LIST` | core | The list `share`/`shareAll` filter against by default. |
| `shareAngularLocales` | adapter | Declares `@angular/common/locales/*` entries with their real entry points. |

There is no separate Angular skip list in v3 — the core's `DEFAULT_SKIP_LIST` already carries the Angular-specific entries.

## <a id="default_skip_list"></a> DEFAULT_SKIP_LIST

`share` and `shareAll` filter against this list unless you pass your own `skipList`. It covers the packages that must never be shared:

- the Native Federation packages themselves (`@softarc/native-federation*`, `@angular-architects/native-federation*`);
- `es-module-shims`, `zone.js`, `tslib/`, `express`;
- `@angular/localize`, `@angular/localize/init`, `@angular/localize/tools` — these patch globals at boot, so a shared copy would be loaded too late;
- anything under a `/schematics` path, anything matching `@nx/angular*`, every `@angular/*/testing` entry point and every `@types/*` package.

Entries can be strings, regular expressions or predicates, and the `skip` option in your config is merged with — not substituted for — this behaviour: `withNativeFederation` applies **your** `skip` list to the normalized result, while `share`/`shareAll` apply the default one as they build it.

## What `withNativeFederation` does

```js
module.exports = withNativeFederation({
  name: 'mfe1',
  exposes: { './Component': './projects/mfe1/src/app/app.component.ts' },
  shared: { /* ... */ },
  sharedMappings: [],
  skip: [],
  externals: [],
  features: { mappingVersion: false, ignoreUnusedDeps: false },
});
```

It fills in defaults, normalizes each shared entry (`requiredVersion: 'auto'`, `singleton: false`, `strictVersion: false`, `build: 'default'`), infers a platform per package, resolves `sharedMappings` from the root `tsconfig` paths, and drops everything matching your `skip` list. When `shared` is omitted entirely it falls back to `shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto', platform: 'browser' })`.

Two behaviours are worth knowing about:

**Platform inference.** `@angular/platform-server`, `@angular/platform-server/init` and `@angular/ssr` default to `platform: 'node'`; everything else defaults to `'browser'`. Set `platform` explicitly on an entry to override.

**Locale filtering.** With `features.ignoreUnusedDeps` off (the default for a hand-written config), every `@angular/common/locales*` key is stripped from the shared map — see [Localization](localization.md). The generated config turns the feature on, which keeps them.

**Shared mappings and dots.** `sharedMappings` entries are read from the root tsconfig's `paths`. An import path containing a dot throws — Vite cannot resolve those reliably — so rename the path alias if you hit it.

## shareAngularLocales

```js
shareAngularLocales(['en', 'de', 'fr'], { config, legacy })
```

Angular's locale data lives at `@angular/common/locales/<code>` but is not reachable through the package's exports map, so the share helpers cannot discover it. `shareAngularLocales` declares each requested locale explicitly, pointing `packageInfo.entryPoint` at `node_modules/@angular/common/locales/<code>.js` (or `.mjs` with `{ legacy: true }`), and runs the result through `share`.

Without a `config` argument each entry defaults to `{ singleton: true, strictVersion: true, requiredVersion: 'auto' }`. See [Localization](localization.md) for when you need this versus `ignoreUnusedDeps`.

## What the Schematic Generates

```js
const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  name: 'mfe1',

  exposes: {
    './Component': './projects/mfe1/src/app/app.component.ts',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Add further packages you don't need at runtime
  ],

  features: {
    // New feature for more performance and avoiding
    // issues with node libs. Comment this out to
    // get the traditional behavior:
    ignoreUnusedDeps: true
  }
});
```

The `exposes` block is only written for `--type remote`. `shareAll` with `requiredVersion: 'auto'` reads each version from the closest `package.json`, so the declared range tracks what you actually installed. The `rxjs` secondary entry points in `skip` are the ones a browser bundle has no use for; add your own as you find them.

## Related

- [Core → federation.config.js](../core/configuration.md) — every option, in full.
- [Sharing Dependencies](../core/sharing.md) — how `share` and `shareAll` expand a map.
- [Localization](localization.md) and [I18N](i18n.md) — the Angular-specific corners.
