# Version Resolver

> How the Orchestrator decides which shared dependency versions to share, scope or skip — including share-scopes, the strict scope, dynamic init and priority rules.

When remotes disagree on which version of a shared dependency they want, someone has to decide. That's the version resolver. It runs once per `initFederation`, categorizes every shared external into a scope, picks a winner per scope, and tags the rest with `share`, `skip` or `scope` — which is exactly what the import-map builder needs to produce a working map.

## How remotes declare what to share

Every remote has a `federation.config.js` that tells the bundler which dependencies to share. The output of the build is a `remoteEntry.json` sitting next to the remote's JavaScript:

```
dist/
└── mfe1/
    ├── remoteEntry.json
    ├── button.js
    ├── dependency-a.js
    └── dependency-b.js
```

```json
{
  "name": "team/mfe1",
  "exposes": [
    { "key": "./Button", "outFileName": "button.js" }
  ],
  "shared": [
    {
      "packageName": "dep-a",
      "outFileName": "dependency-a.js",
      "requiredVersion": "~2.1.0",
      "singleton": false,
      "strictVersion": true,
      "version": "2.1.1"
    },
    {
      "packageName": "dep-b",
      "outFileName": "dependency-b.js",
      "requiredVersion": "~2.1.0",
      "singleton": true,
      "strictVersion": true,
      "version": "2.1.2"
    }
  ]
}
```

Four fields drive every resolver decision:

- **`requiredVersion`** — the semver range this remote will accept.
- **`singleton`** — candidate for sharing across remotes (`true`) or scoped to this remote (`false`).
- **`strictVersion`** — what to do when the shared version falls outside `requiredVersion`: fall back to a scoped download (`true`), or accept the shared version anyway (`false`).
- **`version`** — the actual version this remote ships.

## Import maps, in one minute

An [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) tells the browser where to fetch bare specifiers:

```json
{
  "imports": {
    "react":  "https://cdn.example.com/react@18.2.0.js",
    "lodash": "https://cdn.example.com/lodash@4.17.21.js"
  },
  "scopes": {
    "https://legacy-mfe.example.com/": {
      "react": "https://legacy-mfe.example.com/react@17.0.2.js"
    }
  }
}
```

The critical limitation: **one version per specifier per scope**. You can't map `"react"` twice in `imports`. That's why the resolver exists — if three remotes want three React versions, only one can live in the global `imports` block; the rest either skip their own copy (using the shared one), or download privately inside their own entry in `scopes`.

## Shared vs scoped externals

### Shared externals — `singleton: true`

Candidates for deduplication. The resolver pools them by `shareScope` and picks a winner per scope; the chosen version lands in the import map, the rest are resolved as `skip` or `scope`.

### Scoped externals — `singleton: false`

Never shared. Every remote gets its own copy in its own scope entry — no resolution needed, no interference with other remotes.

## <a id="secondary-entrypoints"></a> Secondary entrypoints — the `entries` map

A package can expose more than one import specifier: a primary entrypoint (`@angular/core`) and one or more secondary entrypoints (`@angular/core/testing`, `@angular/core/rxjs-interop`, …). With [`denseExternals`](../core/configuration.md#feature-flags) on, the core groups these under a single `DenseSharedInfo`, replacing the flat `outFileName` with an `entries` map from each specifier to its output file:

```json
// In remoteEntry.json
{
  "shared": [{
    "packageName": "@angular/core",
    "singleton": true,
    "version": "20.0.0",
    "requiredVersion": "^20.0.0",
    "entries": {
      "@angular/core": "core.js",
      "@angular/core/testing": "core-testing.js"
    }
  }]
}
```

The resolver treats the whole `entries` map as **one** shared external: version negotiation happens once per package, and every specifier in `entries` follows the winning version's placement — scoped, share-scope, global, or a skip/override redirect. Every specifier of a shared package is then served from **one build**, so each secondary entrypoint resolves to the same build as its primary.

> **Older/flat remote builds** emit one `SharedInfo` per specifier instead of an `entries` map. Set [`feature.convertFlatSharedInfo`](configuration.md#features) to group them under their parent package (by npm scope) at runtime so they resolve together.

### One build per package

Several remotes can ship the same version of a package, and each bundles only the entrypoints it actually imports — so two copies of `@angular/core@20.0.0` can declare `{ @angular/core }` and `{ @angular/core, @angular/core/testing }`. Their files are not interchangeable, though: a file binds its own imports where its build lives. So in every share scope (global and each named one) the orchestrator picks one **serving build** per package, and publishes every specifier of the package from that build alone.

A package is its primary plus any flat secondary externals (`@angular/core/testing` reported as an external of its own), so a dense `@angular/core` and a flat `@angular/core/testing` at the same tag are served from the same build too.

The host's build serves every package it ships. Otherwise the orchestrator picks the build that causes the fewest extra downloads, preferring one that ships every entrypoint the other remotes import. A [pooled](pooling.md) package takes its pool's elected build, and in the `strict` scope each version is served from one build of its own.

### Entrypoint coverage and tearing

The serving build does not always ship every specifier a consumer imports. A remote deduped onto the shared version can import a secondary entrypoint the serving build lacks:

```
@angular/core  20.0.0  share  mfe-a  entries { @angular/core }
@angular/core  20.1.0  skip   mfe-b  entries { @angular/core, @angular/core/testing }
```

Serving those two specifiers from two _different_ builds is a **tear**. It is harmless for most libraries, but it breaks packages whose secondary entrypoints share module-singleton state with the primary, which in Angular surfaces as `NG0203`. The orchestrator never tears a package: mfe-b runs **both** specifiers from its own build, and mfe-a's build keeps serving everyone else. The same holds for a copy of the shared tag that ships an entrypoint the serving build lacks, and for a remote whose flat secondary is scoped because its `strictVersion` range rejects that tag.

Keeping a package whole can cost downloads, and a remote that falls back runs its own instance of that package. Keep fallbacks rare by having every build publish the same entrypoints of tightly coupled packages:

- Turn on [`denseExternals`](../core/configuration.md#feature-flags) in every build, so each package's entrypoints travel as one entry.
- Set `includeSecondaries: { keepAll: true }` on tightly coupled packages such as `@angular/*`, so every build ships the same secondaries.

Coverage is also a **tiebreaker** when picking the shared version: among candidates that tie on extra downloads, the resolver prefers the one that leaves the fewest specifiers uncovered. A decisive extra-downloads winner is never overridden.

> **Inside a pool the unit is the family.** A remote no single build covers takes its whole family from its own build, not just the one package. See [Dependency Pooling](pooling.md).

### When the host's build lacks an entrypoint

The host is never repointed and never borrows a specifier from another build, so an entrypoint the host's files import but its build never declared does not resolve. Two shapes:

- **The host lacks a secondary a remote ships** (`@fw/core/rxjs-interop` beside the host's `@fw/core`). The global map leaves the specifier unmapped, and the remote that ships it runs the package from its own build.
- **The host ships a secondary without its root** (`@fw/core/rxjs-interop`, no `@fw/core`). The host can end up running the package from two builds.

The fix is in the host's build:

- Don't `skip` an entrypoint the host's shared packages import: skipping `@angular/common/http` leaves `@angular/platform-browser`'s static import of it unresolved, and the page fails to load.
- For an entrypoint loaded through a dynamic `import()` that unused-dependency pruning misses, set `features.ignoreUnusedDeps: false`, or keep every secondary with `includeSecondaries: { keepAll: true }`. Angular's `provideAnimationsAsync()` is the known case: `@angular/platform-browser/animations/async` loads `@angular/animations/browser` dynamically, the default build omits it, and the host's animations silently never run.

## Share scopes

By default, all `singleton: true` externals compete in a single global pool (`__GLOBAL__`). The `shareScope` property carves out sub-pools for dependency groups that should be resolved together but stay isolated from everyone else.

```json
// Team A — share UI components v3.x
{
  "shared": [{
    "packageName": "ui-components",
    "singleton": true,
    "shareScope": "team-a",
    "version": "3.1.0",
    "requiredVersion": "^3.0.0"
  }]
}

// Team B — share UI components v2.x
{
  "shared": [{
    "packageName": "ui-components",
    "singleton": true,
    "shareScope": "team-b",
    "version": "2.5.0",
    "requiredVersion": "^2.0.0"
  }]
}

// Global — React is shared across everyone
{
  "shared": [{
    "packageName": "react",
    "singleton": true,
    "version": "18.2.0",
    "requiredVersion": "^18.0.0"
  }]
}
```

Resolution is scope-local: `team-a` and `team-b` never try to pick a single UI-components version between them. The resolver picks a winner inside each scope and writes the resolved URL into every member remote's `scopes` entry in the import map — which is how the orchestrator emulates "grouped sharing" in a format that, strictly speaking, doesn't have groups.

## The `"strict"` share scope

`shareScope: "strict"` is a special value. Instead of picking one winner per package, the resolver lets _every_ provided version of that package coexist — each at its exact version, stripped of its `requiredVersion` range. Remotes still share when their versions match exactly; otherwise, each gets its own file.

```json
// Team A — Angular 15.2.1
{
  "shared": [{
    "packageName": "@angular/core",
    "singleton": true,
    "shareScope": "strict",
    "version": "15.2.1",
    "requiredVersion": "15.2.1"
  }]
}

// Team B — Angular 15.2.3
{
  "shared": [{
    "packageName": "@angular/core",
    "singleton": true,
    "shareScope": "strict",
    "version": "15.2.3",
    "requiredVersion": "15.2.3"
  }]
}

// Both teams receive their exact Angular version — no patch-level mismatches.
```

**When to use it:**

- Compiled frameworks (Angular's AOT output) where patch versions can break compatibility.
- Dependencies whose breaking changes don't follow semver (internal APIs consumed by generated code, binary modules, WebAssembly).
- Gradual migrations where old and new versions must coexist.

**Trade-offs:**

- No automatic resolution — every declared version is downloaded.
- More bandwidth than regular shareScopes.
- Requires team coordination: strict scopes don't _fix_ incompatibilities, they just make them explicit.

## The resolution algorithm

### Step 1 — Categorize

For every external in every fetched `remoteEntry.json`:

- `singleton: false` → individual scoped external. No resolution.
- `singleton: true` & no `shareScope` → global shared pool, marked `dirty: true`.
- `singleton: true` & `shareScope: "name"` → named shared scope, marked `dirty: true`.
- `singleton: true` & `shareScope: "strict"` → strict scope, written directly with action `SHARE` (not marked dirty — there is nothing for Step 2 to decide).

### Version validation

An external's `version` is optional and may be missing or non-semver. Before it is stored, an invalid version is handled in precedence order — the result is always valid semver:

1. **Throw** — if `strict.strictExternalVersion` is on, an invalid or missing version raises `NFError`.
2. **Skip** — else if [`profile.skipInvalidExternalVersions`](configuration.md#profile) is on, the external is dropped and never stored.
3. **Coerce** (default) — otherwise the version is coerced to the **smallest** version matching the external's `requiredVersion` range.

```ts
await initFederation(manifest, {
  // Drop externals with a missing/invalid version instead of coercing them.
  profile: { skipInvalidExternalVersions: true },
});
```

### Step 2 — Resolve each dirty scope

For every package in every dirty scope — except members of a [pool](#dependency-pooling), which the pool elects as one family before this step:

1. If the scope contains exactly one version → action `SHARE`. Done.
2. If the scope is `"strict"` → every version gets action `SHARE`; `requiredVersion` is replaced with the exact `version`.
3. Otherwise, pick the **shared version** using the priority rules below, then assign an action to every other version:
   - Compatible with the shared version → `SKIP` (reuse the shared URL).
   - Incompatible + `strictVersion: true` + `strictExternalCompatibility` on → throw `NFError`.
   - Incompatible + `strictVersion: true` → `SCOPE` (download individually).
   - Incompatible + `strictVersion: false` → `SKIP` (use the shared version anyway).

> **A verdict belongs to the copy, not the version.** `requiredVersion` and `strictVersion` are per-build settings, so two remotes shipping the same tag can disagree about the winner. When they do, the version is **split**: only the copies that actually reject the shared version get `SCOPE`; the rest stay `SKIP` and keep deduping. The winner itself is never split, and a copy declaring `strictVersion: false` always dedups — that is what the flag asks for.

### Step 3 — Pick each package's serving build

Per share scope, each package gets the one build it is served from — see [One build per package](#one-build-per-package).

### Step 4 — Generate the import map

| Scope | Action | Where it goes |
| --- | --- | --- |
| Global | `SHARE` | Root `imports` — visible to every remote. |
| Named share scope | `SHARE` | Added to each member remote's entry in `scopes` — same URL, many scopes. |
| Strict scope | `SHARE` | Added to the requesting remote's entry in `scopes`, once per exact version. |
| Any | `SCOPE` | Added to the requesting remote's entry in `scopes` with its own URL. |
| Any | `SKIP` | Omitted — the remote falls back to the shared URL from a broader scope. |

Each specifier is published from its package's serving build.

## Dependency Pooling

The algorithm above resolves every shared external **independently**: each one picks its own shared version, sourced from whichever remote contributed the winning tag. Packages that ship as a **family** are not independent, so this can hand a remote a combination nobody built — `@acme/ui@3.4.0` from one remote beside `@acme/tokens@3.2.0` from another, both "compatible" by their declared ranges. The sharper case is transitive: a design system compiled against `@framework/core@15`, shared into a remote running `core@16`, drags a second framework runtime in behind it.

**Pooling** is the opt-in feature that prevents this. A remote groups coupled externals by giving them a `pool` label in its `remoteEntry.json`, and pooling elects the group **as one family**: every remote takes the whole group from one build that shipped it together — the elected one, another remote's, or its own. Pooled externals skip the per-package resolution above.

```json
// In remoteEntry.json
{ "packageName": "@framework/core", "version": "22.0.5", "requiredVersion": "^22.0.0", "pool": "framework" }
```

The election picks the build that serves the most remotes (always the host's, when the host ships the family); remotes it does not serve share another remote's build where one serves several of them, and the rest run their own family. Pooling applies to the global scope and named share scopes; the `strict` scope is never pooled, and a warm init with nothing dirty in a scope does no pooling work there.

> **Pooling chooses coherence first, then downloads.** Electing the family as a whole can move a pooled family's global version, and a remote that would mix builds always pays for its own family.

> **See [Dependency Pooling](pooling.md)** for the full picture: whether you need it, how membership is decided, both gates in detail, the measured cost, tagging guidance, what pooling stores, and the diagnostics.

## <a id="dynamic-init"></a> Dynamic init — adding remotes after the fact

> **Note:** Dynamic init currently requires `useShimImportMap({ shimMode: true })` — native import maps can only be committed to the DOM once.

Dynamic init lets you load an additional remote _after_ `initFederation` has finished. It is **additive only**: it can add new dependencies to existing scopes, but it cannot replace, modify or remove anything the initial pass resolved.

### What dynamic init does

The loaded remote's shared externals are decided **per package** — a dense root and its flat secondaries together — against what the committed import map serves of that package in its scope:

1. `singleton: false` → straight to scoped externals.
2. `shareScope: "strict"` → `SHARE`, added as an extra exact version.
3. The map serves none of the package → `SHARE`: the remote's build opens it and becomes its serving build.
4. A `strictVersion` range rejects the tag the map serves → `SCOPE` with a warning; under `strictExternalCompatibility` the load fails instead. A range without `strictVersion` follows the map's tag silently.
5. The map serves every entrypoint the remote ships, from one build → `SKIP`: the remote follows that build wholly.
6. Otherwise (the map lacks an entrypoint the remote ships, or serves the package from two builds) → `SCOPE`: the remote runs the whole package from its own build.

Pooled families are judged afterwards: per pool, the loaded remote either resolves through the committed map or serves its own family (see [Dependency Pooling — dynamic init](pooling.md#scope-and-dynamic-init)).

A new partial import map is then appended to the DOM — the existing one is never rewritten. If the load fails, nothing it wrote is kept: the cache returns to its last commit, and a retry by name fetches the remote again.

### Dynamic init actions, summarized

| Action | Meaning |
| --- | --- |
| `SHARE` | The committed map serves none of the package in this scope — the remote becomes its serving build. |
| `SKIP` | The committed map serves every entrypoint the remote ships, from one build — the remote follows that build. In a share scope, this is the mechanism that lets additional remotes join. |
| `SCOPE` | A `strictVersion` range rejects the map's tag, or the map can't serve the package whole — the remote runs the whole package from its own build. |

### Example scenario

```ts
// Initial setup
const { initRemoteEntry, loadRemoteModule } = await initFederation({
  'team/header':  'http://localhost:3000/remoteEntry.json',
  'team/sidebar': 'http://localhost:4000/remoteEntry.json',
});

// Later — add a new MFE at runtime
await initRemoteEntry('http://localhost:5000/remoteEntry.json', 'team/dashboard');

// It is now loadable
const Dashboard = await loadRemoteModule('team/dashboard', './Dashboard');
```

Given this initial state:

```
// team/header:  react@18.2.0 (global)
// team/sidebar: design-system@3.1.0 (shareScope "team-a")
```

And a dashboard declaring:

```json
{
  "shared": [
    { "packageName": "react",          "version": "18.1.0", "requiredVersion": "^18.0.0", "singleton": true },
    { "packageName": "design-system",  "version": "3.0.5",  "requiredVersion": "^3.0.0",  "singleton": true, "shareScope": "team-a" },
    { "packageName": "charts-library", "version": "2.4.0",                               "singleton": true }
  ]
}
```

Outcome:

- **react@18.1.0** → `SKIP` (compatible with the existing 18.2.0 global).
- **design-system@3.0.5** → `SKIP` (compatible with existing 3.1.0 in team-a).
- **charts-library@2.4.0** → `SHARE` (new package, becomes the global shared version).

New import map appended to the DOM:

```json
{
  "imports": {
    "charts-library": "http://localhost:5000/charts-library@2.4.0.js"
  },
  "scopes": {
    "http://localhost:5000/": {
      "design-system": "http://localhost:4000/design-system@3.1.0.js"
    }
  }
}
```

### Dynamic init constraints

- **Cannot replace existing shared versions.** Loading React 17 after React 18 was resolved either reuses React 18 (`strictVersion: false`, no warning) or falls back to a scoped React 17 with a warning (`strictVersion: true`).
- **Cannot re-assign scopes.** An external resolved globally cannot move to a share scope, and vice versa.
- **Never re-resolves.** Existing resolutions are preserved exactly. The one exception is for the next page: a pooled member the loaded remote ships is marked dirty, so the next init re-elects its pool with the remote in it.
- **Never overrides a known remote.** A remote that is already initialized is not fetched again; a different URL for it is ignored with a warning.

### Use cases

- **Route-based loading** — load a remote when the user navigates to a feature.
- **Feature flags** — only pay for advanced analytics when the user has them.
- **A/B testing** — pick a remote URL per variant.

## Scope levels, side by side

| Scope | Config | Import map | Typical use |
| --- | --- | --- | --- |
| **Global** (`__GLOBAL__`) | `singleton: true`, no `shareScope` | `imports` | React, common utilities — the things everyone should agree on. |
| **Named share scope** | `singleton: true`, `shareScope: "name"` | One resolved URL inserted into each member remote's entry in `scopes` | Team-specific libraries, design systems, domain clusters. |
| **Strict scope** | `singleton: true`, `shareScope: "strict"` | Each exact version added per-remote in `scopes` | Compiled frameworks, breaking-change-heavy packages, binary modules. |
| **Individual scope** | `singleton: false` or incompatible + strict | Per-remote entry in `scopes` with its own URL | Incompatibilities, remote-private dependencies. |

## The `dirty` flag

When a remote is processed, every shared dependency it contributes to is marked `dirty: true`. At resolution time, only dirty entries are re-resolved. After resolution, everything is marked clean again. On a warm page load — where most entries are read from `sessionStorage` — nothing is dirty, so neither resolution nor pooling runs and the cached import map can be reused directly.

## `strictVersion` in detail

`strictVersion` only matters for `singleton: true`. It governs what happens when the shared version in the scope is incompatible with this remote's `requiredVersion`.

### `strictVersion: false` — default

```json
// MFE wants ui-lib ~4.16.0, shared version is 4.17.0
{ "packageName": "ui-lib", "version": "4.16.5", "requiredVersion": "~4.16.0",
  "singleton": true, "shareScope": "team-a", "strictVersion": false }

// Result: SKIP. Remote silently uses shared 4.17.0. May break at runtime.
```

### `strictVersion: true`

```json
// Same config, strictVersion flipped
{ "packageName": "ui-lib", "version": "4.16.5", "requiredVersion": "~4.16.0",
  "singleton": true, "shareScope": "team-a", "strictVersion": true }

// Result: SCOPE. Remote gets its own ui-lib@4.16.5 download. Guaranteed compat, extra payload.
```

## Priority rules

For every non-strict scope, the resolver picks one version as "the shared version". It checks these rules in order:

### 1. Host version override

If `hostRemoteEntry` provides a version of this package in this scope, it wins. Unconditionally.

```ts
await initFederation(manifest, {
  hostRemoteEntry: { url: './host-remoteEntry.json' },
});

// Host declares react@18.0.5 → wins over:
//   MFE1 react@18.2.0 (global)
//   MFE2 react@18.1.0 (global)
```

### 2. Latest version strategy

Opt-in via `profile.latestSharedExternal: true`. Picks the highest semver version in the scope, regardless of download cost.

```ts
await initFederation(manifest, {
  profile: { latestSharedExternal: true },
});

// Available: [18.1.0, 18.2.0, 18.0.5] → picks 18.2.0
```

### <a id="optimal"></a> 3. Optimal version strategy — default

Picks the version that causes the fewest extra downloads within the scope. The cost of a candidate is the number of **copies** that would have to keep their own build: copies whose own range rejects the candidate while `strictVersion` is set. A copy that accepts the candidate dedups, and so does one declaring `strictVersion: false`. A copy that is already cached from an earlier page load is already downloaded, so it costs nothing — which tends to keep a multi-page host on the version it already loaded.

```
// If 18.2.0 is chosen:
//   18.1.0 (2 remotes, both accept 18.2.0)    → SKIP              (0 extra downloads)
//   17.0.2 (3 remotes, 1 of them pinning ~17) → split: the pinner
//                                               SCOPEs, the other
//                                               two SKIP           (1 extra download)
//   Total cost: 1

// Picks 18.2.0.
```

Ties break toward the candidate that leaves the fewest entrypoints [uncovered](#entrypoint-coverage-and-tearing), and then toward the newest tag.

> **A large group can outvote a newer version.** Many remotes pinned to an older tag can win over a few on a newer one, since that is what "fewest extra downloads" asks for. Use the [host version](#1-host-version-override) or `latestSharedExternal` when the newest version must win.

## Remote cache override behavior

When a `remoteEntry.json` is already cached, should the orchestrator refetch it?

Default rule: override only when the remote name is the same but the URL changed (e.g. `.../v0.0.1/remoteEntry.json` → `.../v0.0.2/remoteEntry.json`). Dynamic init never overrides a remote that is already initialized, since the committed import map cannot drop its imports.

```ts
await initFederation(manifest, {
  profile: {
    overrideCachedRemotes: 'never',     // never refetch cached remotes
    overrideCachedRemotes: 'init-only', // refetch only during initFederation (default)
    overrideCachedRemotes: 'always',    // deprecated: same as 'init-only'
  },
});
```

To force a refetch even when the URL is identical (e.g. immutable URL with mutated content):

```ts
await initFederation(manifest, {
  profile: {
    overrideCachedRemotes: 'init-only',
    overrideCachedRemotesIfURLMatches: true,
  },
});
```

Without `overrideCachedRemotesIfURLMatches`, a remote redeployed at the same URL keeps its stored `remoteEntry.json` over a cache kept across page loads (`localStorage`, `sessionStorage`): the page keeps resolving the old build. A `cacheTag` doesn't help, since it only applies to a `remoteEntry.json` that is fetched. Deploy each build at its own URL (a version or content hash in the path), or set this option. Under `overrideCachedRemotes: 'never'` neither helps.

> **Note:** When a remote _is_ overridden, the orchestrator performs a clean cache purge: old `RemoteInfo`, old [shared chunks](architecture.md#shared-chunks-cache), old scoped externals and old shared externals (in every scope) are removed first, then the fresh `remoteEntry.json` is processed from scratch. Each of those is a whole-remote removal rather than a merge with what the replacement declares — a build that stops chunking a bundle omits the key instead of sending an empty list, so a per-bundle replace would leave the old chunk files mapped and 404-ing. Removing the host's own copy also clears the host flag on that version, so a version the host has moved off can't keep host precedence.

## Troubleshooting

> [!TIP] **See the outcome before decoding error messages.** The [Native Federation DevTools](../devtools.md) Packages tab shows, per package, which version was shared, who provides it, and every participant's declared range and `strictVersion` flag next to whether its own copy was selected. The **Conflicts** filter narrows the list to packages that resolved to more than one version.

### Version conflicts

With `strictExternalCompatibility` on, a copy whose `strictVersion` range rejects the shared version fails init:

```
// Logged
[team/mfe1][dep-a@1.2.3] Is not compatible with requiredRange '^1.0.0' of shared dep-a@2.0.0.

// Thrown
NFError: External dep-a@1.2.3 could not be shared.
```

The same conflict during a [dynamic init](#dynamic-init) fails the load instead, or is logged as a warning when the flag is off:

```
[__GLOBAL__][team/dashboard] dep-a@1.2.3 Is not compatible with existing dep-a@2.0.0 requiredRange '^1.0.0'
```

Fixes, in rough order of preference:

1. Loosen `requiredVersion` ranges on the clashing remotes.
2. Pin the version in `hostRemoteEntry`.
3. Split the conflicting remotes into different share scopes.
4. Use `shareScope: "strict"` to let multiple exact versions coexist.
5. Disable `strict` mode (last resort — accepts runtime compat risk).

### Import map problems in a share scope

Two share-scope states are reported while the import map is built. With `strictImportMap` on, each logs an error and init throws `NFError: Could not create ImportMap.`:

```
[custom-scope.dep-a] ShareScope external has multiple shared versions.
[team-a][dep-a] shareScope has no override version.
```

Without it, the first is a warning and the second a debug message, and the map is built anyway. A scope with no override version means every copy in it was scoped, because the declared ranges don't overlap or each copy is pinned with `strictVersion: true`. Widen the ranges, split the scope, or accept the individual downloads.

## Semver compatibility

Compatibility checks use the standard [semver](https://www.npmjs.com/package/semver) rules:

| Range | Meaning | Examples |
| --- | --- | --- |
| `^1.2.3` | Compatible changes | `1.2.4`, `1.3.0`, `1.9.9` |
| `~1.2.3` | Patch-level changes | `1.2.4`, `1.2.9` |
| `>=1.2.3` | Greater than or equal | `1.2.3`, `2.0.0` |
| `1.2.3` | Exact version | `1.2.3` only |

Pre-release versions are only considered compatible with matching pre-release ranges in the same scope.

## See also

- [The orchestrator docs](https://github.com/native-federation/orchestrator/blob/main/docs/version-resolver.md) — The orchestrator docs regarding the version resolver.
- [Dependency Pooling](pooling.md) — the opt-in layer that keeps a coupled package family coherent across remotes.
- [Architecture](architecture.md) — the caches the resolver reads and writes.
- [Configuration — modes](configuration.md#modes) — every knob that tunes resolution behavior.
- [Core — sharing dependencies](../core/sharing.md) — the build-side config that produces the inputs to this resolver.
