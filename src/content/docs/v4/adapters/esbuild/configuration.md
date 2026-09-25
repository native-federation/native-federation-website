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
| `splitting` | from `chunks` | Follows the core's [`chunks`](../../core/configuration.md#chunks) setting for the bundle being built — on by default. The chunks are written next to their entries and reported back to the core, which records them in `remoteEntry.json`. |
| `write` | `false` | The adapter writes files itself, so it can hash names and feed them to the federation cache. |
| `entryNames` | `'[name]-[hash]'` / `'[name]'` | Hashed when the core asks for hashed output, plain otherwise. |
| `resolveExtensions` | `.ts .tsx .mjs .js .cjs` (source) / `.mjs .js .cjs` (node-modules) | TypeScript is only resolved in the source-code bundle. Framework presets can add more (e.g. `.vue`). |
| `external` | from the core | All shared dependencies are marked external so they load via the import map. |
| `sourcemap` / `minify` | from `dev` | `dev: true` enables sourcemaps and disables minification. |

The source-code bundle also gets the adapter's shared-mappings plugin ahead of your own `plugins` — see [Shared Mappings](#shared-mappings). Everything else flows from `EsBuildAdapterConfig` — extra plugins, framework presets, replaced entry paths, and custom loaders.

## Shared Mappings

esbuild's `external` list matches an import specifier as written. An import spelled `@my-org/ui` stays external, but a relative import that reaches into the same library — `../../libs/ui/src/button` — would be bundled into the consumer next to the federated copy, leaving two instances of one library at runtime.

Whenever the build has [shared mappings](../../core/configuration.md#sharedmappings), the adapter adds a plugin to the source-code bundle that checks every relative `import` statement. Where the imported file sits inside a shared mapping and the mapping's entry point re-exports it under the same names, the import is rewritten onto the mapping's specifier and left external. Where the entry point is readable and omits the file, the build warns and names the symbols to add to the barrel. The rule itself lives in the core — see `createMappingImportResolver` in the [API Reference](../../core/api-reference.md#softarcnative-federationinternal).

The plugin resets its state at the start of every build, so an edited barrel is picked up by the next watch-mode rebuild. There is nothing to configure.

## Skip Lists

The adapter ships two ready-made skip lists to pass as `skipList` to the core's `shareAll` or `share`, or to `fromPackageJson(...).skip(...)`:

| Export | Entry point | Contents |
| --- | --- | --- |
| `ESBUILD_SKIP_LIST` | `@softarc/native-federation-esbuild/config` | The core's [`DEFAULT_SKIP_LIST`](../../core/configuration.md#the-default-skip-list) plus the adapter's subpath entry points (`/config`, `/domain`, `/frameworks/react`). `DEFAULT_SKIP_LIST` matches strings exactly, so it only covers the adapter's root entry. |
| `REACT_SKIP_LIST` | `@softarc/native-federation-esbuild/frameworks/react` | `ESBUILD_SKIP_LIST` plus React DOM's server, static, test and profiling entry points. See [React & CommonJS Interop](react-interop.md#skip-the-server-exports). |

```js
import { withNativeFederation, shareAll } from '@softarc/native-federation/config';
import { ESBUILD_SKIP_LIST } from '@softarc/native-federation-esbuild/config';

export default withNativeFederation({
  name: 'mfe1',
  exposes: { './component': './src/component.ts' },
  shared: shareAll(
    { singleton: true, strictVersion: true, requiredVersion: 'auto' },
    { skipList: [...ESBUILD_SKIP_LIST, /^@my-org\/internal/] }
  ),
});
```

A `skipList` handed to `shareAll` or `share` replaces `DEFAULT_SKIP_LIST` rather than extending it, which is why both lists spread the core defaults in. `fromPackageJson(...).skip(...)` adds to the defaults instead, so either list works there too. See [core configuration → skip](../../core/configuration.md#skip) for how a skip list differs from the top-level `skip` option.
