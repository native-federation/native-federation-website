---
applies_to: [v3, v4]
---

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
- **`strictVersion`** — what to do when the shared version falls outside `requiredVersion`: fall back to a scoped download (`true`), or accept the shared version with a warning (`false`).
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

## Secondary entrypoints — the `entries` map

A package can expose more than one import specifier: a primary entrypoint (`@angular/core`) and one or more secondary entrypoints (`@angular/core/testing`, `@angular/core/rxjs-interop`, …). Core v4.3.0 groups these under a single `DenseSharedInfo`, replacing the flat `outFileName` with an `entries` map from each specifier to its output file:

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

The resolver treats the whole `entries` map as **one** shared external: version negotiation happens once per package, and every specifier in `entries` follows the winning version's placement — scoped, share-scope, global, or a skip/override redirect. When a shared version wins, the winning remote's `entries` serve **all** consumers of that version, so each secondary entrypoint resolves to the same provider as its parent.

> **Older/flat remote builds** emit one `SharedInfo` per specifier instead of an `entries` map. Set [`feature.convertFlatSharedInfo`](configuration.md#features) to group them under their parent package (by npm scope) at runtime so they resolve together.

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

For every package in every dirty scope:

1. If the scope contains exactly one version → action `SHARE`. Done.
2. If the scope is `"strict"` → every version gets action `SHARE`; `requiredVersion` is replaced with the exact `version`.
3. Otherwise, pick the **shared version** using the priority rules below, then assign an action to every other version:
   - Compatible with the shared version → `SKIP` (reuse the shared URL).
   - Incompatible + `strictVersion: true` + `strictExternalCompatibility` on → throw `NFError`.
   - Incompatible + `strictVersion: true` → `SCOPE` (download individually).
   - Incompatible + `strictVersion: false` → `SKIP` + warning (use the shared version anyway).

### Step 3 — Generate the import map

| Scope | Action | Where it goes |
| --- | --- | --- |
| Global | `SHARE` | Root `imports` — visible to every remote. |
| Named share scope | `SHARE` | Added to each member remote's entry in `scopes` — same URL, many scopes. |
| Strict scope | `SHARE` | Added to the requesting remote's entry in `scopes`, once per exact version. |
| Any | `SCOPE` | Added to the requesting remote's entry in `scopes` with its own URL. |
| Any | `SKIP` | Omitted — the remote falls back to the shared URL from a broader scope. |

## Dependency Pooling

The algorithm above resolves every shared external **independently**: each one picks its own shared version, sourced from whichever remote contributed the winning tag. Packages that must move together can therefore split — `@framework/core` and `@framework/common` resolved against different versions, or served from different remotes, even when one coherent version exists.

The sharper hazard is **transitive coupling** through a shared intermediary. Suppose a design system `@design-system/ui` is built against `@framework/core`, shared from mfe-A (framework 15), and mfe-B (framework 16) consumes that shared design system. mfe-B now loads two framework runtimes — its own `core@16` plus the `core@15` the design system drags in — and breaks (e.g. two DI containers that cannot see each other). The coupled group must resolve to one mutually-compatible version _together_, and that has to hold transitively through the intermediary.

**Pooling** groups such externals and reconciles the whole group onto a single source. It is a re-resolution layered on top of normal resolution: it rewrites the resolver's output but emits no new versions.

### Enabling pooling

Pooling is opt-in and inert by default. An external joins a pool in one of two ways:

- **Auto (by npm scope).** Set [`feature.useAutoExternalPooling: true`](configuration.md#features). Scoped packages are grouped by their scope — `@framework/core`, `@framework/common` → pool `framework`. Unscoped packages (`utils`, `tslib`) are never auto-pooled. The scope is derived from the package name, so this grouping is global and cannot drift.
- **Remote-declared tag.** A remote adds an optional `pool` field to a shared external in its `remoteEntry.json` (it mirrors `shareScope`). A tag is **remote-local**: it groups only the externals that _one_ remote tags together. This is how a transitive coupling is expressed — auto-pooling groups by scope and can never connect `@design-system/ui` to `@framework/core`, so the remote co-tags both.

```ts
await initFederation(manifest, {
  feature: { useAutoExternalPooling: true },
});
```

**Membership is by shared members, not by name.** Pool identity is not a string that remotes must agree on — it is the **connected component** of a graph. Each external is a node, joined by an edge to its npm scope (auto-pooling, global) and to each `(remote, tag)` that declares it (remote-local). Two remotes' groups merge only when they **share a member**, never because they chose the same tag string. Drift is therefore harmless: mfe-A calling a group `"framework"` and mfe-B calling it `"design-system"` still pool together when they overlap on one external, while two unrelated groups that happen to reuse a label stay separate.

To pull a cross-scope sibling into a family, co-tag a **bridge member**: tagging both `@design-system/ui` and `@framework/core` with the same label connects the tag group to `@framework/core`'s auto scope through the shared `@framework/core` node.

### How pooling resolves

Pooling never re-runs the compatibility search. The resolver has already, per member, elected a winning version (`share`) and marked every other version `skip` (compatible) or `scope` (strict-incompatible). Pooling reads those verdicts and reconciles the family — it makes no compatibility calls of its own.

Per pool, per scope, it picks one **anchor remote**: the remote providing the winning tag for the most members, with the remote name as a deterministic tiebreak. Host and `latestSharedExternal` precedence are inherited for free — the resolver already applied them — and selection is stable across page reloads. When one remote provides the winning tag of every member (the common case under lockstep bumps), the family simply shares its build. Every other remote is then classified once for the whole pool:

| Classification | Condition | Result |
| --- | --- | --- |
| **Follow** | Every member it uses is `skip` against the winner (compatible). | Falls through to the shared build. |
| **Scope** (incompatibility-forced) | The resolver marked its version `scope` on _any_ member. | Its **entire** family is served from its own build, with **no** dedup — deduping a same-version sibling is exactly what would leak a foreign build in through a shared intermediary. Incompatibility dominates coverage. |
| **Scope** (coverage-forced) | Compatible everywhere the anchor covers, but uses a member the anchor lacks. | Scopes that member's own copy, but **may dedup**: any member whose version equals the shared version falls through to the shared build — safe, since there is no version conflict to transmit. |

**Scoped-only members.** When no anchor provides a member (an orphan), it has no shared build: every remote using it serves its own copy, and pooling logs a warning. A best partial anchor is always chosen rather than bailing on the whole pool. Under `strictExternalCompatibility` only an incompatibility-forced scope (a genuine version conflict) throws, matching the per-external resolver; a coverage-forced scope (the anchor simply does not ship a member) is not a conflict and resolves scoped without aborting.

> **Conservative by construction.** The anchor is chosen from members' _winning tags_ only, so a member whose winning tag came from a remote other than the anchor becomes scoped-only — even if the anchor happens to ship a coherent older build of it. Pooling trusts the resolver's per-member verdicts rather than re-searching raw versions, so a genuinely drifted portfolio may scope more than an exhaustive download-minimizing search would. This trades optimal sharing for a cheap single pass; coherent and lockstep families — the overwhelmingly common case — are unaffected.

### Scope and dynamic init

Pooling applies to the **global scope and named share scopes**; the `strict` scope is never pooled. It runs in both the initial pipeline and dynamic init (`initRemoteEntry`). Because the import map is immutable once committed, the dynamic pass is **additive** — it adjusts only the newly loaded remote and never retro-corrects committed remotes, honoring the same distinction between incompatibility-forced and coverage-forced scoping.

## Dynamic init — adding remotes after the fact

> **Note:** Dynamic init currently requires `useShimImportMap({ shimMode: true })` — native import maps can only be committed to the DOM once.

Dynamic init lets you load an additional remote _after_ `initFederation` has finished. It is **additive only**: it can add new dependencies to existing scopes, but it cannot replace, modify or remove anything the initial pass resolved.

### What dynamic init does

For every new external on the newly-loaded remote:

1. `singleton: false` → straight to scoped externals.
2. `singleton: true`, package not in scope yet → action `SHARE`, becomes the shared version.
3. `singleton: true`, already in scope, strict scope → action `SHARE`, added as an extra exact version.
4. Otherwise, compatible with the existing shared version → `SKIP` (reuse).
5. Incompatible + `strictVersion: true` → `SCOPE` (download individually). In strict mode (`strictExternalCompatibility`), this path throws instead.
6. Incompatible + `strictVersion: false` → `SKIP` (reuse the existing shared version). No warning is emitted and strict mode does not throw — the remote opted out of the compatibility check.

A new partial import map is then appended to the DOM — the existing one is never rewritten.

### Dynamic init actions, summarized

| Action | Meaning |
| --- | --- |
| `SHARE` | No compatible version exists yet — become the shared version for this scope. |
| `SKIP` | Use the existing shared version. In a shareScope, this is the mechanism that lets additional remotes join. |
| `SCOPE` | Incompatible and strict — download a private copy. |

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

- **Cannot replace existing shared versions.** Loading React 17 after React 18 was resolved either reuses React 18 (with a warning) or falls back to a scoped React 17 if `strictVersion`.
- **Cannot re-assign scopes.** An external resolved globally cannot move to a share scope, and vice versa.
- **Never re-resolves.** Dirty flags stay `false`; existing resolutions are preserved exactly.

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

When a remote is processed, every shared dependency it contributes to is marked `dirty: true`. At resolution time, only dirty entries are re-resolved. After resolution, everything is marked clean again. On a warm page load — where most entries are read from `sessionStorage` — nothing is dirty, so resolution is a no-op and the cached import map can be reused directly.

## `strictVersion` in detail

`strictVersion` only matters for `singleton: true`. It governs what happens when the shared version in the scope is incompatible with this remote's `requiredVersion`.

### `strictVersion: false` — default

```json
// MFE wants ui-lib ~4.16.0, shared version is 4.17.0
{ "packageName": "ui-lib", "version": "4.16.5", "requiredVersion": "~4.16.0",
  "singleton": true, "shareScope": "team-a", "strictVersion": false }

// Result: SKIP + WARNING. Remote uses shared 4.17.0. May break at runtime.
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

### 3. Optimal version strategy — default

Picks the version that minimizes extra scoped downloads within the scope. For each candidate version, count how many other versions would be forced to `SCOPE` (incompatible + strict) if that candidate were the shared one, then pick the candidate with the lowest cost.

```
// If 18.2.0 is chosen:
//   18.1.0 compatible → SKIP (0 extra downloads)
//   17.0.2 incompatible + strict → SCOPE (1 extra download)
//   Total cost: 1

// Picks 18.2.0.
```

### 4. Caching strategy

When `sessionStorage` or `localStorage` holds a previously-resolved version, the resolver prefers it — even if a newer candidate would be technically "better" by the optimal strategy. This is what makes multi-page hosts actually share downloads across navigation.

## Remote cache override behavior

When a `remoteEntry.json` is already cached, should the orchestrator refetch it?

Default rule: override only when the remote name is the same but the URL changed (e.g. `.../v0.0.1/remoteEntry.json` → `.../v0.0.2/remoteEntry.json`). Dynamic init always skips by default.

```ts
await initFederation(manifest, {
  profile: {
    overrideCachedRemotes: 'never',     // never refetch cached remotes
    overrideCachedRemotes: 'init-only', // refetch only during initFederation (default)
    overrideCachedRemotes: 'always',    // refetch on every cycle, including dynamic init
  },
});
```

To force a refetch even when the URL is identical (e.g. immutable URL with mutated content):

```ts
await initFederation(manifest, {
  profile: {
    overrideCachedRemotes: 'always',
    overrideCachedRemotesIfURLMatches: true,
  },
});
```

> **Note:** When a remote _is_ overridden, the orchestrator performs a clean cache purge: old `RemoteInfo`, old scoped externals and old shared externals (in every scope) are removed first, then the fresh `remoteEntry.json` is processed from scratch. Stale entries can't leak.

## Troubleshooting

### Version conflicts

```
// Global scope in strict mode
NFError: [team/mfe1] dep-a@1.2.3 is not compatible with existing dep-a@2.0.0 requiredRange '^1.0.0'

// Shared scope in strict mode
NFError: [custom-scope.dep-a] ShareScope external has multiple shared versions.
```

Fixes, in rough order of preference:

1. Loosen `requiredVersion` ranges on the clashing remotes.
2. Pin the version in `hostRemoteEntry`.
3. Split the conflicting remotes into different share scopes.
4. Use `shareScope: "strict"` to let multiple exact versions coexist.
5. Disable `strict` mode (last resort — accepts runtime compat risk).

### Share scope without an override version

```
Warning: [team-a][dep-a] shareScope has no override version.
```

Every version in the scope is either incompatible with the others and marked `strictVersion: true`, or the scope contains misconfigured single-remote groups, or the declared ranges genuinely don't overlap. Either widen ranges, split the scope, or accept the individual downloads.

### Strict scope with multiple versions

```
Info: Strict scope external design-tokens has multiple shared versions: 2.1.0, 2.2.0
```

That's expected behavior — that is what the strict scope does. Use it sparingly; consolidate versions when you can.

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
- [Architecture](architecture.md) — the caches the resolver reads and writes.
- [Configuration — modes](configuration.md#modes) — every knob that tunes resolution behavior.
- [Core — sharing dependencies](../core/sharing.md) — the build-side config that produces the inputs to this resolver.
