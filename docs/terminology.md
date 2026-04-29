# Terminology

> Glossary of Native Federation terms — manifest, remoteEntry.json, remote, host, external, exposed module, shared dependency, build adapter and more.

A shared vocabulary for working with Native Federation. The same terms show up across the Core builder, the runtime, the orchestrator, and every adapter — this page is the canonical definition of each one.

## Actors

### Host

The application that loads remotes. Also called the *shell*. A host is a regular web application built the same way as any other — it just reaches out at runtime to pull in code from separately deployed remotes. From the framework's perspective this looks like ordinary lazy loading; the difference is that the host doesn't know the remotes at compile time. A host has its own `federation.config.js` (without `exposes`) and produces its own `remoteEntry.json`.

### Remote

A separately built and deployed application that publishes one or more EcmaScript modules for hosts (or other remotes) to consume. In micro-frontend terms, a remote represents a subdomain within your architecture — typically one remote per team or bounded context. Each remote has its own `name`, its own `federation.config.js`, and its own `remoteEntry.json`. Names are npm-style: `'mfe1'`, `'@org/mfe1'`, `'team/mfe1'`.

### Micro Frontend (MFE)

A remote, viewed through the lens of the micro-frontend architecture. The terms are used interchangeably in these docs: every micro frontend is a remote, and in practice every remote in a micro-frontend architecture *is* the MFE for a team's subdomain.

### Runtime

The small browser library that boots federation on the host — initializes federation (`initFederation`), fetches remote manifests, resolves shared dependencies and exposes `loadRemoteModule`. The default runtime is `@softarc/native-federation-runtime`. See [Runtime](runtime/index.md).

### Orchestrator

The next-generation browser runtime — `@softarc/native-federation-orchestrator` — intended to replace the default Runtime as the recommended way to load remotes on the host. It speaks the same `remoteEntry.json` contract but adds semver-range resolution for shared dependencies and persistent caching of `remoteEntry.json` in `localStorage` or `sessionStorage`. Works in SPAs, plain HTML pages and server-rendered hosts; does not yet have direct SSR support. See [Orchestrator](orchestrator/index.md).

### Build Adapter

A thin shim that plugs a specific bundler (esbuild, Angular CLI, Vite, Rspack, …) into the Core builder. Build adapters implement the `NFBuildAdapter` contract (`setup` / `build` / `dispose`) and let the Core stay bundler-agnostic. See [Build Adapters](core/build-adapters.md) and [Build Your Own Adapter](adapters/build-your-own.md).

## Artifacts

### `remoteEntry.json`

The public contract of a remote — one JSON file written alongside the bundled output by every Native Federation build. It tells hosts exactly what the remote publishes, which packages it expects to share, and where to find the corresponding files. Shape:

```ts
interface FederationInfo {
  name: string;
  exposes: ExposesInfo[];
  shared: SharedInfo[];
  chunks?: Record<string, string[]>;
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

A [W3C-standard browser feature](https://html.spec.whatwg.org/multipage/webappapis.html#import-maps) for redirecting bare module specifiers to URLs. Native Federation produces an `importmap.json` alongside `remoteEntry.json` in every build. At runtime, the orchestrator merges the import maps of host and remotes, resolves version conflicts, and injects the result into the page so imports like `@angular/core` resolve to the single chosen file.

### Chunk (`@nf-internal/*`)

A shared bit of code the bundler split off from one or more shared externals. Chunks avoid duplicating code that multiple externals have in common. In `remoteEntry.json` they appear under synthetic package names like `@nf-internal/chunk-IXOA6WTM`. With `features.denseChunking` enabled, they move to a dedicated `chunks` object and each shared entry gets a `bundle` property linking it to its chunk group.

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

A shared-dependency flag that says "only one instance of this package may ever be loaded at runtime". Required for libraries with internal state — Angular, React, `zone.js`, state stores. When two remotes disagree on the version of a singleton, the orchestrator picks one winner; without `singleton: true`, each remote is free to run its own copy.

### strictVersion

A flag that turns a version mismatch from a warning into a runtime error. With `strictVersion: false` the orchestrator falls back to a compatible version; with `strictVersion: true` it throws. Use it when you'd rather fail fast than discover a subtle incompatibility in production.

### requiredVersion

The semver range a consumer expects of a shared dependency — written into `remoteEntry.json` so the orchestrator can pick a version that satisfies every remote. Set it to `'auto'` to have the helper read the actual version from the closest `package.json` (the recommended default).

### Share Scope

A named bucket of shared dependencies. Two remotes share a package only if they use the same share scope (and the same package name). Most apps never set one; it's useful when a single page hosts multiple independently versioned federation graphs that must not cross-contaminate.

### Version Mismatch

What happens when two remotes declare different versions of the same shared dependency. The orchestrator resolves the conflict using semver and the flags above: it may fall back to a compatible version, pick the higher version (for singletons), or throw (`strictVersion`).

## Configuration

### `federation.config.js`

The single configuration file every host and every remote owns. Describes `name`, `exposes`, `shared`, `skip`, feature flags, and more. Loaded by the Core at build time via `withNativeFederation`. See [`federation.config.js`](core/configuration.md) for the complete reference.

### `withNativeFederation`

The helper you wrap your config in. Applies defaults, prepares the skip list, resolves `tsconfig` mapped paths, and returns a `NormalizedFederationConfig` the builder consumes.

### Skip list

An array of strings, regular expressions, or predicates that opts specific packages out of sharing. The list you provide is merged with `DEFAULT_SKIP_LIST` — which already excludes Native Federation's own packages, `es-module-shims`, `tslib/` and everything under `@types/`.

> **Note:** **Skip != exclude.** A skipped package is still bundled into the remote — otherwise the remote couldn't run standalone. Skip only prevents the package from being extracted into a *shared* bundle.

### Feature Flag

An opt-in behavior toggle under `features` on the federation config — currently `ignoreUnusedDeps`, `denseChunking` and `mappingVersion`. See [Feature Flags](core/configuration.md#features).

## Build & runtime

### `federationBuilder`

The high-level build-time API. Exposes `init`, `build`, `close` plus accessors for `externals`, `config` and `federationInfo`. Wraps the lower-level `buildForFederation`, `rebuildForFederation`, and cache primitives. See [Build Process](core/build-process.md).

### Federation Cache

The content-addressed cache for bundled shared externals. Lives under `node_modules/.cache/native-federation/<projectName>` and keys entries by a SHA-256 checksum of the package names and versions in each bundle. On a cache hit, the build adapter is never invoked. See [Caching](core/caching.md).

### Build mode

Per-shared-entry setting that controls how the Core groups packages for the adapter: `'default'` (all default externals in one pass), `'separate'` (one pass per entry), `'package'` (one pass per package, including its secondaries — required for per-package `chunks`).

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
