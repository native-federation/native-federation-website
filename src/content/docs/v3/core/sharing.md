# Sharing Dependencies

> share and shareAll — how the helpers expand a shared map, resolve versions, and handle secondary entry points.

`shared` in a `federation.config.js` is a map of package name to `SharedConfig`. Writing it by hand is possible but rarely what you want: the helpers resolve `'auto'` versions, pull in secondary entry points and transient dependencies, and filter against the skip list.

Both helpers are exported from `@softarc/native-federation/build`, and re-exported by the Angular adapter's `/config` entry point.

## shareAll

```ts
shareAll(config?: SharedConfig, opts?: {
  skipList?: SkipList;
  projectPath?: string;
  overrides?: Record<string, SharedConfig>;
})
```

Shares every dependency found in the project's `package.json`, applying `config` to each one:

```js
shared: {
  ...shareAll({
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
    includeSecondaries: false,
  }),
}
```

Entries matching `skipList` (default: the core's `DEFAULT_SKIP_LIST`) are left out, and the result is run through `share`. Which `package.json` gets read is inferred: the one passed to `FederationOptions.packageJson`, else the workspace root, else the current working directory — `projectPath` overrides that.

### Overrides

`overrides` lets a few packages differ from the blanket config. Any key in `overrides` is skipped during the sweep and shared with its own settings instead:

```js
shared: {
  ...shareAll(
    { singleton: true, strictVersion: true, requiredVersion: 'auto' },
    {
      overrides: {
        'package-a/themes/xyz': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: { skip: '@package-a/themes/xyz/*' },
          build: 'separate',
        },
        'package-b': {
          singleton: false,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: { skip: 'package-b/icons/*' },
        },
      },
    },
  ),
}
```

The match is by prefix, so an override on `package-a` also suppresses the sweep's entry for `package-a/sub`.

## share

```ts
share(config: Record<string, SharedConfig>, projectPath?: string, skipList?: SkipList)
```

Takes an explicit map and expands it. Use it when you want to name the packages yourself:

```js
shared: share({
  '@angular/core': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  'rxjs':          { singleton: true, strictVersion: true, requiredVersion: 'auto' },
}),
```

For each entry it:

1. **Resolves `'auto'` versions.** The declared range is read from the nearest `package.json`; `version` is set to the same string with any leading range operator stripped.
2. **Adds transient dependencies.** Packages the shared ones depend on are discovered and added, so a shared package never resolves half of its imports out of a remote's own bundle.
3. **Adds secondary entry points**, unless told otherwise — see below.

### `requiredVersion: 'auto'`

Reading the version from `package.json` is what makes unmet peer dependencies and secondary entry points behave. Rather than repeating the option, call `setInferVersion(true)` once before building the map and leave `requiredVersion` off entirely.

### <a id="secondary-entry-points"></a> Secondary entry points

`includeSecondaries` defaults to **true**. For `@angular/common` that means `@angular/common/http`, `@angular/common/http/testing`, `@angular/common/upgrade` and the rest come along — usually more than you need. Sharing too much is not fatal (the runtime only loads what is imported), but shared packages cannot be tree-shaken, so the bundles are bigger.

Four shapes are accepted:

```js
includeSecondaries: false                                  // primary entry point only
includeSecondaries: true                                   // all of them
includeSecondaries: { skip: ['@angular/common/http/testing'] }
includeSecondaries: { resolveGlob: true }                  // expand wildcard exports
includeSecondaries: { keepAll: true }                      // exempt from ignoreUnusedDeps
```

`@angular/router/upgrade` and `@angular/common/upgrade` are always skipped.

**`resolveGlob`** expands wildcard `exports` in the package's `package.json`. It is off by default because it bundles every file the wildcard matches — only use it together with `features.ignoreUnusedDeps`. Wildcards work in `skip` too, so `{ skip: 'package-a/themes/xyz/*', resolveGlob: true }` expands the glob and then removes a branch of it.

**`keepAll`** exempts a package's secondaries from the unused-dependency pruning. Use it when a family of entry points must come from one build: if `mfe1` ships `@angular/core@20.1.0` and `mfe2` ships `@angular/core/rxjs-interop@20.0.8`, the host ends up mixing versions. `keepAll` on `@angular/core` keeps every entry point on the same build.

## Opting out

Two levers, and they act at different points:

- **`skip` in the config** is applied by `withNativeFederation` to the finished map. Use it for "share everything except these".
- **`skipList` on the helper** replaces `DEFAULT_SKIP_LIST` while the map is being built. Use it only when you need the defaults gone; otherwise you lose the protections they provide.

## Platform and build strategy

Two fields decide which bundle a shared package ends up in:

- `platform: 'browser' | 'node'` — inferred from the package name, overridable per entry.
- `build: 'default' | 'separate'` — `'default'` folds the package into that platform's single shared bundle; `'separate'` gives it its own, which is what you want for a package whose secondary entry points must stay together.

The builder bundles up to four groups accordingly: browser-shared, node-shared, and one bundle per separately-built package on each platform.

## Related

- [federation.config.js](configuration.md) — where the shared map lives.
- [Build Process](build-process.md) — when the bundling happens and what is cached.
- [Localization](../angular-adapter/localization.md) — `shareAngularLocales`, the Angular-specific case the helpers cannot resolve on their own.
