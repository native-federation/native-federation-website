# Adapter Configuration

> Reference for EsBuildAdapterConfig — extra esbuild plugins, framework presets, file replacements and loader mappings.

`EsBuildAdapterConfig` is the esbuild-specific extension point. You pass it as `adapterConfig` on [`runEsBuildBuilder`](builder.md) (or directly into `createEsBuildAdapter`). Its fields — all optional except `plugins` — control extra esbuild plugins, framework presets, entry-point rewriting, custom file loaders, and a handful of esbuild options passed straight through.

## Shape

```ts
import type * as esbuild from 'esbuild';

export interface EsBuildAdapterConfig {
  plugins: esbuild.Plugin[];
  fileReplacements?: Record<string, string | { file: string }>;
  loader?: { [ext: string]: esbuild.Loader };
  frameworks?: NfFrameworkPlugin[];
  define?: Record<string, string>;
  preserveSymlinks?: boolean;
  target?: string | string[];
  sourcemap?: esbuild.BuildOptions['sourcemap'];
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

Swaps the _entry-point file_ of a shared npm package before esbuild sees it. Imports in your own source are left alone. The key is matched against the end of the entry's path, on whole path segments, and only that end is replaced. The value is either a target path string or a `{ file: string }` object; the two forms are equivalent.

```ts
adapterConfig: {
  plugins: [],
  fileReplacements: {
    'node_modules/some-lib/index.js': 'node_modules/some-lib/dist/browser.js',
  },
}
```

Because keys match whole segments, `react/index.js` matches `node_modules/react/index.js` but not `node_modules/preact/index.js`. When several keys match the same file, the last one wins, so your keys always beat those of a [framework preset](#frameworks). Path separators are normalized to forward slashes before matching, so the same config works on Windows.

Typical uses:

- Point a library at a browser-only build when its `main` field resolves to a Node-only file.
- Feed esbuild a shim when a dependency's entry point does something esbuild cannot bundle (dynamic require on a directory, etc.).

## `frameworks`

A list of **framework presets** (`NfFrameworkPlugin[]`). Each preset bundles the esbuild settings a framework needs — file replacements, extra `resolveExtensions`, loaders and esbuild plugins — into one value you can reuse across projects. It defaults to an empty list.

React needs no preset: [CommonJS interop](react-interop.md#the-commonjs-plugin) is always on and the `process.env.NODE_ENV` define picks React's development or production build. `reactFrameworkPlugin()` is deprecated and returns an empty preset, so drop it from `frameworks`.

A preset is a plain object implementing `NfFrameworkPlugin`:

| Field | Type | Purpose |
| --- | --- | --- |
| `name` | `string` | Identifier for the framework — used in logs/debugging. |
| `fileReplacements` | `{ dev?, prod? }` | Maps of `<source path> → <replacement file>` applied to node-module entry points. The right map is picked automatically from the build's `dev` flag. |
| `resolveExtensions` | `string[]` | Extra esbuild `resolveExtensions` (e.g. `['.vue']`). Merged with the adapter's defaults. |
| `loader` | `Record<string, esbuild.Loader>` | esbuild loader overrides. Merged with `config.loader`; your own entries win. |
| `esbuildPlugins` | `esbuild.Plugin[]` | Framework-specific esbuild plugins. Prepended to `config.plugins`. |

A minimal custom preset:

```ts
import type { NfFrameworkPlugin } from '@softarc/native-federation-esbuild';
import vuePlugin from 'esbuild-plugin-vue3';

export function vueFrameworkPlugin(): NfFrameworkPlugin {
  return {
    name: 'vue',
    esbuildPlugins: [vuePlugin()],
    resolveExtensions: ['.vue'],
  };
}
```

When you supply multiple presets their contributions are merged. Your own top-level `EsBuildAdapterConfig` keys (`plugins`, `fileReplacements`, `loader`) take precedence over what a preset supplies.

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

## esbuild Passthroughs

Four esbuild options are forwarded as-is. Leave them unset to keep the adapter's defaults.

| Field | Applies to | Default | Notes |
| --- | --- | --- | --- |
| `define` | source-code bundle | — | esbuild [`define`](https://esbuild.github.io/api/#define): global identifiers replaced at build time, e.g. `{ 'process.env.API_URL': '"https://api.example.com"' }`. Values are code, so strings need their own quotes. |
| `target` | both bundles | `['esnext']` (source) / esbuild's default (node-modules) | esbuild [`target`](https://esbuild.github.io/api/#target), e.g. `'es2020'` or `['chrome100', 'safari15']`. |
| `sourcemap` | both bundles | from `dev` | esbuild [`sourcemap`](https://esbuild.github.io/api/#sourcemap): `true`, `false`, `'linked'`, `'inline'`, `'external'` or `'both'`. |
| `preserveSymlinks` | source-code bundle | `false` | esbuild [`preserveSymlinks`](https://esbuild.github.io/api/#preserve-symlinks). |

```ts
adapterConfig: {
  plugins: [],
  target: 'es2020',
  sourcemap: 'linked',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
}
```

## Shared Packages and the Cache

Shared npm packages are [cached](../../core/caching.md) across builds. The adapter keys that cache on the options its shared bundles are built with: `target`, `sourcemap`, `loader`, `fileReplacements`, the framework presets, and the adapter and esbuild versions. Changing any of them re-bundles the shared packages on the next build.

esbuild plugins take part by name only. If you change the options of a plugin that affects shared packages, delete the cache directory or run one build with `cacheExternalArtifacts: false`.

## What the Adapter Sets for You

The remaining esbuild options are fixed by the adapter:

| esbuild option | Value | Why |
| --- | --- | --- |
| `bundle` | `true` | Federation artifacts must be self-contained. |
| `format` | `'esm'` | The runtime loads remotes as ES modules via the import map. |
| `absWorkingDir` | `workspaceRoot` | Relative paths and output hashes resolve against the workspace root, whatever directory the build starts from. |
| `platform` | `'browser'` or `'node'` | Derived from the core's platform detection (see [Build Process](../../core/build-process.md)). |
| `splitting` | from `chunks` | Follows the core's [`chunks`](../../core/configuration.md#chunks) setting for the bundle being built — on by default. The chunks are written next to their entries and reported back to the core, which records them in `remoteEntry.json`. |
| `write` | `false` | The adapter writes files itself, so it can hash names and feed them to the federation cache. |
| `entryNames` | `'[name]-[hash]'` / `'[name]'` | Hashed when the core asks for hashed output, plain otherwise. |
| `resolveExtensions` | `.ts .tsx .mjs .js .cjs` (source) / `.mjs .js .cjs` (node-modules) | TypeScript is only resolved in the source-code bundle. Framework presets can add more (e.g. `.vue`). |
| `external` | from the core | All shared dependencies are marked external so they load via the import map. |
| `minify` | from `dev` | `dev: true` disables minification. |

The source-code bundle also gets the adapter's shared-mappings plugin ahead of your own `plugins` — see [Shared Mappings](#shared-mappings). Everything else flows from `EsBuildAdapterConfig` — extra plugins, framework presets, replaced entry paths, custom loaders, and the [passthroughs](#esbuild-passthroughs).

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
