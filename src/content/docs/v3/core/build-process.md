# Build Process

> What buildForFederation does — the order of the bundling steps, rebuilds, and the shared-package cache.

`federationBuilder.build()` — or `buildForFederation(config, fedOptions, externals)` if you call the function directly — is the step that turns a normalized config into artifacts. This page walks through what it does, in order.

## The steps

### 1. Bundle exposed modules and shared mappings

Both go through one call to the build adapter with `kind: 'mapping-or-exposed'`. Each exposed key and each shared mapping becomes its own entry point, and the resulting file names are recorded (hashed in production, stable in dev).

Shared mappings are described like shared packages but with `singleton: true`, `strictVersion: false` and an empty `requiredVersion` — they are workspace-internal, so there is no version range to negotiate. Their `version` stays empty unless [`features.mappingVersion`](configuration.md#feature-flags) is on.

### 2. Bundle shared packages

The shared map is split four ways by `platform` and `build`:

| Group | Contents |
| --- | --- |
| `browser-shared` | `platform: 'browser'`, `build: 'default'` — one bundle |
| `node-shared` | `platform: 'node'`, `build: 'default'` — one bundle |
| browser separates | `platform: 'browser'`, `build: 'separate'` — one bundle per package |
| node separates | `platform: 'node'`, `build: 'separate'` — one bundle per package |

Each group is bundled with `kind: 'shared-package'` and the other groups' packages listed as externals, so a separately-built package still resolves its siblings through the import map.

### 3. Write the metadata

The exposed descriptions and the shared descriptions are assembled into a `FederationInfo` and written as `remoteEntry.json`; the shared list alone is also written as `importmap.json`. See [Build Artifacts](artifacts.md).

`buildNotificationsEndpoint` is only included when `dev` is on **and** `buildNotifications.enable` is true — production output never carries it.

## Rebuilds

`buildForFederation` takes an optional fourth argument:

```ts
buildForFederation(config, fedOptions, externals, {
  skipMappingsAndExposed: false,
  skipShared: true,
  signal,          // AbortSignal
});
```

Watch-mode integrations use `skipShared: true` on every rebuild after the first: your application code changed, the exposed modules and mappings have to be rebuilt, but `@angular/core` did not move. The Angular adapter does exactly this, and serializes rebuilds through a queue so a newer build cancels the one in flight.

`signal` is checked between steps. When it fires, the build throws `AbortedError` with the cancellation point in the message — cancellations are expected during watch and should be logged, not treated as failures.

## <a id="caching"></a> Caching

Shared packages are expensive to bundle and change rarely, so results are cached under:

```
node_modules/.cache/native-federation/<project>/
```

`<project>` is derived from the config's `name`. Each bundle group gets a metadata file — `browser-shared.meta.json`, `node-shared.meta.json`, and `-dev` variants — holding a checksum, the resulting `SharedInfo[]`, and the list of emitted files.

The checksum is a SHA-256 over every shared key and its version, sorted, plus the dev flag. On the next build the checksum is recomputed: if it matches, the cached files are copied into the output folder and the bundling step is skipped entirely, logging `Checksum matched, re-using cached externals.` If it does not match, the stale entry is purged and the group is rebuilt.

Because the checksum covers versions, bumping a dependency invalidates only the group it belongs to. Deleting the cache folder is always safe.

Within a single process the shared results are also memoized, so a watch session bundles each group at most once.

## Logging

The core logs through its own logger, with `setLogLevel('verbose' | 'info')` controlling the volume. Timings for each step are emitted at verbose level — "To bundle all mappings and exposed", "To bundle all shared browser externals", and so on — which is the fastest way to find out where a slow build is spending its time.

## Related

- [Getting Started](getting-started.md) — wiring `federationBuilder` into a build script.
- [Build Adapters](build-adapters.md) — the function that does the actual bundling.
- [Build Artifacts](artifacts.md) — what step 3 writes.
