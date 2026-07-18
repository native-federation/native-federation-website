---
applies_to: [v4]
---

# Build Your Own Adapter

> How to build a custom Native Federation adapter for a new bundler — implement NFBuildAdapter, plug into the file watcher and rebuild queue, and expose a high-level builder.

Native Federation Core doesn't ship a bundler. Every adapter — esbuild, Angular, Vite — is a thin shim that implements a three-method contract (`NFBuildAdapter`) and hands its bundler's emitted files back to the core. If you want to support Rspack, Rolldown, swc, or anything else, you write one of those shims — and optionally wrap it in a higher-level _builder_ that plugs into the file watcher and rebuild queue the core already ships.

> **Note:** This page walks through the full surface. If you just want a reference implementation open in another tab, the [esbuild adapter source](https://github.com/angular-architects/module-federation-plugin/tree/main/libs/native-federation-esbuild) is the smallest complete example, and the corresponding [Builder](esbuild/builder.md) page documents every piece you're about to reimplement.

## Before you start

- Read [Build Process](../core/build-process.md) to understand the lifecycle the core drives (`setup` → `build` → `dispose`, once per phase).
- Read [Build Adapters](../core/build-adapters.md) for the contract surface itself.
- Read [Build Artifacts](../core/artifacts.md) so you know exactly which files the core expects you to emit and what it does with them.

## 1. The contract

An adapter is any object that implements `NFBuildAdapter` from `@softarc/native-federation/domain`:

```ts
interface NFBuildAdapter {
  setup(name: string, options: NFBuildAdapterOptions): Promise<void>;

  build(
    name: string,
    opts?: { modifiedFiles?: string[]; signal?: AbortSignal }
  ): Promise<NFBuildAdapterResult[]>;

  dispose(name?: string): Promise<void>;
}
```

The core calls these in phases. Each phase has a unique `name` — use it as the key for a bundler context you keep alive between rebuilds. One persistent bundler context per `name` is the pattern you want: it's what makes incremental rebuilds cheap and is exactly how the esbuild adapter uses `esbuild.context()`.

## 2. The phases the core drives

During a full build the core will call your adapter for up to three families of phases:

- `browser-shared` / `node-shared` — every `build: 'default'` external for that platform bundled in one pass. Called as a matched `setup` → `build` → `dispose` triple.
- `browser-<pkg>` / `node-<pkg>` — externals declared with `build: 'separate'` or `build: 'package'`, one phase per package group, again as a matched triple.
- `mapping-or-exposed` — every `exposes` entry plus every shared `tsconfig` path. This phase is special: the core keeps its context alive across incremental rebuilds. `setup` is called once, then `build` is called again (with `modifiedFiles` populated) for every subsequent rebuild, and `dispose` is only called when the whole federation builder shuts down.

The `options.isMappingOrExposed` flag tells you which family you're in. Shared externals and source-code exposed modules usually need different bundler settings — different `resolveExtensions`, different plugins (externals are often CommonJS), different `platform` handling. The esbuild adapter splits this into `createSourceCodeEsbuildContext` vs `createNodeModulesEsbuildContext`; yours probably wants the same split.

## 3. `NFBuildAdapterOptions`

| Field | Type | Notes |
| --- | --- | --- |
| `entryPoints` | `EntryPoint[]` | `{ fileName, outName, key? }`. Use `fileName` as the bundler's entry source and `outName` as the basename of the emitted file (without hash placeholders — the core handles hashing via `options.hash`). |
| `external` | `string[]` | Modules the bundler must _not_ inline. Pass through as-is to your bundler's externals setting. |
| `outdir` | `string` | Absolute target directory for emitted files. For externals it points at the cache directory; for `mapping-or-exposed` it's the project's `outputPath`. |
| `isMappingOrExposed` | `boolean` | `true` for the source-code phase, `false` for externals. |
| `platform` | `'browser' \| 'node'` | Forwarded to the bundler's platform setting. |
| `hash` | `boolean` | If `true`, append a content hash to emitted filenames. The core uses the filename you emit to populate `remoteEntry.json`. |
| `dev` | `boolean` | Enable sourcemaps, disable minification, set `process.env.NODE_ENV` to `"development"`. |
| `watch` | `boolean` | Informational — the core doesn't drive the watcher for you; it just tells you whether the builder is running in watch mode so you can pick a long-lived context. |
| `chunks` | `boolean` | Informational. The core decides how to wire chunks into `remoteEntry.json`; your job is to emit them and return them in `NFBuildAdapterResult[]`. |
| `tsConfigPath` | `string?` | Wire into your TypeScript pipeline (esbuild: `tsconfig`; swc: its config; Vite: forward to its esbuild options). |
| `mappedPaths` | `PathToImport` | Resolved `tsconfig` path aliases. Honor these so shared-mapping entries resolve to the same file your app resolves them to. |
| `optimizedMappings` | `boolean?` | `true` when `features.ignoreUnusedDeps` is on. Usually means you can skip the default Node-lib externals list. |
| `cache` | `FederationCache<TBundlerCache>` | Shared cache object. `cache.bundlerCache` is the only field adapters should touch — see §6. The bundler cache. |

## 4. What `build()` must return

Every emitted file — entry, chunk, `.map` — goes into the returned `NFBuildAdapterResult[]` with an _absolute_ `fileName`. Don't try to filter chunks or sourcemaps yourself: the core does that and matches entries by basename against `outName`, so filtering on your side breaks chunk tracking.

The esbuild adapter writes files to disk inside `build()` and returns the paths it wrote. If your bundler already writes to disk, hand the paths back. If it returns in-memory buffers, write them first — the core reads the files back to hash them and to rewrite chunk imports.

If `opts.signal` aborts:

- Cancel the in-flight bundle — esbuild has `ctx.cancel()`; other bundlers vary.
- Throw `AbortedError` from `@softarc/native-federation/internal`. The core checks `instanceof AbortedError` to distinguish cancellations from real build failures.

## 5. `dispose()` semantics

- `dispose(name)` — close a single phase's context. Called at the end of every externals phase.
- `dispose()` with no argument — shut everything down. Called from `federationBuilder.close()` or the equivalent in your builder. If your bundler has a daemon (like esbuild), stop it here.

## 6. The bundler cache

`options.cache.bundlerCache` is a persistent bag of state the core hands you across rebuilds. The core doesn't look inside it — it's yours. The esbuild adapter uses a `Map<string, unknown>` where the keys are the absolute paths of every input file esbuild's `metafile` reported, and the values are `null` (only the key set matters).

Populate it on every successful build; invalidate entries for `modifiedFiles` at the start of each rebuild so stale caches don't mask a changed file.

```ts
// After a successful build:
for (const input of Object.keys(result.metafile.inputs)) {
  bundlerCache.set(input, null);
}

// At the start of the next rebuild:
if (opts.modifiedFiles) {
  for (const file of opts.modifiedFiles) bundlerCache.delete(file);
}
```

The reason this matters is the file watcher — covered next.

## 7. The file watcher

Native Federation ships a lightweight recursive `fs.watch`-based watcher in `@softarc/native-federation/internal`. You don't have to use it — any watcher that produces changed paths works — but it's designed to pair with the bundler cache:

```ts
import {
  createNfWatcher,
  syncNfFileWatcher,
  type NfFileWatcher,
} from '@softarc/native-federation/internal';

const bundlerCache = new Map<string, unknown>();

const watcher: NfFileWatcher = createNfWatcher({
  onChange: path => {
    pendingChanges.add(path);
    void triggerRebuild();
  },
});

// After each build: subscribe to every input file we just compiled.
syncNfFileWatcher(watcher, bundlerCache);
```

`syncNfFileWatcher` reads the keys from `bundlerCache`, filters out `node_modules`, and calls `watcher.addPaths()` with anything it hasn't seen before. That's why the bundler cache is keyed by input path: one successful build automatically produces the watch set for the next one.

The watcher API:

- `addPaths(paths)` — start watching files or directories. Directory watches are recursive.
- `close()` — stop all watches. Always call before process exit.
- `get() / clear() / mutate()` — for drivers that want to batch dirty paths manually instead of via `onChange`.

## 8. The rebuild queue

Two file saves in quick succession should produce exactly one successful rebuild — not two races to the same output. The core ships `RebuildQueue` for that:

```ts
import { RebuildQueue, AbortedError } from '@softarc/native-federation/internal';

const rebuildQueue = new RebuildQueue();

async function triggerRebuild(): Promise<void> {
  await rebuildQueue.track(async signal => {
    try {
      await abortableDelay(rebuildDelay, signal);

      const files = [...pendingChanges];
      pendingChanges.clear();

      await rebuildForFederation(config, options, externals, files, signal);
      syncNfFileWatcher(watcher, bundlerCache);
      return { success: true };
    } catch (error) {
      if (error instanceof AbortedError) {
        return { success: false, cancelled: true };
      }
      return { success: false };
    }
  });
}
```

`rebuildQueue.track(fn)` aborts any in-flight build before starting a new one and waits for the old build to acknowledge the abort. The `signal` it hands `fn` is the same one you forward to `build(name, { signal })`, which is the same one you listen to inside the adapter to cancel the bundler. End-to-end: a file save while a rebuild is in flight _cancels_ the old rebuild, drains it, and starts a fresh one against the new `modifiedFiles` set.

`rebuildQueue.dispose()` aborts everything in flight — call it from your builder's `close()` method before disposing the adapter.

## 9. Incremental rebuilds and `modifiedFiles`

When the core calls `build('mapping-or-exposed', { modifiedFiles })` on an already-`setup` context, it's telling you: "these input paths changed since the last build — your cached state for them is stale." You must:

1. Evict those paths from `options.cache.bundlerCache` (as shown in §6).
2. Run the bundler. Most bundlers with a persistent context (esbuild's `ctx.rebuild()`, Rspack's `compiler.watch()`, Vite's dev server HMR) will reuse what they have and only redo the affected graph.
3. Return the full emitted set again. The core reconciles names itself.

The externals phases don't pass `modifiedFiles` — they run once per federation build. Only `mapping-or-exposed` is incremental.

## 10. CommonJS / UMD externals

Real-world externals are frequently CommonJS with dynamic `exports` tricks (React is the canonical offender). Bundlers that default to ESM will trip over these. The esbuild adapter solves this in two places and you'll likely want to mirror both:

- A **CommonJS plugin** (it uses `@chialab/esbuild-plugin-commonjs`) applied to the externals phase only, to translate CJS into something ESM-friendly.
- A **`fileReplacements`** / **`compensateExports`** layer that swaps the resolved entry for a hand-written shim when the package's own `exports` field points at something unbundlable. See [esbuild adapter configuration](esbuild/configuration.md) for how this is exposed to users.

## 11. Build notifications (optional)

In dev mode the core writes a `buildNotificationsEndpoint` into `remoteEntry.json`. Runtime clients long-poll it to know when a remote has rebuilt. If you're writing a builder that owns a dev server, you can implement the endpoint and push one of the `BuildNotificationType` values (`federation-rebuild-complete`, `federation-rebuild-error`, `federation-rebuild-cancelled`) after each rebuild. It's opt-in and lives entirely outside the adapter contract — a convenience for hot-reload workflows.

## 12. Minimal adapter skeleton

```ts
import type {
  NFBuildAdapter,
  NFBuildAdapterOptions,
  NFBuildAdapterResult,
} from '@softarc/native-federation/domain';
import { AbortedError } from '@softarc/native-federation/internal';

type BundlerCache = Map<string, unknown>;

interface Cached {
  ctx: MyBundlerContext;
  outdir: string;
  bundlerCache: BundlerCache | undefined;
}

export function createMyAdapter(): NFBuildAdapter {
  const contexts = new Map<string, Cached>();

  return {
    async setup(name, options: NFBuildAdapterOptions<BundlerCache>) {
      if (contexts.has(name)) return;

      const ctx = options.isMappingOrExposed
        ? await createSourceContext(options)
        : await createExternalsContext(options);

      contexts.set(name, {
        ctx,
        outdir: options.outdir,
        bundlerCache: options.cache?.bundlerCache,
      });
    },

    async build(name, opts = {}) {
      const entry = contexts.get(name);
      if (!entry) throw new Error(`setup() not called for "${name}"`);

      if (opts.signal?.aborted) throw new AbortedError('[build] Aborted before rebuild');

      if (opts.modifiedFiles && entry.bundlerCache) {
        for (const f of opts.modifiedFiles) entry.bundlerCache.delete(f);
      }

      const onAbort = () => entry.ctx.cancel();
      opts.signal?.addEventListener('abort', onAbort, { once: true });

      try {
        const result = await entry.ctx.rebuild();
        const written = writeOutputs(result, entry.outdir);

        if (entry.bundlerCache) {
          for (const input of result.inputs) entry.bundlerCache.set(input, null);
        }

        return written.map(fileName => ({ fileName }));
      } catch (error) {
        if (opts.signal?.aborted) throw new AbortedError('[build] cancelled');
        throw error;
      } finally {
        opts.signal?.removeEventListener('abort', onAbort);
      }
    },

    async dispose(name) {
      if (name) {
        await contexts.get(name)?.ctx.dispose();
        contexts.delete(name);
        return;
      }
      await Promise.all([...contexts.values()].map(c => c.ctx.dispose()));
      contexts.clear();
    },
  };
}
```

## 13. Wiring it into a one-shot build

Simplest case — you just want the federation artifacts written once:

```ts
import { federationBuilder } from '@softarc/native-federation';
import { createMyAdapter } from './my-adapter';

await federationBuilder.init({
  options: {
    workspaceRoot: process.cwd(),
    outputPath: 'dist/mfe1',
    federationConfig: 'mfe1/federation.config.js',
    tsConfig: 'tsconfig.json',
  },
  adapter: createMyAdapter(),
});

// Build the app itself with federationBuilder.externals marked external.
await myAppBundler.build({ external: federationBuilder.externals });

await federationBuilder.build();
await federationBuilder.close();
```

## 14. Wiring it into a watch-mode builder

If you want the same ergonomics as `runEsBuildBuilder` — a single call that runs the initial build, wires up the watcher and rebuild queue, and returns a `close()` handle — this is the shape to copy. Everything imported from `@softarc/native-federation/internal` is shipped specifically for adapter authors.

```ts
import {
  buildForFederation,
  createFederationCache,
  getExternals,
  normalizeFederationOptions,
  rebuildForFederation,
  setBuildAdapter,
} from '@softarc/native-federation';
import {
  AbortedError,
  RebuildQueue,
  createNfWatcher,
  syncNfFileWatcher,
  type NfFileWatcher,
} from '@softarc/native-federation/internal';
import { createMyAdapter } from './my-adapter';

export async function runMyBuilder(federationConfigPath: string, options: MyOptions) {
  const adapter = createMyAdapter();
  setBuildAdapter(adapter);

  const bundlerCache = new Map<string, unknown>();
  const { config, options: fedOptions } = await normalizeFederationOptions(
    { /* ... */ },
    createFederationCache(options.cachePath, bundlerCache),
  );
  const externals = getExternals(config);

  let federationInfo = await buildForFederation(config, fedOptions, externals);

  if (!options.watch) {
    return { federationInfo, externals, close: () => adapter.dispose() };
  }

  const rebuildQueue = new RebuildQueue();
  const pendingChanges = new Set<string>();
  let closed = false;

  const watcher: NfFileWatcher = createNfWatcher({
    onChange: path => {
      if (closed) return;
      pendingChanges.add(path);
      void triggerRebuild();
    },
  });
  syncNfFileWatcher(watcher, bundlerCache);

  async function triggerRebuild() {
    await rebuildQueue.track(async signal => {
      try {
        await abortableDelay(options.rebuildDelay ?? 50, signal);
        const files = [...pendingChanges];
        pendingChanges.clear();

        federationInfo = await rebuildForFederation(
          config, fedOptions, externals, files, signal,
        );
        syncNfFileWatcher(watcher, bundlerCache);
        return { success: true };
      } catch (error) {
        if (error instanceof AbortedError) return { success: false, cancelled: true };
        return { success: false };
      }
    });
  }

  return {
    get federationInfo() { return federationInfo; },
    externals,
    async close() {
      closed = true;
      rebuildQueue.dispose();
      await watcher.close();
      await adapter.dispose();
    },
  };
}
```

That's the whole watch-mode machinery. If you squint it's 40 lines of glue: `createNfWatcher` streams changes into a `Set`, a debounced `RebuildQueue.track` drains that set into a `rebuildForFederation` call, and `syncNfFileWatcher` re-subscribes to whatever inputs the latest build touched. Disposal unwinds in reverse order.

## 15. Things that frequently bite

- **Relative paths in results.** The core matches by basename but reads files by absolute path. Return absolute paths.
- **Not forwarding `signal`.** Without this, `RebuildQueue` will still fire the next rebuild, but the previous one runs to completion in parallel and wastes CPU — and in the worst case overwrites the newer output.
- **Skipping `syncNfFileWatcher` after rebuild.** New dynamic imports that land in the source graph after the first build won't be watched until you re-sync. Symptom: edits to a newly-imported file don't trigger a rebuild.
- **Keeping state on the adapter instance instead of the cache.** The core can recreate the adapter between builds; long-lived state belongs in `options.cache.bundlerCache`.
- **Forgetting to call `dispose()` without a name.** Many bundlers leak a subprocess (esbuild's service, swc's worker pool). Call `dispose()` on process exit.

> **Note:** Built an adapter and want to share it? Open a PR against the [native-federation GitHub org](https://github.com/native-federation) or add a link to the [Resources](../../resources.md) page.
