# Builder

> The @angular-architects/native-federation:build target — what it puts in angular.json, how it wraps Angular's ApplicationBuilder, and every option it accepts.

The `@angular-architects/native-federation:build` target is a thin wrapper around `@angular/build:application`. It runs the Native Federation build (shared bundles, exposed modules, `remoteEntry.json`), then delegates to Angular's Application Builder for the host/remote app itself. The same builder is used for both `build` and `serve`; the difference is configured by options.

> **Note:** On **Angular 22+** the adapter ships under the base package `@angular-architects/native-federation` (22.x) — the names on this page assume it. On **Angular 20/21** the identical builder is published as `@angular-architects/native-federation-v4:build`; substitute the `-v4` package name throughout. See [Getting Started](getting-started.md#1-install) for the version matrix.

**On this page**

- [The angular.json layout](#the-angularjson-layout)
- [What the builder does](#what-the-builder-does)
- [Builder options](#builder-options)
- [tsConfig and module resolution](#tsconfig-and-module-resolution)
- [Native import maps](#native-import-maps)
- [Subresource Integrity](#subresource-integrity)
- [Dev server & hot reload](#dev-server--hot-reload)
- [Developing npm-linked shared libraries](#developing-npm-linked-shared-libraries)
- [watchLinkedDeps](#watchlinkeddeps)
- [Nx and @angular/build preloading](#nx-and-angularbuild-preloading)
- [Locale-aware output paths](#locale-aware-output-paths)

## The `angular.json` Layout

The `init` schematic _doesn't_ replace your existing build — it shifts everything sideways and slots the federation builder on top. After running it, every federated project has four targets:

```json
{
  "architect": {
    "build":           { "builder": "@angular-architects/native-federation:build", ... },
    "serve":           { "builder": "@angular-architects/native-federation:build", ... },
    "esbuild":         { "builder": "@angular/build:application", ... },        // ← old build
    "serve-original":  { "builder": "@angular/build:dev-server", ... }          // ← old serve
  }
}
```

- **`esbuild`** — the original `@angular/build:application` target (renamed from `build`). The federation builder calls into it.
- **`serve-original`** — the original `@angular/build:dev-server` target. The federation builder uses its options when serving.
- **`build`** — the new federation build. Its `configurations` point at `<project>:esbuild:production` / `<project>:esbuild:development`.
- **`serve`** — the new federation dev-server target. Points at `<project>:serve-original:development`.

The schematic's defaults look like this:

```json
"build": {
  "builder": "@angular-architects/native-federation:build",
  "options": {
    "projectName": "mfe1",
    "tsConfig": "projects/mfe1/tsconfig.federation.json",
    "cacheExternalArtifacts": true,
    "entryPoints": ["projects/mfe1/src/main.ts"]
  },
  "configurations": {
    "production":  { "target": "mfe1:esbuild:production" },
    "development": { "target": "mfe1:esbuild:development", "dev": true }
  },
  "defaultConfiguration": "production"
},
"serve": {
  "builder": "@angular-architects/native-federation:build",
  "options": {
    "projectName": "mfe1",
    "tsConfig": "projects/mfe1/tsconfig.federation.json",
    "target": "mfe1:serve-original:development",
    "rebuildDelay": 500,
    "cacheExternalArtifacts": true,
    "dev": true,
    "devServer": true,
    "port": 0,
    "entryPoints": ["projects/mfe1/src/main.ts"]
  }
}
```

## What the Builder Does

For every `ng build` or `ng serve` the federation builder runs roughly the following sequence:

1. Resolve the underlying target (the `esbuild` or `serve-original` target referenced by `options.target`) and load its options.
2. Construct an `NFBuildAdapter` over esbuild and Angular's `SourceFileCache` (see [below](#how-the-adapter-wraps-esbuild)).
3. Call the core's `normalizeFederationOptions` with the project's `federation.config.mjs` (falling back to `federation.config.js` if no `.mjs` file exists, or the explicit `federationConfigPath` option if set) and `tsconfig.federation.json`.
4. Validate that there are no invalid `.`-imports in the externals (a current Vite limitation — see [vitejs/vite#21036](https://github.com/vitejs/vite/issues/21036)). Shared mappings are checked by the core itself, at the end of `normalizeFederationOptions` — on the set left after pruning and wildcard expansion, so paths that were never going to be published stay quiet.
5. Run the core's `buildForFederation` — this writes the shared bundles, exposed modules and `remoteEntry.json` into the configured output directory.
6. If I18N is configured, post-process the federation artifacts with `localize-translate` (one bundle copy per target locale).
7. Hand off to `buildApplication` (build) or `serveWithVite` (serve), passing the computed externals through to esbuild and registering federation middleware on the dev server.
8. In watch / dev mode: re-run steps 5–6 on every Angular rebuild, debounced by `rebuildDelay`.

The build is rejected entirely (no federation artifacts written) when the underlying Angular build fails. Federation rebuilds in dev mode are cancellable: a new file change aborts an in-flight federation rebuild via an `AbortSignal` instead of stacking up.

## Builder Options

Every property below comes from `src/builders/build/schema.json`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `target` | `string` | — | The Angular target this builder delegates to (e.g. `mfe1:esbuild:production`, or for serve `mfe1:serve-original:development`). Required when used as a `serve` builder; for `build` it's set per `configuration`. |
| `projectName` | `string` | — | The Angular project name. Used for the federation cache key and for default output paths. |
| `tsConfig` | `string` | underlying target's tsconfig | A specific tsconfig used _only_ for the federation build (exposed modules + shared mappings). The schematic creates `tsconfig.federation.json` for this purpose so the federation build doesn't pick up your test types or app-only paths. It also drives esbuild's module resolution, so it must declare or extend the workspace `baseUrl`/`paths` (see [below](#tsconfig-and-module-resolution)). |
| `federationConfigPath` | `string` | `federation.config.mjs` | Path to the project's federation config file. Point it elsewhere if your config doesn't sit next to the project or isn't named `federation.config.mjs`. _Added in 22.0.1._ |
| `entryPoints` | `string[]` | `[<tsConfig dir>/src/main.ts]` | Entry points used to detect which dependencies are actually used. Combined with `features.ignoreUnusedDeps` in `federation.config.mjs` this drives shaking of unused shared externals. Seeded by the `init` / `update-v4` schematics; defaults to `[<sourceRoot>/main.ts]`. |
| `dev` | `boolean` | `false` | Enables development mode for the federation build: source maps, unminified output, watch-mode SSE notifications, and (for SSR) the dev host-instance bridge that registers the federation loader inside Vite's SSR graph. Set automatically by the `development` configuration. |
| `watch` | `boolean` | `false` | Re-runs the federation build on file changes. Set automatically when serving; useful for `ng build --watch`. |
| `watchLinkedDeps` | `boolean` | `false` | Watch npm-linked shared libraries so rebuilding one reloads this app. Off by default because it polls the linked checkout for as long as the dev server runs. _Added in 22.1.2._ See [Developing npm-linked shared libraries](#developing-npm-linked-shared-libraries). |
| `devServer` | `boolean` | _inferred from target name_ | Force the builder into dev-server mode. By default the builder serves whenever the target name contains `"serve"`; override here if your naming is unusual. |
| `port` | `number` | `0` | Port for the dev server. `0` inherits the underlying `serve-original` target's port (which the schematic seeds with the `--port` argument). |
| `rebuildDelay` | `number` (ms) | `2000` | Debounce window before re-running the federation build after Angular reports a change. Bursts of file saves get coalesced; in-flight rebuilds are cancelled in favour of the latest. The schematic seeds `500` for `serve` for snappy DX. |
| `cacheExternalArtifacts` (alias `cache`) | `boolean` | `true` | Reuse the bundled external artifacts from `node_modules/.cache/native-federation/<project>` across builds. See [core caching](../core/caching.md) for the checksum logic. |
| `baseHref` | `string` | — | Overrides the underlying Angular target's `baseHref`. Also used by the dev server to strip the prefix from federation artifact requests. |
| `define` | `Record<string, string>` | — | Global identifiers replaced at build time, merged over the Angular target's own `define`. Applies to the app bundle, under both `build` and `serve`, and to the exposed modules and shared mappings, so a remote's identifiers are replaced before a host loads it. String values need their own quotes, e.g. `nx run app:build --define.BUILD_ID="\"'123'\""`. Angular's own flags (`ngDevMode`, `ngJitMode`) still win. _Added in 22.2.0._ |
| `outputPath` | `string` | `dist/<project>` | Output base directory. The federation artifacts land in `<outputPath>/browser/<sourceLocale?>`. |
| `ssr` | `boolean` | `false` | Marks this build as SSR-capable. When true, externals are passed through Angular's `externalDependencies` instead of an esbuild plugin (the SSR build path doesn't run that plugin). The CLI's `server.mjs` is emitted as-is; the federation loader is registered at launch via the `node --import @angular-architects/native-federation/node-preload …` preload (prod) or the dev host-instance bridge (`ng serve`). See [SSR & Hydration](ssr.md). |
| `esmsInitOptions` | `object` | `{ shimMode: true }` | Options injected into the `<script type="esms-options">` tag added to `index.html`. Forwarded to [es-module-shims](https://github.com/guybedford/es-module-shims). Set `{ shimMode: false }` to opt out of shim mode and use the browser's [native import maps](#native-import-maps) instead. |
| `skipHtmlTransform` | `boolean` | `false` | Skip the `index.html` rewrite (script tags → `type="module-shim"` + `esms-options`). Useful if you template `index.html` yourself. |
| `buildNotifications` | `object` | `{ enable: true, endpoint: '/@angular-architects/native-federation:build-notifications' }` | Server-Sent Events stream that notifies a host when a remote finishes (re)building. See [below](#dev-server--hot-reload). |

## tsConfig and Module Resolution

The `tsConfig` option doesn't only select which files are compiled — it is passed through to esbuild's `BuildOptions`, so it also decides how bare specifiers resolve.

The reason is that Angular's compiler plugin only hooks `onLoad`, leaving esbuild to resolve specifiers itself. Without an explicit tsconfig, esbuild only honours `baseUrl`/`paths` from an auto-discovered file named exactly `tsconfig.json` — which misses `tsconfig.app.json` / `tsconfig.lib.json` layouts and breaks workspace imports with `Could not resolve`. Angular's own application builder passes the same normalized path.

Practically: the tsconfig you point `tsConfig` at must declare the workspace `baseUrl` and `paths`, or `extends` a config that does. The `tsconfig.federation.json` the schematic generates already extends the app tsconfig, and through it the workspace root config, so generated projects need no change.

### One tsconfig per build context

_Since 22.2.0._ The core builds shared mappings apart from the exposed modules ([Mapping bundles](../core/configuration.md#mapping-bundles)), so the federation build runs one Angular compilation per mapping bundle plus one for `mapping-or-exposed`. When the target declares its own `tsConfig`, each of those compiles against a generated tsconfig under the federation cache (`node_modules/.cache/native-federation/<project>/tsconfig/`). It `extends` your `tsConfig` and lists only that context's own entry points in `files`, so no context compiles another's code, and an edited mapping is picked up in watch mode. Your `tsconfig.federation.json` is never rewritten. Without a `tsConfig` on the target, the Angular target's own tsconfig is used as it is.

The federation tsconfig therefore needs no `files` of its own. One that still lists them gets a one-time warning:

```
"projects/mfe1/tsconfig.federation.json" lists "files", which the federation build ignores:
every build context compiles its own exposes and shared mappings. Remove "files" to silence this.
```

`ng update` removes the key for you through the [`update22-2`](schematics.md#update22-2) migration.

### Shared Mappings and Synthesized Imports

_Fixed in 22.1.3._ esbuild's `external` list matches a specifier as written, so it only caught imports spelled `@myorg/ui`. Angular emits a deep relative path for any reference it has to **synthesize** — a template dependency reached through an imported `NgModule`, for one — and those paths were bundled into the app next to the federated copy of the same library. Two module instances of one library is what `NG0201` reports at runtime; `providedIn: 'root'` services and pipes duplicate the same way. The duplication looked intermittent because only synthesized references were affected: a standalone component named in `imports: []` and an injected service both emit bare specifiers, and were always external.

The adapter now runs a resolver over relative import statements during the app build. Where the imported file sits inside a shared mapping and that mapping's entry point re-exports it under the same names, the import is rewritten onto the mapped specifier and left external. The rule itself lives in the core (`createMappingImportResolver`, see [API Reference](../core/api-reference.md#softarcnative-federationinternal)); where the entry point is readable and omits the file, the build warns and names the symbols to add to the barrel.

### `File … not found in TypeScript compilation`

_Fixed in 22.1.2._ Windows reports a directory under whatever drive-letter case the caller used, so the workspace root an Nx invocation inherits from the shell could differ by case alone from the one esbuild and `process.cwd()` produce. The Angular compiler plugin's emitted-file cache is keyed off the first and looked up through the second, so every exposed module reported the error above and pointed at `files` / `include` in a tsconfig that was fine — which is why a remote built from one terminal and failed from another on the same machine. The builder now re-spells the workspace root the way `fs.realpath` reports it, once per invocation, and anchors exposed entry points on that root.

## Native Import Maps

_Since 22.0.3._ By default the adapter runs [es-module-shims](https://github.com/guybedford/es-module-shims) in **shim mode** (`esmsInitOptions: { shimMode: true }`), which rewrites the app's script tags to `type="module-shim"`. Modern browsers now support import maps natively, so you can opt out of shim mode and let the browser resolve the import map directly:

```json
"options": {
  "esmsInitOptions": { "shimMode": false }
}
```

The build and runtime sides must agree. If you disable shim mode in the builder, disable it on the runtime too — pass `shimMode: false` to the orchestrator's `useShimImportMap` (or `initFederation`) in your `main.ts`:

```ts
initFederation('federation.manifest.json', {
  ...useShimImportMap({ shimMode: false }),
  // ...
});
```

Native import maps require a recent browser (Chrome/Edge 133+, Safari 18.4+, Firefox 150+); shim mode remains the default for broader compatibility. See [Runtime](runtime.md#initfederation) for the runtime side.

## Subresource Integrity

_Since 22.0.1._ When Angular's own [`subresourceIntegrity`](https://angular.dev/reference/configs/workspace-config) option is enabled, the CLI stamps `integrity` and `crossorigin` attributes onto the `polyfills` and `main` script tags. The federation builder now preserves those attributes when it rewrites the tags for federation — only the `type` attribute is changed. This keeps SRI hashes intact for environments that require them (e.g. PCI DSS compliance).

## Dev Server & Hot Reload

When serving, the builder layers two things on top of Angular's Vite-based dev server:

- **Federation file middleware.** Every request that matches a file under the federation output dir (the shared bundles, the exposed modules, `remoteEntry.json`) is served straight from disk with permissive CORS headers. This is what lets a host `fetch` a remote on `localhost:4201` from a shell on `localhost:4200`.
- **Build notifications (SSE).** When `buildNotifications.enable` is true (the default), the dev server exposes an event stream at `/@angular-architects/native-federation:build-notifications`. Hosts can subscribe and trigger a reload whenever a remote rebuilds. The stream emits `completed`, `cancelled` and `error` events. [More on automatic shell reloading](https://www.angulararchitects.io/en/blog/fixing-dx-friction-automatic-shell-reloading-in-native-federation/).

## Developing npm-linked Shared Libraries

A common local-development setup is to build a shared library in its own repo with `ng build --watch` (ng-packagr) and pull it into the host with [`npm link`](https://docs.npmjs.com/cli/commands/npm-link).

Because Native Federation shares such a library as an _external_, it is excluded from Angular's own build — the change lands under `node_modules`, which Angular's build watcher skips. The federation builder covers that gap: it detects linked shared packages and re-bundles them on change, so no cache clear or dev-server restart is needed.

Requirements:

- The library is listed in the `shared` section of your `federation.config.mjs` (via `shareAll`, an explicit `shared` entry, or `sharedMappings`).
- Its package directory under `node_modules` is a **symlink whose target lies outside `node_modules`** — what `npm link` produces. _Since 22.1.2_, see [What counts as linked](#what-counts-as-linked).
- The library is rebuilt on change so the symlink target actually updates (`ng build --watch` for an Angular library).
- For the changes an ng-packagr rebuild leaves uncovered, [`watchLinkedDeps: true`](#watchlinkeddeps) on the target you are running.

```bash
# 1. In the shared library's repo — build to dist/ and keep watching
ng build --watch

# 2. Publish the built package to the local npm link registry
cd dist/my-lib && npm link

# 3. In the host repo — link the package into node_modules
npm link @my-scope/my-lib

# 4. Run the host as usual
ng serve
```

Editing a source file in the library now rebuilds its `dist/`, and the builder re-bundles the affected shared external and logs `Done!` — see [`watchLinkedDeps`](#watchlinkeddeps) for which edits a running dev server picks up on its own. To also refresh the browser automatically, enable [SSE-based reloading](#dev-server--hot-reload) with `initFederation(manifest, { sse: true })`; otherwise refresh manually.

### `watchLinkedDeps`

_Since 22.1.2 (requires `@softarc/native-federation` ≥ `4.5.0`)._ Watching a linked checkout means polling it for as long as the dev server runs, so it is opt-in. Enable it on the target you serve:

```json
"serve": {
  "builder": "@angular-architects/native-federation:build",
  "options": {
    "target": "host:serve-original:development",
    "watchLinkedDeps": true
  }
}
```

The option exists on both the `:build` and the `:remote` builder and defaults to `false`.

Leaving it off still covers most edits. A library's type declarations are a TypeScript input, and the adapter resolves them to their real path outside `node_modules`, so an ng-packagr rebuild — which rewrites `dist/*.d.ts` alongside the JavaScript — is noticed and re-bundled either way. The option adds the changes that touch no such input: a JavaScript-only edit, or a rebuild whose emitted types come out byte-identical. A cold `ng build` re-bundles a changed linked library either way, since each linked package's content is checksummed on every build; a running `ng serve` is the weaker case, where such a change can stay stale until you restart the server.

So the default is never a silent surprise, a watching build that finds a linked shared package while the option is off says so once at startup:

```
INFO  Detected npm-linked shared packages: @my-scope/my-lib. Set 'watchLinkedDeps' to
      true to rebuild when they change.
```

### What counts as linked

_Since 22.1.2._ A symlink on its own qualifies a package only where it points outside `node_modules`. Package managers that symlink by default — pnpm's default `isolated` linker, Yarn's `nodeLinker: pnpm` — make **every** dependency a symlink, which used to put the whole dependency graph on the watch list. A package is treated as a live checkout when its real path resolves outside every `node_modules` tree, which is what `npm link` produces and what a package manager's internal symlink does not.

> [!WARNING] **Reach for `watchLinkedDeps`, not `preserveSymlinks`.** Angular draws the same line but wires it to `preserveSymlinks`: it ignores `**/node_modules/**` when watching the project root and skips that ignore when the flag is on, precisely so `npm link` keeps working. It has to overload one flag because its resolver decides which path esbuild sees. The adapter resolves each shared package's real path itself, so `watchLinkedDeps` governs watching and nothing else. `preserveSymlinks` changes module resolution — it is the classic route to loading two copies of a singleton like `@angular/core`, and under pnpm it makes every dependency resolve through `.pnpm`. Here it would also *shrink* the watch set, since the adapter skips any path with a `node_modules` segment and `preserveSymlinks` is exactly what makes a linked library's files report as `node_modules/@my-scope/my-lib/…` instead of their real location.

### How it works

With `watchLinkedDeps` on, the builder adds each linked checkout's real directory to the federation file watcher. Those directories are watched by **polling**, because ng-packagr rewrites its `dist` atomically and the replaced inode defeats `fs.watch`; a short debounce coalesces that multi-file write into one rebuild. Only the affected shared externals are re-bundled; registry-installed dependencies keep the version-only cache fast path (see [core caching](../core/caching.md#symlinked-npm-link-packages)).

## Nx and `@angular/build` Preloading

The builder disables two Angular build features by setting environment variables before `@angular/build` loads:

- **`NG_BUILD_OPTIMIZE_CHUNKS=0`** — Angular's chunk optimization pass (on by default in Angular 22 for production builds, from three lazy chunks upwards) re-bundles the esbuild output _after_ Native Federation has computed its import map, so shared externals such as `@angular/core` are no longer resolved as singletons. At runtime that surfaces as **`ɵɵdefineComponent is not a function`**.
- **`NG_BUILD_PARALLEL_TS=0`** — lets the compilation steps share one cache, which is considerably faster here.

`@angular/build` reads those variables **once**, when it is first loaded. Under the Angular CLI the builder is loaded first, so this works. Nx loads `@angular/build` before it resolves the builder (`nx/src/adapter/compat.js` requires `@angular/build/private` to stub a version assertion), so the variables arrive too late and both features stay on — see [#107](https://github.com/native-federation/angular-adapter/issues/107) / [#114](https://github.com/native-federation/angular-adapter/issues/114).

The builder detects this and re-applies both settings to the already-loaded `@angular/build`, logging:

```
INFO  @angular/build was already loaded when this builder started (Nx preloads it),
      so its build environment was stale; re-applied useParallelTs=false,
      optimizeChunksThreshold=Infinity.
```

That line is informational — the problem was corrected and no action is needed. Two things are worth knowing:

- **Nx replays cached artifacts**, so run one uncached build (`nx build my-app --skip-nx-cache`) if a previous build produced broken output.
- To set the variables yourself instead, put them in a workspace-root `.env` file — Nx loads dotenv files before `@angular/build` — and add `{ "env": "NG_BUILD_OPTIMIZE_CHUNKS" }` to the target's `inputs` so the cache reacts to changes. Setting `NF_NG_BUILD_ENV_REPLAY=0` then keeps the builder from touching the loaded module at all.

If the builder instead warns that it _could not_ re-apply a setting, `@angular/build` has changed internally: use the `.env` approach and report it upstream.

## Locale-aware Output Paths

When the underlying Angular target has `localize` enabled (or an array of locales) the federation artifacts are written under the source-locale subfolder, mirroring Angular's convention:

```
dist/mfe1/browser/
├── en/                    ← source locale, original federation artifacts
│   ├── remoteEntry.json
│   ├── _angular_core.<hash>.js
│   └── ...
├── de/                    ← translated copy, generated by localize-translate
│   ├── remoteEntry.json
│   └── ...
└── fr/
    └── ...
```

Configure your production `federation.manifest.json` to point at the locale-specific URL (`/de/remoteEntry.json`). See [I18N](i18n.md) for the details.

## How the Adapter Wraps esbuild

For builds that emit _federation_ artifacts (shared externals, exposed modules, mapped paths) the adapter creates two kinds of esbuild context:

- **Mappings & exposed modules** are bundled with Angular's full toolchain (the AOT compiler plugin, stylesheet handling, the target's `define`, …) so an exposed component compiles exactly like it would in your app. There is one such context per mapping bundle plus one for `mapping-or-exposed`, each with its [own tsconfig](#one-tsconfig-per-build-context).
- **Shared externals from `node_modules`** are bundled with a plainer esbuild context — they're already-compiled JS and don't need the Angular plugins.

All contexts share the same `SourceFileCache` Angular uses for incremental rebuilds, so a TypeScript file invalidated in the federation build is also picked up by the next Angular rebuild. Outside watch mode every mapping and exposed context is disposed before the app build starts, which resets Angular's shared TypeScript compilation state; esbuild itself keeps running for the app build.

## Related

- [Schematics](schematics.md) — the schematic that wires this `angular.json` for you.
- [Custom Builder](custom-builder.md) — drop in extra esbuild plugins via `runBuilder`.
- [Core: Build Process](../core/build-process.md) — the underlying lifecycle the builder is wrapping.
- [Core: Caching](../core/caching.md) — what `cacheExternalArtifacts` caches and how invalidation works.
