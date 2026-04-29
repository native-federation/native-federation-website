---
applies_to: [v4]
---

# Builder

> The @angular-architects/native-federation-v4:build target — what it puts in angular.json, how it wraps Angular's ApplicationBuilder, and every option it accepts.

The `@angular-architects/native-federation-v4:build` target is a thin wrapper around `@angular/build:application`. It runs the Native Federation build (shared bundles, exposed modules, `remoteEntry.json`), then delegates to Angular's Application Builder for the host/remote app itself. The same builder is used for both `build` and `serve`; the difference is configured by options.

**On this page**

- [The angular.json layout](#the-angularjson-layout)
- [What the builder does](#what-the-builder-does)
- [Builder options](#builder-options)
- [Dev server & hot reload](#dev-server--hot-reload)
- [Locale-aware output paths](#locale-aware-output-paths)

## The `angular.json` Layout

The `init` schematic _doesn't_ replace your existing build — it shifts everything sideways and slots the federation builder on top. After running it, every federated project has four targets:

```json
{
  "architect": {
    "build":           { "builder": "@angular-architects/native-federation-v4:build", ... },
    "serve":           { "builder": "@angular-architects/native-federation-v4:build", ... },
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
  "builder": "@angular-architects/native-federation-v4:build",
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
  "builder": "@angular-architects/native-federation-v4:build",
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
3. Call the core's `normalizeFederationOptions` with the project's `federation.config.mjs` (falling back to `federation.config.js` if no `.mjs` file exists) and `tsconfig.federation.json`.
4. Validate that there are no invalid `.`-imports in the shared mappings or externals (a current Vite limitation — see [vitejs/vite#21036](https://github.com/vitejs/vite/issues/21036)).
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
| `tsConfig` | `string` | underlying target's tsconfig | A specific tsconfig used _only_ for the federation build (exposed modules + shared mappings). The schematic creates `tsconfig.federation.json` for this purpose so the federation build doesn't pick up your test types or app-only paths. |
| `entryPoints` | `string[]` | `[<tsConfig dir>/src/main.ts]` | Entry points used to detect which dependencies are actually used. Combined with `features.ignoreUnusedDeps` in `federation.config.mjs` this drives shaking of unused shared externals. Seeded by the `init` / `update-v4` schematics; defaults to `[<sourceRoot>/main.ts]`. |
| `dev` | `boolean` | `false` | Enables development mode for the federation build: source maps, unminified output, watch-mode SSE notifications, and skips the SSR fstart bootstrap. Set automatically by the `development` configuration. |
| `watch` | `boolean` | `false` | Re-runs the federation build on file changes. Set automatically when serving; useful for `ng build --watch`. |
| `devServer` | `boolean` | _inferred from target name_ | Force the builder into dev-server mode. By default the builder serves whenever the target name contains `"serve"`; override here if your naming is unusual. |
| `port` | `number` | `0` | Port for the dev server. `0` inherits the underlying `serve-original` target's port (which the schematic seeds with the `--port` argument). |
| `rebuildDelay` | `number` (ms) | `2000` | Debounce window before re-running the federation build after Angular reports a change. Bursts of file saves get coalesced; in-flight rebuilds are cancelled in favour of the latest. The schematic seeds `500` for `serve` for snappy DX. |
| `cacheExternalArtifacts` (alias `cache`) | `boolean` | `true` | Reuse the bundled external artifacts from `node_modules/.cache/native-federation/<project>` across builds. See [core caching](../core/caching.md) for the checksum logic. |
| `baseHref` | `string` | — | Overrides the underlying Angular target's `baseHref`. Also used by the dev server to strip the prefix from federation artifact requests. |
| `outputPath` | `string` | `dist/<project>` | Output base directory. The federation artifacts land in `<outputPath>/browser/<sourceLocale?>`. |
| `ssr` | `boolean` | `false` | Marks this build as SSR-capable. When true, externals are passed through Angular's `externalDependencies` instead of an esbuild plugin (the SSR build path doesn't run that plugin), and an `fstart.mjs` Node bootstrap is written next to the server build. See [SSR & Hydration](ssr.md). |
| `esmsInitOptions` | `object` | `{ shimMode: true }` | Options injected into the `<script type="esms-options">` tag added to `index.html`. Forwarded to [es-module-shims](https://github.com/guybedford/es-module-shims). |
| `skipHtmlTransform` | `boolean` | `false` | Skip the `index.html` rewrite (script tags → `type="module-shim"` + `esms-options`). Useful if you template `index.html` yourself. |
| `buildNotifications` | `object` | `{ enable: true, endpoint: '/@angular-architects/native-federation:build-notifications' }` | Server-Sent Events stream that notifies a host when a remote finishes (re)building. See [below](#dev-server--hot-reload). |

## Dev Server & Hot Reload

When serving, the builder layers two things on top of Angular's Vite-based dev server:

- **Federation file middleware.** Every request that matches a file under the federation output dir (the shared bundles, the exposed modules, `remoteEntry.json`) is served straight from disk with permissive CORS headers. This is what lets a host `fetch` a remote on `localhost:4201` from a shell on `localhost:4200`.
- **Build notifications (SSE).** When `buildNotifications.enable` is true (the default), the dev server exposes an event stream at `/@angular-architects/native-federation:build-notifications`. Hosts can subscribe and trigger a reload whenever a remote rebuilds. The stream emits `completed`, `cancelled` and `error` events. [More on automatic shell reloading](https://www.angulararchitects.io/en/blog/fixing-dx-friction-automatic-shell-reloading-in-native-federation/).

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

For builds that emit _federation_ artifacts (shared externals, exposed modules, mapped paths) the adapter creates two distinct esbuild contexts:

- **Mappings & exposed modules** are bundled with Angular's full toolchain (the AOT compiler plugin, stylesheet handling, …) so an exposed component compiles exactly like it would in your app.
- **Shared externals from `node_modules`** are bundled with a plainer esbuild context — they're already-compiled JS and don't need the Angular plugins.

Both contexts share the same `SourceFileCache` Angular uses for incremental rebuilds, so a TypeScript file invalidated in the federation build is also picked up by the next Angular rebuild.

## Related

- [Schematics](schematics.md) — the schematic that wires this `angular.json` for you.
- [Custom Builder](custom-builder.md) — drop in extra esbuild plugins via `runBuilder`.
- [Core: Build Process](../core/build-process.md) — the underlying lifecycle the builder is wrapping.
- [Core: Caching](../core/caching.md) — what `cacheExternalArtifacts` caches and how invalidation works.
