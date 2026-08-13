# Localization

> Configure Angular locale data loading with Native Federation — the ignoreUnusedDeps default and the shareAngularLocales fallback.

Angular ships per-locale data (numbers, dates, plural rules) under `@angular/common/locales`. These files don't follow standard package exports, so the share helpers can't pick them up automatically. The Angular adapter has two ways to handle them; new projects get the recommended one by default.

## Recommended: `ignoreUnusedDeps`

Since adapter v20.0.6, locale data loading is automatic when `features.ignoreUnusedDeps` is on:

```js
module.exports = withNativeFederation({
  // ...
  features: {
    ignoreUnusedDeps: true,
  },
});
```

The core scans your entry points and only ships the locale files you actually import — no manual list, no surprises. The `init` schematic writes this flag into every generated `federation.config.js`.

How does it work? `withNativeFederation` strips every `@angular/common/locales*` entry from the _shared_ map when `ignoreUnusedDeps` is off — that is the flag's default, so a config written by hand without it loses them. With the flag on, locale entries are kept and the unused-deps shaking does the right thing on a per-entry basis.

## Fallback: `shareAngularLocales`

Before v20.0.6, or any time you can't enable `ignoreUnusedDeps`, declare the locales explicitly:

```js
const {
  withNativeFederation,
  shareAll,
  shareAngularLocales,
} = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  name: 'mfe1',
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
    ...shareAngularLocales(['en', 'de', 'fr']),
  },
});
```

`shareAngularLocales` generates one shared entry per locale, pre-wiring its package info to `node_modules/@angular/common/locales/<locale>.js`. The helper was introduced in v19.0.14.

### Options

```ts
shareAngularLocales(keys: string[], opts?: {
  config?: ExternalConfig;
  legacy?: boolean;
})
```

- **`keys`** — locale codes to share. Anything available under `@angular/common/locales`.
- **`opts.config`** — overrides the per-entry shared config. Defaults to `{ singleton: true, strictVersion: true, requiredVersion: 'auto' }`.
- **`opts.legacy`** — use the old `.mjs` filenames instead of `.js`. Only relevant for older `@angular/common` versions.

## Automatic Shell Reloading

The federation dev server pushes Server-Sent Events when a remote finishes (re)building, so the shell can refresh without a manual page reload. See [Builder → Dev server & hot reload](builder.md#build-notifications) for the wiring, and the article below for the full pattern:

### Fixing DX Friction: Automatic Shell Reloading

How to subscribe to the federation build-notification stream and trigger a host reload whenever a remote rebuilds.

[Read the Article](https://www.angulararchitects.io/en/blog/fixing-dx-friction-automatic-shell-reloading-in-native-federation/)

## Related

- [I18N](i18n.md) — Angular's `i18n` + translation pipeline integration.
- [Angular Config → shareAngularLocales](configuration.md#shareangularlocales) — the helper's place in the config surface.
- [Core → federation.config.js](../core/configuration.md#feature-flags) — the canonical reference for `ignoreUnusedDeps`.
