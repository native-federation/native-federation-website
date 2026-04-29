---
applies_to: [v4]
---

# Builder

> Reference for runEsBuildBuilder and EsBuildBuilderOptions — the Native Federation esbuild adapter's high-level entry point.

`runEsBuildBuilder` is the high-level entry point most projects use. It loads `federation.config.js`, registers the esbuild adapter with the core, runs the initial build, and — when `watch` is on — keeps a file watcher and rebuild queue running until you call `close()`.

## Signature

```ts
import { runEsBuildBuilder } from '@softarc/native-federation-esbuild';

const federation = await runEsBuildBuilder(
  federationConfigPath: string,
  options: EsBuildBuilderOptions,
): Promise<EsBuildBuilder>;
```

## Minimal Call

```ts
const federation = await runEsBuildBuilder('federation.config.js', {
  outputPath: 'dist',
  entryPoints: ['src/bootstrap.tsx'],
});
await federation.close();
```

Everything else has a sensible default. The only required field is `outputPath` — the adapter throws `[esbuild-builder] outputPath is required` if it is missing.

## `EsBuildBuilderOptions`

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `outputPath` | `string` | **required** | Directory that receives `remoteEntry.json` and the bundled artifacts. |
| `workspaceRoot` | `string` | `process.cwd()` | Resolved against `cwd()`. Useful when the build script runs from a monorepo root. |
| `tsConfig` | `string` | `'tsconfig.json'` | Forwarded to esbuild's `tsconfig` option for the source-code bundle. |
| `cachePath` | `string` | core default | If given, joined with `workspaceRoot`. Otherwise the core's `getDefaultCachePath` is used. See [Caching](../../core/caching.md). |
| `projectName` | `string` | — | Forwarded to the core; used for logging and cache scoping in multi-project workspaces. |
| `entryPoints` | `string[]` | — | Source entries for the federation build. Usually the files referenced by `exposes` in `federation.config.js`. |
| `packageJson` | `string` | — | Path to the project's `package.json`. Override when it is not next to the federation config. |
| `dev` | `boolean` | `false` | Enables sourcemaps and disables minification in both the source-code and node-modules esbuild contexts. Also flips the `process.env.NODE_ENV` define to `"development"`. |
| `watch` | `boolean` | `false` | Starts the file watcher and rebuild queue. The returned `federation` object stays live until you call `close()`. |
| `verbose` | `boolean` | `false` | Sets the adapter's log level to `verbose`. Rebuild cancellations, watcher events and full error stacks are logged. |
| `rebuildDelay` | `number` | `50` (ms) | Debounce before a rebuild fires after a file change. Clamped to a minimum of 10 ms internally. |
| `cacheExternalArtifacts` | `boolean` | `true` | Set `false` to force the core to re-bundle shared node-modules on every build. Only useful when debugging cache issues. |
| `adapterConfig` | `EsBuildAdapterConfig` | `{ plugins: [] }` | esbuild-specific extension points. See [Adapter Configuration](configuration.md). |

## Return Value — `EsBuildBuilder`

```ts
interface EsBuildBuilder {
  federationInfo: FederationInfo;
  externals: string[];
  options: NormalizedEsBuildBuilderOptions;
  close(): Promise<void>;
}
```

- **`federationInfo`** — the result of the last successful build (remote name, exposed modules, shared descriptors, ...). In watch mode this is a live getter — read it whenever you need a fresh snapshot.
- **`externals`** — the list of module names the core marked as shared/external, forwarded to esbuild's `external`.
- **`options`** — the normalized, fully-defaulted options that were actually used. Handy for logging.
- **`close()`** — tears everything down: cancels any pending rebuild, stops the watcher, disposes all esbuild contexts, and calls `esbuild.stop()`. _Always_ call it before exit, even in non-watch mode, so esbuild's daemon shuts down cleanly.

## Watch Mode

When `watch: true`, the adapter:

1. Creates an [NF file watcher](../../core/caching.md) that observes every source file the initial build touched.
2. Queues a rebuild on change. Rebuilds are debounced by `rebuildDelay` and serialized through a `RebuildQueue` — a new change mid-build cancels the in-flight rebuild via `AbortSignal` rather than racing it.
3. Calls `rebuildForFederation` on the core, which only re-bundles the entry points whose inputs changed.

Rebuild outcomes:

- **Success** — logs `Federation rebuild done.` and updates `federationInfo`.
- **Cancelled** — a newer change came in while the previous rebuild was still running. Logged only in `verbose` mode.
- **Error** — logs `Federation rebuild failed!`. The watcher keeps running; fix the file and the next save triggers another rebuild.

## Lower-Level API — `createEsBuildAdapter`

If you drive `buildForFederation` / `rebuildForFederation` yourself (e.g. integrating with a custom dev server or another build tool's lifecycle), skip `runEsBuildBuilder` and construct just the adapter:

```ts
import { createEsBuildAdapter } from '@softarc/native-federation-esbuild';
import { setBuildAdapter, buildForFederation } from '@softarc/native-federation';

const adapter = createEsBuildAdapter({ plugins: [] });
setBuildAdapter(adapter);

await buildForFederation(config, normalizedOptions, externals);
await adapter.dispose();
```

`createEsBuildAdapter` returns an [`NFBuildAdapter`](../../core/build-adapters.md) with three methods:

- **`setup(name, options)`** — creates an esbuild context for a single bundle entry. Picks the source-code bundler or the node-modules bundler based on `options.isMappingOrExposed`.
- **`build(name, { modifiedFiles?, signal? })`** — rebuilds, writes output files, and returns an `NFBuildAdapterResult[]` with file names. Aborts cleanly when `signal` fires.
- **`dispose(name?)`** — disposes a single context by name, or all contexts (plus `esbuild.stop()`) when called without arguments.

> **Note:** For 99% of projects, `runEsBuildBuilder` is the right call. Reach for `createEsBuildAdapter` only when the core's built-in build loop doesn't fit your workflow.
