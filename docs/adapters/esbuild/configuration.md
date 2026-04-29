---
applies_to: [v4]
---

# Adapter Configuration

> Reference for EsBuildAdapterConfig — extra esbuild plugins, file replacements, compensateExports and loader mappings.

`EsBuildAdapterConfig` is the esbuild-specific extension point. You pass it as `adapterConfig` on [`runEsBuildBuilder`](builder.md) (or directly into `createEsBuildAdapter`). Four fields — all optional except `plugins` — control extra esbuild plugins, entry-point rewriting, export compensation, and custom file loaders.

## Shape

```ts
import type * as esbuild from 'esbuild';

export interface EsBuildAdapterConfig {
  plugins: esbuild.Plugin[];
  fileReplacements?: Record<string, string | { file: string }>;
  compensateExports?: RegExp[];
  loader?: { [ext: string]: esbuild.Loader };
}
```

## `plugins`

Extra esbuild plugins applied to the **source-code** esbuild context — the one that bundles your exposed modules and their local source files. Use it for the usual esbuild extensions: Sass, CSS modules, SVGR, a GraphQL loader, etc.

```ts
import { sassPlugin } from 'esbuild-sass-plugin';

adapterConfig: {
  plugins: [sassPlugin()],
}
```

> **Note:** Plugins are _not_ forwarded to the node-modules bundle. That bundle always runs `@chialab/esbuild-plugin-commonjs` and defines `process.env.NODE_ENV` — it is intentionally opaque. If you need to patch a node-module's build, use `fileReplacements` instead of a plugin.

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

## `compensateExports`

List of regexes matched against module paths. Matching dependencies go through the core's **export compensation** pass, which parses the CJS/ESM output with `acorn` and synthesises a small re-export shim so named imports resolve to the same identity as the default import. The default is:

```ts
compensateExports: [/react/]
```

You usually do not need to touch this. Extend the list only when you share another CJS library that exposes named exports through an `exports.*` pattern — typically something older in the React ecosystem. See [React & CommonJS Interop](react-interop.md) for a deeper look at why React in particular needs it.

## `loader`

Passed straight through to `esbuild.context()`'s `loader` option for the source-code bundle. Map file extensions to esbuild's built-in loaders (`'file'`, `'dataurl'`, `'text'`, `'binary'`, `'json'`, `'copy'`, …):

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
| `resolveExtensions` | `.ts .tsx .mjs .js .cjs` (source) / `.mjs .js .cjs` (node-modules) | TypeScript is only resolved in the source-code bundle. |
| `external` | from the core | All shared dependencies are marked external so they load via the import map. |
| `sourcemap` / `minify` | from `dev` | `dev: true` enables sourcemaps and disables minification. |

Everything else flows from `EsBuildAdapterConfig` — extra plugins, replaced entry paths, custom loaders, and the export-compensation list.
