# Build Adapters

> The NFBuildAdapter contract — how Native Federation Core delegates the actual bundling step to a pluggable, bundler-specific adapter.

The core library doesn't ship a bundler. Instead, it defines a contract — `NFBuildAdapter` — and delegates the actual compilation to an adapter. That's what makes Native Federation bundler-agnostic.

## The Contract

A build adapter is an object implementing three methods, plus a few optional members:

```ts
export interface NFBuildAdapter {
  readonly externalsCacheKey?: ExternalsCacheKey; // { adapter: string; options?: Record<string, string | number | boolean> }
  readonly externals?: readonly string[];

  setup(name: string, options: NFBuildAdapterOptions): Promise<void>;

  build(
    name: string,
    opts?: { modifiedFiles?: string[]; signal?: AbortSignal }
  ): Promise<NFBuildAdapterResult[]>;

  dispose(name?: string): Promise<void>;

  cacheData?(name: string): unknown | Promise<unknown>;
}
```

The core calls these in phases. Each phase uses a unique `name` — for example `'browser-shared'`, `'node-shared'`, `'browser-<pkg>'`, or `'exposed'` — so an adapter can maintain one persistent context per phase (useful for watch mode and incremental compile).

`externalsCacheKey` names the adapter and the options that change its shared bundles, and takes part in the [externals cache](caching.md#the-checksum) checksum. `externals` lists imports the adapter adds itself (a dev client, a polyfill), so users don't have to list them, and `cacheData` stores data alongside a cached shared bundle — see [Build Your Own Adapter](../adapters/build-your-own.md#1-the-contract).

## `NFBuildAdapterOptions`

The options object tells the adapter exactly what to compile in a given phase:

| Field | Type | Description |
| --- | --- | --- |
| `entryPoints` | `EntryPoint[]` | Entries to compile. Each entry has a `fileName`, an `outName` and an optional `key`. |
| `external` | `string[]` | Packages that must be left as external imports. A name also covers its subpaths and `*` is a wildcard. |
| `outdir` | `string` | Absolute output directory. |
| `mappedPaths` | `PathToImport` | Resolved tsconfig path mappings relevant to this build. |
| `kind` | `'shared' \| 'mapping' \| 'exposed'` | Which kind of bundle this is: shared npm externals, shared mapped paths or exposed modules. |
| `isMappingOrExposed` | `boolean` | Deprecated — read `kind`. `true` when compiling exposed modules or shared mapped paths. Removed in v5. |
| `platform` | `'browser' \| 'node'` | Target platform. |
| `tsConfigPath` | `string` | Path to the `tsconfig.json` to use, as configured. A relative path is relative to `workspaceRoot`. |
| `dev` | `boolean` | Development build (source maps, no minify). |
| `watch` | `boolean` | Opt in to watch-mode behavior. |
| `chunks` | `boolean` | Enable code-splitting. |
| `optimizedMappings` | `boolean` | Deprecated and unused; removed in v5. |
| `hash` | `boolean` | Append a content hash to output filenames. |
| `cache` | `FederationCache` | Shared federation cache — adapters may store bundler-specific state on its `bundlerCache` slot. |

## `NFBuildAdapterResult`

`build()` returns one result per file it wrote — entries, chunks, source maps and assets — on a rebuild too:

```ts
export interface NFBuildAdapterResult {
  fileName: string;  // absolute path to the emitted file
  entry?: string;    // the EntryPoint.outName this file was built from, on the entry's own script
}
```

Files go flat into `outdir`. Setting `entry` tells the core which entry each output belongs to, instead of having it match file names.

## Registering an Adapter

Adapters are registered either by passing them to `federationBuilder.init`:

```js
await federationBuilder.init({
  options: { /* ... */ },
  adapter: createEsBuildAdapter({ plugins: [] }),
});
```

… or imperatively via `setBuildAdapter`, when you drive the lower-level API directly:

```js
import { setBuildAdapter, buildForFederation, normalizeFederationOptions, getExternals } from '@softarc/native-federation';

setBuildAdapter(myAdapter);

const { config, options } = await normalizeFederationOptions(fedOptions, undefined, {
  externals: myAdapter.externals,
});
const externals = getExternals(config);
await buildForFederation(config, options, externals);
```

## Adapter Anatomy

Every production adapter tends to follow the same shape:

- `setup(name, options)` — create a bundler context (esbuild `context`, Angular builder handle, Vite dev server, …) and remember it keyed by `name`.
- `build(name, opts?)` — run the context. Use `opts.modifiedFiles` to drive incremental rebuilds; honor `opts.signal` to abort in-flight work.
- `dispose(name?)` — close a specific context or all of them.

## Reference Adapters

- [`@softarc/native-federation-esbuild`](../adapters/esbuild/index.md) — the reference adapter, a thin wrapper over esbuild.
- [`@angular-architects/native-federation`](../angular-adapter/index.md) — the Angular adapter, which plugs into the Angular CLI builders.

## Writing Your Own Adapter

A minimal custom adapter for a hypothetical bundler looks like this:

```ts
import type { NFBuildAdapter } from '@softarc/native-federation/domain';

const myAdapter: NFBuildAdapter = {
  contexts: new Map(),

  async setup(name, options) {
    const ctx = await myBundler.createContext({
      entries: options.entryPoints,
      external: options.external,
      outdir: options.outdir,
      platform: options.platform ?? 'browser',
      sourcemap: options.dev,
    });
    this.contexts.set(name, ctx);
  },

  async build(name, opts) {
    const ctx = this.contexts.get(name);
    const result = await ctx.rebuild({
      modifiedFiles: opts?.modifiedFiles,
      signal: opts?.signal,
    });
    return result.outputs.map(o => ({ fileName: o.path }));
  },

  async dispose(name) {
    if (name) {
      await this.contexts.get(name)?.dispose();
      this.contexts.delete(name);
    } else {
      for (const ctx of this.contexts.values()) await ctx.dispose();
      this.contexts.clear();
    }
  },
};
```

> **Note:** When implementing an adapter, look carefully at `platform` and `kind` — shared npm externals and exposed modules often need different bundler settings (e.g. different `format` or `resolve.extensions`).
