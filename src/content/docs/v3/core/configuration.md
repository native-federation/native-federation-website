# federation.config.js

> Every option on withNativeFederation — name, exposes, shared, sharedMappings, skip, externals and the feature flags.

Each federated application has one `federation.config.js` in its project folder. It is a CommonJS module exporting the result of `withNativeFederation`, which normalizes the object into the shape the builder consumes.

```js
const { withNativeFederation, shareAll } = require('@softarc/native-federation/build');

module.exports = withNativeFederation({
  name: 'mfe1',
  exposes: { './component': './mfe1/component.ts' },
  shared: { ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }) },
  sharedMappings: ['shared-lib'],
  skip: ['my-internal-lib'],
  externals: [],
  features: { ignoreUnusedDeps: true },
});
```

The builder resolves the file relative to `workspaceRoot` using the `federationConfig` option — the Angular adapter infers it as a sibling of the project's `tsconfig.json`.

## Options

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `name` | string | `''` | The application's name. It becomes `remoteEntry.json`'s `name`, is the fallback remote name at runtime, and names the project's bundle cache folder. |
| `exposes` | `Record<string, string>` | `{}` | Maps an exposed key (`'./component'`) to a source file. Each becomes an entry in `remoteEntry.json`'s `exposes[]` and is bundled as its own file. |
| `shared` | `Record<string, SharedConfig>` | `shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto', platform: 'browser' })` | The packages to share. Almost always produced by [`share` or `shareAll`](sharing.md). |
| `sharedMappings` | `string[]` | every `paths` entry in the root tsconfig | Monorepo-internal libraries to share, named by their tsconfig path alias. A `*` suffix matches a prefix. |
| `skip` | `SkipList` | `[]` | Strings, regular expressions or predicates. Matching entries are dropped from `shared` and `sharedMappings`. |
| `externals` | `string[]` | `[]` | Extra package names to mark external without sharing them. They join `federationBuilder.externals` but get no import-map entry. |
| `features` | object | see below | Opt-in behaviours. |

### SharedConfig

Each entry under `shared` accepts:

| Field | Default | Meaning |
| --- | --- | --- |
| `requiredVersion` | `'auto'` | The semver range consumers must satisfy. `'auto'` reads the version from the nearest `package.json`. |
| `version` | derived | The concrete version shipped. Written into `remoteEntry.json`; the runtime deduplicates on `packageName@version`. |
| `singleton` | `false` | Only one instance may be loaded at runtime. |
| `strictVersion` | `false` | Turn a version mismatch into an error rather than a warning. |
| `includeSecondaries` | `true` | Also share the package's secondary entry points. Accepts `{ skip, resolveGlob, keepAll }` — see [Sharing](sharing.md#secondary-entry-points). |
| `platform` | inferred | `'browser'` or `'node'`. `@angular/platform-server`, `@angular/platform-server/init` and `@angular/ssr` default to `'node'`; everything else to `'browser'`. |
| `build` | `'default'` | `'separate'` bundles the package on its own instead of into the shared bundle for its platform. |
| `packageInfo` | resolved | `{ entryPoint, version, esm }`. Set it to point at a file the resolver cannot find on its own — this is how `shareAngularLocales` works. |
| `transient` | — | Deprecated. Setting it logs a warning; transient dependencies are handled by the bundler. |

## <a id="feature-flags"></a> Feature flags

```js
features: {
  ignoreUnusedDeps: true,
  mappingVersion: false,
}
```

**`ignoreUnusedDeps`** (default `false`) walks the module graph from your entry point and drops every shared package and shared mapping nothing actually imports. It needs `FederationOptions.entryPoint` — the config loader throws `The feature ignoreUnusedDeps needs the application's entry point` when it is missing. Transient dependencies of the packages that survive are kept.

With the flag **off**, `withNativeFederation` additionally strips every `@angular/common/locales*` key from `shared`, because sharing all of Angular's locale data is rarely what anyone wants. Turning the flag on keeps them and lets the graph walk decide. See [Localization](../angular-adapter/localization.md).

**`mappingVersion`** (default `false`) stamps a `version` on shared mappings, read from the `package.json` next to (or one level above) the mapping's entry file. Without it, shared mappings ship with an empty version string, so the runtime treats every remote's copy as its own.

## Skip lists

`skip` accepts three kinds of entry:

```js
skip: [
  'my-internal-lib',                  // exact package name
  /\/testing(\/|$)/,                  // regular expression
  (pkg) => pkg.startsWith('@acme/'),  // predicate
]
```

Your `skip` list is applied by `withNativeFederation` to the normalized result. Separately, `share` and `shareAll` filter against the core's `DEFAULT_SKIP_LIST` while they build their map — pass `{ skipList: [...] }` to those helpers to replace it. `DEFAULT_SKIP_LIST` covers the Native Federation packages themselves, `es-module-shims`, `zone.js`, `tslib/`, `express`, `@angular/localize` and its sub-entries, `/schematics` paths, `@nx/angular*`, every `@angular/*/testing` entry point and every `@types/*` package.

## Shared mappings

Path aliases in the root `tsconfig.json` (or `tsconfig.base.json`) are shared by default, so a monorepo library is loaded once rather than bundled into every remote:

```json
{
  "compilerOptions": {
    "paths": {
      "shared-lib": ["libs/shared-lib/index.ts"]
    }
  }
}
```

Narrow the set with `sharedMappings` (a `*` suffix matches by prefix) or remove entries with `skip`. Two constraints apply: an alias mapping to more than one path falls back to the first with a warning, and an alias containing a dot throws — Vite cannot resolve those reliably.

## Related

- [Sharing Dependencies](sharing.md) — what `share` and `shareAll` do to the map you hand them.
- [Build Process](build-process.md) — how the normalized config drives the build.
- [Angular Config](../angular-adapter/configuration.md) — the Angular adapter's view of the same file.
