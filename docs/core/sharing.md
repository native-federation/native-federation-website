---
applies_to: [v4]
---

# Sharing Dependencies

> How to share dependencies with Native Federation — share, shareAll, secondary entry points, code-splitting and the build mode.

Shared dependencies are the mechanism that lets hosts and remotes load the same library once and reuse it at runtime. This page covers the `fromPackageJson`, `share` and `shareAll` helpers and the options that govern each shared entry.

## `fromPackageJson` (recommended)

Since v4.3, `fromPackageJson` is the recommended way to share your dependencies. It shares **all** dependencies found in your `package.json` and returns a small fluent builder so you can fine-tune the result. The base options you pass are applied to every shared dependency; you then chain `.skip(...)`, `.override(...)` and `.patch(...)` as needed and finish with `.get()`:

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

The builder offers three chainable methods, each of which returns the builder so you can combine them:

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
| `requiredVersion`    | `string \| 'auto'`                             | `'auto'`       | The required semver range. `'auto'` reads the actual version from the closest `package.json`.                                                                                                                                                                                                               |
| `version`            | `string`                                       | inferred       | The version that is being shared. Usually inferred from `package.json`.                                                                                                                                                                                                                                     |
| `includeSecondaries` | `boolean \| { skip?, resolveGlob?, keepAll? }` | `true`         | Also share the package's secondary entry points. See below.                                                                                                                                                                                                                                                 |
| `platform`           | `'browser' \| 'node'`                          | config default | Target platform for this shared bundle.                                                                                                                                                                                                                                                                     |
| `build`              | `'default' \| 'separate' \| 'package'`         | `'default'`    | How the shared external is bundled. `'default'` groups all `default` shared externals into one build step. `'separate'` builds the entry on its own. `'package'` builds the entry plus its secondaries as an isolated package bundle — required when you want per-package `chunks` settings to take effect. |
| `chunks`             | `boolean`                                      | config default | Enable or disable code-splitting for this specific package.                                                                                                                                                                                                                                                 |
| `shareScope`         | `string`                                       | config default | Optional share-scope override for this package.                                                                                                                                                                                                                                                             |
| `pool`               | `string`                                       | –              | Since v4.3. Optional resource-pool hint for this shared external. Passed through to `remoteEntry.json` and consumed by the orchestrator; the core build does not act on it.                                                                                                                                 |

### `requiredVersion: 'auto'`

With `'auto'`, the helper looks up the version in the closest `package.json`. This helps resolve unmet peer dependencies and is the recommended default.

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

Use `keepAll: true` on such packages to force _all_ secondaries to be shared regardless of what the entry points touch:

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

When enabled, instead of one flat entry per entrypoint, each package becomes one object whose `entries` map keys the full import name to its output file (e.g. `{ "@angular/common": "…", "@angular/common/http": "…" }`). Entrypoints whose sharing metadata (`singleton`, `strictVersion`, `requiredVersion`, `version`, `shareScope`) diverges are split into separate groups. Bundler chunks stay flat, and `importmap.json` is unaffected.

The flag is opt-in and fully backward compatible: the runtime auto-detects each entry by shape, so both old and new `remoteEntry.json` load. It is orthogonal to `denseChunking` — the two can be combined. See [Build Artifacts](artifacts.md#dense-externals) for the resulting `remoteEntry.json` shape.
