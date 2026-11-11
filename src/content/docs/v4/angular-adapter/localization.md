# Localization

> Configure Angular locale data loading with Native Federation — the ignoreUnusedDeps default and the shareAngularLocales fallback.

Angular ships per-locale data (numbers, dates, plural rules) under `@angular/common/locales`. These files don't follow standard package exports, so the share helpers can't pick them up automatically. The Angular adapter has two ways to handle them; new projects get the recommended one by default.

## Recommended: `ignoreUnusedDeps`

Locale data loading is automatic when `features.ignoreUnusedDeps` is on:

```ts
export default withNativeFederation({
  // ...
  features: {
    ignoreUnusedDeps: true,
  },
});
```

The core scans your entry points and only ships the locale files you actually import — no manual list, no surprises. New v4 projects get this enabled by default.

How does it work? With `ignoreUnusedDeps` off, `withNativeFederation` in the Angular adapter strips the `@angular/common/locales/*` entries from the _shared_ map, except the ones you list with `shareAngularLocales`. With the flag on, locale entries are kept and the unused-deps shaking does the right thing on a per-entry basis.

## Fallback: `shareAngularLocales`

Before v20.0.6, or any time you can't enable `ignoreUnusedDeps`, declare the locales explicitly:

```ts
import {
  withNativeFederation,
  shareAll,
  shareAngularLocales,
} from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'mfe1',
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
    ...shareAngularLocales(['en', 'de', 'fr']),
  },
});
```

`shareAngularLocales` generates one shared entry per locale, published at the installed `@angular/common` version.

### Options

```ts
shareAngularLocales(keys: string[], opts?: {
  config?: ExternalConfig;
  legacy?: boolean;
  pool?: string;
  build?: ExternalConfig['build'];
})
```

- **`keys`** — locale codes to share. Anything available under `@angular/common/locales`.
- **`opts.config`** — overrides the per-entry shared config. Defaults to `{ singleton: true, strictVersion: true, requiredVersion: 'auto' }`.
- **`opts.legacy`** — use the old `.mjs` filenames instead of `.js`. Only relevant for older `@angular/common` versions.
- **`opts.pool`**, **`opts.build`** — _Since 22.2.5._ Win over the same fields in `config`. Match how `@angular/common` is shared, or the locales end up in a second bundle and a second `@angular/common` record. See [Angular Config → shareAngularLocales](configuration.md#shareangularlocales--locale-handling).

## Automatic Shell Reloading

The federation dev server pushes Server-Sent Events when a remote finishes (re)building, so the shell can refresh without a manual page reload. See the [Builder → Dev Server](builder.md#dev-server--hot-reload) section for the wiring, and the article below for the full pattern:

### Fixing DX Friction: Automatic Shell Reloading

How to subscribe to the federation build-notification stream and trigger a host reload whenever a remote rebuilds.

[Read the Article](https://www.angulararchitects.io/en/blog/fixing-dx-friction-automatic-shell-reloading-in-native-federation/)

## Related

- [I18N](i18n.md) — Angular's `i18n` + translation pipeline integration.
- [Angular Config → shareAngularLocales](configuration.md#shareangularlocales--locale-handling).
- [Core configuration → features](../core/configuration.md#feature-flags) — the canonical reference for `ignoreUnusedDeps`.
