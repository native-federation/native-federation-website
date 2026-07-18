---
applies_to: [v4]
---

# Adapter Configuration

> Reference for EsBuildAdapterConfig — extra esbuild plugins, framework presets, file replacements and loader mappings.

`EsBuildAdapterConfig` is the esbuild-specific extension point. You pass it as `adapterConfig` on [`runEsBuildBuilder`](builder.md) (or directly into `createEsBuildAdapter`). Four fields — all optional except `plugins` — control extra esbuild plugins, framework presets, entry-point rewriting, and custom file loaders.

## Shape

```ts
import type * as esbuild from 'esbuild';

export interface EsBuildAdapterConfig {
  plugins: esbuild.Plugin[];
  fileReplacements?: Record<string, string | { file: string }>;
  loader?: { [ext: string]: esbuild.Loader };
  frameworks?: NfFrameworkPlugin[];
}
```

## `plugins`

Extra esbuild plugins. They are applied to **both** esbuild contexts — the source-code bundle (your exposed modules and their local source files) and the node-modules bundle (shared dependencies). Use it for the usual esbuild extensions: Sass, CSS modules, SVGR, a GraphQL loader, etc.

```ts
import { sassPlugin } from 'esbuild-sass-plugin';

adapterConfig: {
  plugins: [sassPlugin()],
}
```

Plugins contributed by a [framework preset](#frameworks) (via its `esbuildPlugins`) are prepended to this list, so framework plugins run before your own.

## `fileReplacements`

Rewrites the _entry-point path_ of a shared dependency before esbuild sees it. The key is a string that will be matched as a regex against the end of the path; the value is either a target path string, or a `{ file: string }` object (the two forms are equivalent — strings are normalized to the object form internally).

```ts
adapterConfig: {
  plugins: [],
  fileReplacements: {
    'node_modules/react/index.js':
      'node_modules/react/cjs/react.production.min.js',
  },
}
```

Path separators are normalized to forward slashes before matching, so the same config works on Windows.

Typical uses:

- Swap a CJS wrapper for the pre-bundled variant it re-exports from — the canonical React example is on the [React & CommonJS Interop](react-interop.md) page.
- Point a library at a browser-only build when its `main` field resolves to a Node-only file.
- Feed esbuild a shim when a dependency's entry point does something esbuild cannot bundle (dynamic require on a directory, etc.).

## `frameworks`

A list of **framework presets** (`NfFrameworkPlugin[]`). Each preset bundles the esbuild settings a framework needs — file replacements, extra `resolveExtensions`, loaders, esbuild plugins, and whether the CommonJS interop plugin is required for the node-modules bundle.

If you omit `frameworks` entirely, the adapter applies the built-in **React preset** (`reactFrameworkPlugin()`) by default, so existing React setups keep working unchanged. Pass an empty array to opt out of all presets:

```ts
import { reactFrameworkPlugin } from '@softarc/native-federation-esbuild/frameworks/react';

adapterConfig: {
  plugins: [],
  frameworks: [reactFrameworkPlugin()], // optional — this is the default
}
```

```ts
adapterConfig: {
  plugins: [],
  frameworks: [], // disable the default React preset
}
```

A preset is a plain object implementing `NfFrameworkPlugin`:

| Field | Type | Purpose |
| --- | --- | --- |
| `name` | `string` | Identifier for the framework — used in logs/debugging. |
| `fileReplacements` | `{ dev?, prod? }` | Maps of `<source path> → <replacement file>` applied to node-module entry points. The right map is picked automatically from the build's `dev` flag. |
| `resolveExtensions` | `string[]` | Extra esbuild `resolveExtensions` (e.g. `['.vue']`). Merged with the adapter's defaults. |
| `loader` | `Record<string, esbuild.Loader>` | esbuild loader overrides. Merged with `config.loader`; your own entries win. |
| `esbuildPlugins` | `esbuild.Plugin[]` | Framework-specific esbuild plugins. Prepended to `config.plugins`. |
| `needsCommonJsPlugin` | `boolean` | Set `true` when the framework's runtime ships CommonJS (React). Triggers `@chialab/esbuild-plugin-commonjs` for the node-modules bundle. |

A minimal custom preset:

```ts
import type { NfFrameworkPlugin } from '@softarc/native-federation-esbuild';
import vuePlugin from 'esbuild-plugin-vue3';

export function vueFrameworkPlugin(): NfFrameworkPlugin {
  return {
    name: 'vue',
    esbuildPlugins: [vuePlugin()],
    resolveExtensions: ['.vue'],
    needsCommonJsPlugin: false,
  };
}
```

When you supply multiple presets their contributions are merged. Your own top-level `EsBuildAdapterConfig` keys (`plugins`, `fileReplacements`, `loader`) take precedence over what a preset supplies. See [React & CommonJS Interop](react-interop.md) for how the React preset works in practice.

## `loader`

Passed straight through to `esbuild.context()`'s `loader` option for both bundles. Map file extensions to esbuild's built-in loaders (`'file'`, `'dataurl'`, `'text'`, `'binary'`, `'json'`, `'copy'`, …):

```ts
adapterConfig: {
  plugins: [],
  loader: {
    '.svg': 'dataurl',
    '.png': 'file',
  },
}
```

## What the Adapter Sets for You

A few esbuild options are fixed by the adapter and cannot be overridden through `EsBuildAdapterConfig`. They are:

| esbuild option | Value | Why |
| --- | --- | --- |
| `bundle` | `true` | Federation artifacts must be self-contained. |
| `format` | `'esm'` | The runtime loads remotes as ES modules via the import map. |
| `platform` | `'browser'` or `'node'` | Derived from the core's platform detection (see [Build Process](../../core/build-process.md)). |
| `target` | `['esnext']` | Source-code bundle only. Downlevel in your own toolchain if needed. |
| `splitting` | `false` | Splitting is not yet supported; every entry is one file. |
| `write` | `false` | The adapter writes files itself, so it can hash names and feed them to the federation cache. |
| `entryNames` | `'[name]-[hash]'` / `'[name]'` | Hashed when the core asks for hashed output, plain otherwise. |
| `resolveExtensions` | `.ts .tsx .mjs .js .cjs` (source) / `.mjs .js .cjs` (node-modules) | TypeScript is only resolved in the source-code bundle. Framework presets can add more (e.g. `.vue`). |
| `external` | from the core | All shared dependencies are marked external so they load via the import map. |
| `sourcemap` / `minify` | from `dev` | `dev: true` enables sourcemaps and disables minification. |

Everything else flows from `EsBuildAdapterConfig` — extra plugins, framework presets, replaced entry paths, and custom loaders.
