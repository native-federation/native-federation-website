# Terminology

> Glossary of Native Federation terms — manifest, remoteEntry.json, remote, host, external, exposed module, shared dependency, build adapter and more.

A shared vocabulary for working with Native Federation. The same terms show up across the Core builder, the runtime and every adapter — this page is the canonical definition of each one.

## Actors

### Host

The application that loads remotes. Also called the *shell*. A host is a regular web application built the same way as any other — it just reaches out at runtime to pull in code from separately deployed remotes. From the framework's perspective this looks like ordinary lazy loading; the difference is that the host doesn't know the remotes at compile time. A host has its own `federation.config.js` (without `exposes`) and produces its own `remoteEntry.json`.

### Remote

A separately built and deployed application that publishes one or more EcmaScript modules for hosts (or other remotes) to consume. In micro-frontend terms, a remote represents a subdomain within your architecture — typically one remote per team or bounded context. Each remote has its own `name`, its own `federation.config.js`, and its own `remoteEntry.json`. Names are npm-style: `'mfe1'`, `'@org/mfe1'`, `'team/mfe1'`.

### Micro Frontend (MFE)

A remote, viewed through the lens of the micro-frontend architecture. The terms are used interchangeably in these docs: every micro frontend is a remote, and in practice every remote in a micro-frontend architecture *is* the MFE for a team's subdomain.

### Runtime

The browser library that boots federation on the host — `@softarc/native-federation-runtime`. It initializes federation (`initFederation`), fetches remote entries, builds the import map and exposes `loadRemoteModule`. See [Runtime](runtime/index.md).

### Orchestrator

`@softarc/native-federation-orchestrator`, the browser runtime that ships with v4. It speaks the same `remoteEntry.json` contract, so a v3 host can opt into it for semver-range resolution and persistent caching of remote entries in `localStorage` or `sessionStorage`. See [Orchestrator](orchestrator/index.md).

### Build Adapter

A thin shim that plugs a specific bundler (esbuild, Angular CLI, Vite, …) into the Core builder. A build adapter is a single async function matching the `BuildAdapter` type — it takes entry points and returns the files it emitted — which is what lets the Core stay bundler-agnostic. See [Build Adapters](core/build-adapters.md).

## Artifacts

### `remoteEntry.json`

The public contract of a remote — one JSON file written alongside the bundled output by every Native Federation build. It tells hosts exactly what the remote publishes, which packages it expects to share, and where to find the corresponding files. Shape:

```ts
interface FederationInfo {
  name: string;
  exposes: ExposesInfo[];
  shared: SharedInfo[];
  buildNotificationsEndpoint?: string;
}
```

For the exact layout of each field see [Build Artifacts](core/artifacts.md).

### Manifest

A JSON file on the host that maps every *known* remote name to the URL of its `remoteEntry.json`. The host passes a manifest to `initFederation`; the runtime fetches each listed remote entry and wires everything together.

```json
{
  "mfe1": "http://localhost:3001/remoteEntry.json",
  "checkout": "https://checkout.example.com/remoteEntry.json"
}
```

Manifests decouple configuration from code: to point a host at different remotes per environment, you ship a different manifest — no recompilation needed. A manifest can also be passed as an inline object to `initFederation`.

> **Note:** **Manifest vs. `remoteEntry.json`.** The *manifest* lives on the host and says *where the remotes are*. A `remoteEntry.json` lives on each remote and says *what that remote publishes*. Hosts use the manifest to find remotes; the runtime uses each remote's `remoteEntry.json` to load its modules.

### Import Map

A [W3C-standard browser feature](https://html.spec.whatwg.org/multipage/webappapis.html#import-maps) for redirecting bare module specifiers to URLs. Native Federation writes an `importmap.json` alongside `remoteEntry.json` in every build. At runtime the runtime library builds its own map from the fetched remote entries — host dependencies at the root, each remote's under a scope keyed by its base URL — and injects the result into the page so imports like `@angular/core` resolve to one file. See [The Import Map](runtime/import-map.md).

## Sharing concepts

### Shared Dependency

A package that the host and one or more remotes agree to load *once* and reuse at runtime instead of each bundling their own copy. Shared dependencies are the whole point of federation: they de-duplicate bytes on the wire and, for stateful libraries, guarantee that every remote talks to the same instance. Declared in `federation.config.js` under `shared`, usually via the `share` or `shareAll` helpers.

### External

A package or mapped path the app bundler is told *not* to inline — it's left as a bare `import 'some-lib'` in the emitted code and resolved at runtime by the import map. In Native Federation terms, every shared dependency (and every shared mapped path) ends up on the externals list that is passed to your bundler via `federationBuilder.externals`. "Shared external" is the same thing viewed from the federation side; "external" is the same thing viewed from your app bundler's side.

### Exposed Module

A module a remote makes available to hosts. Declared under `exposes` in the remote's `federation.config.js`:

```js
exposes: {
  './Component': './projects/mfe1/src/bootstrap.ts',
}
```

The key (`./Component`) is the public specifier hosts use; the value is the path to the source file. Each exposed module is built into its own ESM bundle and listed in `remoteEntry.json` under `exposes`. A host loads it via:

```ts
await loadRemoteModule({ remoteName: 'mfe1', exposedModule: './Component' });
```

### Secondary Entry Point

A subpath of an npm package that is importable on its own — for example `@angular/core/rxjs-interop` or `rxjs/operators`. The `share` helper discovers secondaries by reading the package's `exports` field (or falling back to directory scanning) and, by default, emits a separate shared bundle for each one. Controlled per-package with `includeSecondaries`.

### Shared Mapping

A `tsconfig.json` path mapping that Native Federation treats as a shared library. Monorepo-internal libraries (`libs/shared-lib`, `@org/utils`) are usually consumed through `tsconfig` paths; the Core picks them up automatically and shares them like any other external. Drop unwanted ones with `skip`.

### Singleton

A shared-dependency flag that says "only one instance of this package may ever be loaded at runtime". Required for libraries with internal state — Angular, React, `zone.js`, state stores. It is recorded in `remoteEntry.json` for the runtime to act on: the v3 runtime honours it by reusing the first registered copy of a `packageName@version`; the orchestrator uses it to elect a winner across differing versions.

### strictVersion

A flag that turns a version mismatch from a warning into an error. It is recorded in `remoteEntry.json`; acting on it is the runtime's job, and only the orchestrator compares ranges closely enough to enforce it.

### requiredVersion

The semver range a consumer expects of a shared dependency — written into `remoteEntry.json`. Set it to `'auto'` to have the helper read the actual version from the closest `package.json` (the recommended default). The v3 runtime does not read it; it deduplicates on the exact `version` string instead.

### Version Mismatch

What happens when two remotes declare different versions of the same shared dependency. The v3 runtime does not reconcile them: each remote keeps its own copy under its own scope, and only byte-identical versions are reused. Reconciling ranges is what the [orchestrator](orchestrator/index.md) adds.

## Configuration

### `federation.config.js`

The single configuration file every host and every remote owns. Describes `name`, `exposes`, `shared`, `skip`, feature flags, and more. Loaded by the Core at build time via `withNativeFederation`. See [`federation.config.js`](core/configuration.md) for the complete reference.

### `withNativeFederation`

The helper you wrap your config in. Applies defaults, prepares the skip list, resolves `tsconfig` mapped paths, and returns a `NormalizedFederationConfig` the builder consumes.

### Skip list

An array of strings, regular expressions, or predicates that opts specific packages out of sharing. Your `skip` list is applied to the normalized config; separately, `share` and `shareAll` filter against `DEFAULT_SKIP_LIST` — which already excludes Native Federation's own packages, `es-module-shims`, `zone.js`, `tslib/`, `@angular/localize` and everything under `@types/`.

> **Note:** **Skip != exclude.** A skipped package is still bundled into the remote — otherwise the remote couldn't run standalone. Skip only prevents the package from being extracted into a *shared* bundle.

### Feature Flag

A behavior toggle under `features` on the federation config — `ignoreUnusedDeps` and `mappingVersion`, both opt-in and defaulting to `false`. See [Feature Flags](core/configuration.md#feature-flags).

## Build & runtime

### `federationBuilder`

The high-level build-time API. Exposes `init` and `build`, plus accessors for `externals`, `config` and `federationInfo`. Wraps the lower-level `loadFederationConfig`, `getExternals` and `buildForFederation`. See [Build Process](core/build-process.md).

### Federation Cache

The content-addressed cache for bundled shared externals. Lives under `node_modules/.cache/native-federation/<projectName>` and keys entries by a SHA-256 checksum of the package names and versions in each bundle. On a cache hit, the build adapter is never invoked. See [Caching](core/build-process.md#caching).

### Build mode

Per-shared-entry setting that controls how the Core groups packages for the adapter: `'default'` folds the entry into the single shared bundle for its platform, `'separate'` gives it a bundle of its own.

### `loadRemoteModule`

The runtime function hosts call to load an exposed module from a remote:

```ts
const mod = await loadRemoteModule({
  remoteName: 'mfe1',
  exposedModule: './Component',
});
```

Accepts an optional type parameter for typed remotes.

### `initFederation`

The runtime bootstrap call. On the host, it takes a manifest (inline object or URL) and sets up the import map from every listed remote. On a remote it is usually called parameter-less during its own startup, so the remote can, in turn, act as a host for *other* remotes.
