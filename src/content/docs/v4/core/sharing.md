# Sharing Dependencies

> How to share dependencies with Native Federation — share, shareAll, secondary entry points, code-splitting and the build mode.

Shared dependencies are the mechanism that lets hosts and remotes load the same library once and reuse it at runtime. This page covers the `fromPackageJson`, `share` and `shareAll` helpers and the options that govern each shared entry.

## `fromPackageJson` (recommended)

Since v4.3, `fromPackageJson` is the recommended way to share your dependencies. It shares **all** dependencies found in your `package.json` and returns a small fluent builder so you can fine-tune the result. The base options you pass are applied to every shared dependency; you then chain `.filter(...)`, `.skip(...)`, `.override(...)` and `.patch(...)` as needed and finish with `.get()`:

```js
import {
  withNativeFederation,
  fromPackageJson,
} from "@softarc/native-federation/config";

export default withNativeFederation({
  name: "host",
  shared: fromPackageJson({
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
    includeSecondaries: false,
  }).get(),
});
```

> **Note:** If you omit the `shared` property entirely, Native Federation applies exactly this `fromPackageJson` configuration for you (with `singleton`, `strictVersion` and `requiredVersion: 'auto'`). So the snippet above is also a good description of the default behavior.

The builder offers four chainable methods, each of which returns the builder so you can combine them:

- **`.filter(patterns)`** — since v4.7. Share only the `package.json` dependencies matching these patterns (e.g. `['@angular/*', 'rxjs']`). Repeated calls add to the selection; omit it to share every dependency. Packages added through `.override(...)` are unaffected, and patching a package the filter excluded is ignored with a warning.
- **`.skip(externals)`** — exclude packages from sharing (added on top of the [default skip list](configuration.md#the-default-skip-list)).
- **`.override(externals)`** — replace the configuration for specific packages entirely. Use this when a package needs a completely different set of options.
- **`.patch(externals, cfg)`** — merge a partial configuration onto specific shared externals, keeping the base options for everything you don't touch.

```js
import {
  withNativeFederation,
  fromPackageJson,
} from "@softarc/native-federation/config";

export default withNativeFederation({
  name: "host",
  shared: fromPackageJson({
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
  })
    // Don't share these dependencies at all
    .skip(["my-lib", "some-dev-only-lib"])
    // Give a package a completely different configuration
    .override({
      "package-a/themes/xyz": {
        singleton: true,
        strictVersion: true,
        requiredVersion: "auto",
        includeSecondaries: { skip: "@package-a/themes/xyz/*" },
        build: "package",
      },
    })
    // Tweak a few options on specific packages while keeping the base config
    .patch(["package-b"], {
      singleton: false,
      includeSecondaries: { skip: "package-b/icons/*" },
      build: "package",
    })
    .get(),
});
```

Since v4.7 the trailing `.get()` is optional: `shared` also accepts the builder itself, and `withNativeFederation` calls `.get()` for you.

By default the closest `package.json` (relative to your `federation.config.mjs`) is used. You can point at a different one by passing its path as the second argument: `fromPackageJson(baseCfg, projectPath)`.

## Alternative: the `shareAll` helper

`shareAll` is the older, object-spread style alternative to `fromPackageJson`. It also shares _every_ production dependency declared in your `package.json`, but instead of a fluent builder it returns a plain object that you spread into `shared`. Pass a single options object — these options are applied to every discovered dependency:

```js
import {
  withNativeFederation,
  shareAll,
} from "@softarc/native-federation/config";

export default withNativeFederation({
  name: "host",
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: "auto",
      includeSecondaries: false,
    }),
  },
});
```

### Per-Package Overrides

Since v21.1, `shareAll` accepts an `overrides` option to deviate from the defaults for specific packages:

```js
...shareAll(
  { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  {
    overrides: {
      'package-a/themes/xyz': {
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
        includeSecondaries: { skip: '@package-a/themes/xyz/*' },
        build: 'package',
      },
      'package-b': {
        singleton: false,
        strictVersion: true,
        requiredVersion: 'auto',
        includeSecondaries: { skip: 'package-b/icons/*' },
        build: 'package',
      },
    },
  }
)
```

## `share`

Use `share` when you want to hand-pick which dependencies are shared and configure each one individually:

```js
import { share } from "@softarc/native-federation/config";

shared: share({
  "package-a": {
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
    includeSecondaries: true,
  },
});
```

## Per-Package Options

| Option               | Type                                           | Default        | Description                                                                                                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `singleton`          | `boolean`                                      | `false`        | Only one instance of this package is ever loaded at runtime. Required for libraries with internal state (Angular, React, zone.js, …).                                                                                                                                                                       |
| `strictVersion`      | `boolean`                                      | `false`        | Throw at runtime instead of falling back when a version mismatch is detected.                                                                                                                                                                                                                               |
| `requiredVersion`    | `string \| 'auto' \| { version?, range? }`      | `'auto'`       | The required semver range. `'auto'` reads the actual version from the closest `package.json`; the object form also [picks the range that is emitted](#choosing-the-emitted-range).                                                                                                                          |
| `version`            | `string`                                       | inferred       | The version that is being shared. Usually inferred from `package.json`.                                                                                                                                                                                                                                     |
| `includeSecondaries` | `boolean \| { skip?, resolveGlob?, keepAll? }` | `true`         | Also share the package's secondary entry points. See below.                                                                                                                                                                                                                                                 |
| `platform`           | `'browser' \| 'node'`                          | config default | Target platform for this shared bundle.                                                                                                                                                                                                                                                                     |
| `build`              | `'default' \| 'separate' \| 'package'`         | `'default'`    | How the shared external is bundled. `'default'` groups all `default` shared externals into one build step. `'separate'` builds the entry on its own. `'package'` builds the entry plus its secondaries as an isolated package bundle — required when you want per-package `chunks` settings to take effect. |
| `chunks`             | `boolean`                                      | config default | Enable or disable code-splitting for this specific package.                                                                                                                                                                                                                                                 |
| `shareScope`         | `string`                                       | config default | Optional share-scope override for this package.                                                                                                                                                                                                                                                             |
| `pool`               | `string`                                       | –              | Since v4.3. Optional resource-pool hint for this shared external. Passed through to `remoteEntry.json` and consumed by the orchestrator; the core build does not act on it.                                                                                                                                 |

### `requiredVersion: 'auto'`

With `'auto'`, the helper looks up the version in the closest `package.json`. This helps resolve unmet peer dependencies and is the recommended default.

### Choosing the emitted range

A detected version is emitted exactly as your `package.json` spells it — `^1.2.3` stays `^1.2.3`. Since v4.5, passing an object instead lets you pick the format:

```js
shared: share({
  "@my-org/lib": { singleton: true, requiredVersion: { range: "^" } },
});
```

| `range`   | `1.2.3` becomes |
| --------- | --------------- |
| `'exact'` | `1.2.3`         |
| `'^'`     | `^1.2.3`        |
| `'~'`     | `~1.2.3`        |
| `'minor'` | `^1.2.3`        |
| `'patch'` | `~1.2.3`        |

Any prefix already on the detected version is replaced, and a prerelease tag is kept (`2.0.0-next.1` becomes `^2.0.0-next.1`). A multi-comparator range such as `>=1.0.0 <2.0.0` has no single prefix to rewrite, so it is passed through untouched.

Set `version` alongside `range` to format a version of your own instead of the detected one. `version: 'auto'` means "look the version up", so inside `share()` it takes precedence over a `version` set next to it and falls back to the `package.json` lookup — which fails if the package is not declared there.

## Secondary Entry Points

Many packages expose more than one entry point (e.g. `@angular/common` also ships `@angular/common/http`, `@angular/common/testing`, …). `includeSecondaries` controls how they are handled.

### `true` — include all secondaries

Every directory under the package that contains a `package.json` or that is listed in `exports` becomes its own shared entry:

```js
shared: share({
  "@angular/common": {
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
    includeSecondaries: true,
  },
});
```

### `{ skip: ... }` — include but filter

```js
shared: share({
  "@angular/common": {
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
    includeSecondaries: {
      skip: ["@angular/common/http/testing"],
    },
  },
});
```

### `{ resolveGlob: true }` — expand glob exports

Some packages declare wildcard exports in their `package.json` — for example RxJS exposes `./internal/*`. By default, the `share` helper only emits a bundle for _exact_ entry points, so an import like `rxjs/internal/observable/of` crashes at runtime (the import map only resolves exact matches, never glob paths). Since v21 you can opt in to glob resolution:

```js
shared: share({
  rxjs: {
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
    includeSecondaries: { resolveGlob: true },
  },
});
```

The helper walks the glob and produces a shared bundle for every file it matches — that's _every_ valid file under the glob, recursively. For RxJS this can easily add 300+ entries to `remoteEntry.json`. **Only use `resolveGlob` together with the `ignoreUnusedDeps` feature flag** so the builder prunes anything the entry points don't actually import. You can also narrow the scope yourself with `skip`, which accepts wildcards:

```js
includeSecondaries: {
  resolveGlob: true,
  skip: ['rxjs/internal/testing/*'],
}
```

> **Note:** **Why this happens.** Native Federation treats a shared package as an opaque external for your app bundler. The app bundler sees `rxjs/internal/observable/of`, marks it external, and hands the exact specifier to the import map at runtime. The import map has no wildcard semantics, so unless the exact specifier is listed, the browser throws a module-not-found error. `resolveGlob` fixes this by pre-materializing every match into `remoteEntry.json`.

### `{ keepAll: true }` — opt out of unused-dep removal

When `ignoreUnusedDeps` is active and you want _all_ secondaries of a package to survive — to guarantee a single, consistent version across every remote — use `keepAll`:

```js
shared: share({
  "@angular/core": {
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
    includeSecondaries: { keepAll: true },
  },
});
```

Since v4.5, `keepAll` is read per **package family** rather than per entry point: every entry point of `@angular/core` is published as long as _something_ still reaches `@angular/core`, while a family nothing imports at all is pruned anyway. That is what keeps the flag meaningful when it is applied to every package at once — it exempts the secondaries from reachability, not the package itself. For a package without secondaries the family is the package, so the flag is a no-op there. To publish everything unconditionally, turn [`ignoreUnusedDeps`](configuration.md#feature-flags) off instead — wildcard `sharedMappings` then still need [`resolveGlob: true`](configuration.md#keeping-mappings-that-nothing-imports).

> **Note:** A [shared mapping](configuration.md#keeping-mappings-that-nothing-imports) reads the same flag more strongly — there it exempts the mapping from reachability entirely, and a bare `includeSecondaries: true` means the same thing.

See [Downsides of treeshaking shared packages](#downsides-of-treeshaking-shared-packages) below for the scenario this protects against.

## Skipping Dependencies

> **Note:** **"Skip" is not the same as "don't load".** A skipped package is _not_ excluded from the micro-frontend — otherwise the app couldn't run on its own. Skip only prevents the package from being _extracted into a shared bundle_. The package itself is still inlined into the micro-frontend or its shared externals.

Use the top-level `skip` option to opt out of sharing specific entries — including mapped paths from your `tsconfig`:

```js
export default withNativeFederation({
  skip: [
    "rxjs/ajax",
    "rxjs/fetch",
    "rxjs/testing",
    "rxjs/webSocket",
    /^@org\/internal-/,
  ],
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: "auto",
    }),
  },
});
```

Entries accept three forms — matched against the full package name including any secondary entry point:

- `string` — exact match (e.g. `'rxjs/testing'` skips only that secondary; to skip an entire package and its secondaries use a function or regexp).
- `RegExp` — tested with `.test(name)`.
- `(name: string) => boolean` — a predicate, useful for prefix matches like `(pkg) => pkg.startsWith('@angular/cdk')`.

The skip list you provide is merged with [`DEFAULT_SKIP_LIST`](configuration.md#the-default-skip-list), which already excludes the Native Federation packages themselves, `es-module-shims`, `tslib/` and everything under `@types/`.

## Pseudo-treeshaking via deep imports

Once a dependency is _shared_, the bundler can no longer tree-shake it: the shared bundle has to contain every symbol that _any_ consumer might ever import at runtime. For a library like RxJS that's a lot of bytes when all you actually use is `of`.

A pragmatic workaround is to share only the specific deep entry point you use — the rest of the library never enters a shared bundle and stays local to the micro-frontend, where it _can_ be tree-shaken:

```js
// app code
import { of } from "rxjs/internal/observable/of";
```

Pair this with `includeSecondaries: { resolveGlob: true }` and `ignoreUnusedDeps: true` so only the deep entries you actually touch make it into `remoteEntry.json`. The rule of thumb: measure before committing. If only one remote imports a couple of symbols, sharing the package at all may cost more than it saves.

## Downsides of treeshaking shared packages

`ignoreUnusedDeps` is enabled by default and almost always the right choice — but there is a failure mode to be aware of, especially for core framework libraries.

Imagine two remotes, each sharing `@angular/core`: `mfe1` on `21.0.2` and `mfe2` on `21.0.1`. The orchestrator picks `21.0.2` as the winning version. But if `mfe1` never imports `@angular/core/rxjs-interop`, that secondary is pruned from its `remoteEntry.json`. The orchestrator then falls back to `mfe2`'s copy of `rxjs-interop` — at version `21.0.1`. Now Angular is split across two versions, which is exactly the class of bug shared dependencies are supposed to prevent.

> [!TIP] **See this live in the DevTools.** The [Native Federation DevTools](../devtools.md) Packages tab lists the entries under `@angular/core` with the version each one resolved to, so a `/rxjs-interop` entry at `21.0.1` next to a `21.0.2` main entry stands out immediately — and the Graph tab draws the borrowed copy as a dotted edge.

Use `keepAll: true` on such packages to publish _all_ their secondaries, regardless of which ones the entry points touch:

```js
shared: share({
  "@angular/core": {
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
    includeSecondaries: { keepAll: true },
  },
});
```

The package itself still has to be reached from an entry point — `keepAll` covers the spread across a package's entry points, and [`ignoreUnusedDeps: false`](configuration.md#feature-flags) covers a package nothing imports at all.

As a rule of thumb, opt into `keepAll` for tightly-coupled framework packages (Angular, React ecosystems, your own design system) and leave it off for utility libraries where secondaries are genuinely independent.

## Code-Splitting

By default, large shared libraries are split into chunks that load on demand. Control this at two levels:

### Global

```js
export default withNativeFederation({
  chunks: false, // disable code-splitting for every shared entry
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: "auto",
    }),
  },
});
```

### Per-Package

```js
export default withNativeFederation({
  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: "auto" },
      {
        overrides: {
          "large-lib": {
            singleton: true,
            strictVersion: true,
            requiredVersion: "auto",
            chunks: false,
            build: "package", // required for per-package chunk settings to take effect
          },
        },
      },
    ),
  },
});
```

> **Note:** Per-package `chunks` settings are only honored when `build` is set to `'package'` (or `'separate'`). `'default'` externals share one build step, so their `chunks` value is overridden by the top-level config.

### Dense Chunking

Enable `features.denseChunking` to group chunks by bundle name in `remoteEntry.json`. Each shared entry then references its chunk bundle by name rather than listing every chunk individually, producing a smaller and more cache-friendly manifest:

```js
features: {
  denseChunking: true;
}
```

### Dense Externals

Since v4.3, the `denseExternals` feature flag reshapes the `shared` array in `remoteEntry.json` so that all entrypoints of a shared external — its primary import plus every secondary and shared mapping — are grouped under a single object:

```js
features: {
  denseExternals: true;
}
```

When enabled, instead of one flat entry per entrypoint, each package becomes one object whose `entries` map keys the full import name to its output file (e.g. `{ "@angular/common": "…", "@angular/common/http": "…" }`). Entrypoints are grouped only when all their metadata matches — everything except the output file and the `dev` hint, so `singleton`, `strictVersion`, `requiredVersion`, `version`, `shareScope`, `pool` and `bundle` included (since v4.7; earlier versions compared the first five and kept the first entry's `bundle` for the whole group). `importmap.json` is unaffected.

> **Note:** Since v4.4 the array is uniformly dense — bundler chunks (`@nf-internal/chunk-…`) are emitted in the same `entries` shape rather than staying flat, so a consumer only has to handle one entry shape. A chunk is never grouped with anything: it gets its own single-key `entries` map.

The flag is opt-in and fully backward compatible: the runtime auto-detects each entry by shape, so both old and new `remoteEntry.json` load. It is orthogonal to `denseChunking` — the two can be combined. See [Build Artifacts](artifacts.md#dense-externals) for the resulting `remoteEntry.json` shape.

## CommonJS externals

Since v4.4, the `synthesizeCjsExports` feature flag (**on by default**) makes named imports work for shared dependencies that are still CommonJS.

The problem it solves is the module boundary. A shared external is bundled to ESM and handed to the browser through the import map. When the package's entry point is CJS, the bundler can only see a single default export, so `import { debounce } from 'lodash'` resolves to nothing at runtime even though the property exists on the object.

With the flag on, the core detects a CommonJS entry point, loads it during the build, and generates a small ESM entry that re-exports the names the module actually has. The result is a shared bundle with real named exports, so `import { debounce } from 'lodash'` works.

ESM packages are left untouched, and detection is deliberately conservative: extension, the nearest `package.json` `type` and finally the source itself all have to point at CommonJS before a package is wrapped.

If the package can't be loaded at build time, the external stays default-only and the build warns:

```
[native-federation] Could not enumerate named exports of "…" at build time (…);
falling back to default-only. Named imports from this package may fail across the
module boundary.
```

Set the flag to `false` to skip the pass entirely — worth doing if a dependency has import side effects you don't want running at build time:

```js
features: {
  synthesizeCjsExports: false,
}
```

## Shared mappings

Monorepo-internal libraries mapped through your `tsconfig` `paths` are shared too, and since v4.4 they accept per-mapping configuration with the same vocabulary as this page: `singleton`, `strictVersion`, `requiredVersion`, `version`, `shareScope`, `pool` and `includeSecondaries`.

```js
sharedMappings: [
  '@my-org/auth-lib',
  [['@my-org/ui/*'], { singleton: false }],
],
```

Since v4.6, `requiredVersion` takes the same [object form](#choosing-the-emitted-range) as a shared package, so a mapping can follow its library's version and still choose the range:

```js
sharedMappings: [[['@my-org/ui/*'], { requiredVersion: { range: '^' } }]],
```

A mapped path defaults to `~<version>` — an in-workspace library moves in lockstep with nothing, so `~` is the safest bet — and that default also holds for an object that names no `range`. It is the one place mappings differ from a shared package.

Since v4.7 a mapping also honours `build`: by default every mapping lands in one bundle, and `build: 'separate'` or `build: 'package'` gives it a bundle of its own (see [Mapping bundles](configuration.md#mapping-bundles)). `platform`, `chunks` and `packageInfo` are still ignored for mappings. See [sharedMappings](configuration.md#sharedmappings) for the builder (`mappingsFromWorkspace`), the `keepAll` / `resolveGlob` interaction with `ignoreUnusedDeps`, and the barrel-import rule.
