# Builder

> The @angular-architects/native-federation:build builder — the angular.json layout it expects, every option it accepts, and what it does on build and on serve.

The adapter registers one builder, `@angular-architects/native-federation:build`, and the `init` schematic points both the `build` and the `serve` target at it. It is a wrapper: it runs the federation build first, then delegates to Angular's own `@angular/build:application` (for `ng build`) or its Vite-based dev-server (for `ng serve`), injecting esbuild plugins and dev-server middleware along the way.

## The `angular.json` Layout

The schematic rewrites four targets. The originals are kept under new names, and the federation builder is inserted in front of them:

```json
{
  "projects": {
    "mfe1": {
      "architect": {
        "esbuild": {
          "builder": "@angular/build:application",
          "options": { "browser": "projects/mfe1/src/main.ts", "...": "..." }
        },
        "build": {
          "builder": "@angular-architects/native-federation:build",
          "options": {},
          "configurations": {
            "production": { "target": "mfe1:esbuild:production" },
            "development": { "target": "mfe1:esbuild:development", "dev": true }
          },
          "defaultConfiguration": "production"
        },
        "serve-original": {
          "...": "the project's original serve target, with port set"
        },
        "serve": {
          "builder": "@angular-architects/native-federation:build",
          "options": {
            "target": "mfe1:serve-original:development",
            "rebuildDelay": 500,
            "dev": true,
            "cacheExternalArtifacts": false,
            "port": 0
          }
        }
      }
    }
  }
}
```

`target` is the pivot: it names the target that actually builds the application. The federation builder reads that target's options — `browser`, `tsConfig`, `outputPath`, `polyfills`, `localize`, `verbose` — and hands them to Angular after adding its own plugins. A project whose original `build` used `@angular-devkit/build-angular:browser` is switched to `@angular/build:application` first; `main` is renamed to `browser`, and `buildOptimizer`, `vendorChunk` and `commonChunk` are dropped.

> **Note:** If the referenced target still resolves to `@angular-devkit/build-angular:browser-esbuild`, the builder prints an upgrade notice and stops. Run `ng g @angular-architects/native-federation:appbuilder` to move the project to the Application Builder — see [Schematics → appbuilder](schematics.md#appbuilder).

## Build vs Serve

The builder decides which mode to run in from the `devServer` option, falling back to whether the target name contains `serve`:

- **Build.** Runs `buildForFederation` from the core, then `buildApplication` from `@angular/build`, passing the federation plugins as `codePlugins` and an `indexHtmlTransformer`.
- **Serve.** Resolves the dev-server target's `buildTarget` to find the real application options, then runs `serveWithVite` with the same plugins plus middleware that serves federation artifacts off disk.

In both modes the sequence is the same:

1. Resolve the referenced target's options and validate them against its builder's schema.
2. Register the Angular esbuild adapter with the core (`setBuildAdapter`), so shared packages compile with your project's TypeScript and Angular options.
3. Load `federation.config.js` — inferred as a sibling of the target's `tsConfig`, i.e. `<dirname(tsConfig)>/federation.config.js`.
4. Register Angular locale data in the config if the project uses i18n, then compute the externals list from the config.
5. Delete and recreate the federation output folder (`<outputPath>/browser`, plus the source-locale segment when localizing), run `buildForFederation`, and translate the artifacts per locale if i18n is configured.
6. Hand control to Angular with two esbuild plugins injected: the shared-mappings plugin and an `externals` plugin that marks every shared package as external (all but `tslib`).

## Builder Options

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `target` | string | — | The target that builds the application (`<project>:esbuild:production`) or serves it (`<project>:serve-original:development`). Required in practice. |
| `dev` | boolean | `false` | Development mode. Passed through to the core, which then emits dev-friendly artifacts and skips production-only work. |
| `watch` | boolean | `false` | Keep the Angular build running and rebuild federation artifacts after each successful application rebuild. |
| `port` | number | `0` | Overrides the dev-server port. `0` leaves the target's own port in place. |
| `open` | boolean | `true` | Open a browser on serve. |
| `rebuildDelay` | number | `2000` | Milliseconds to wait after an application rebuild before rebuilding the federation artifacts. Lowered to `500` in the generated serve target. |
| `shell` | string | `''` | Experimental. |
| `skipHtmlTransform` | boolean | `false` | Leave `index.html` untouched — see [Index HTML transform](#index-html) below. |
| `baseHref` | string | — | Overrides the target's `baseHref`. Also stripped from incoming dev-server request URLs before artifacts are looked up. |
| `outputPath` | string | — | Overrides the target's output path. Defaults to `dist/<project>` when neither sets one. |
| `esmsInitOptions` | object | `{ "shimMode": true }` | Written into `index.html` as `<script type="esms-options">`. Any [es-module-shims init option](https://github.com/guybedford/es-module-shims#init-options) is accepted; your keys are merged over `shimMode: true`. |
| `ssr` | boolean | `false` | Federate the server build too. Ignored while `dev` is on. See [SSR](ssr.md). |
| `instrumentForCoverage` | boolean | `false` | Instrument served and built bundles with Istanbul so E2E runs (Cypress, Playwright) can collect coverage. Uses the same filter as `ng test --code-coverage`. |
| `codeCoverageExclude` | string[] | `[]` | Workspace-relative globs to exclude from that instrumentation. |
| `devServer` | boolean | — | Forces serve mode on or off instead of inferring it from the target name. |
| `buildNotifications` | object | `{ enable: true, endpoint: '/@angular-architects/native-federation:build-notifications' }` | The SSE channel used for hot reload — see [below](#build-notifications). |
| `cacheExternalArtifacts` | boolean | — | Passed straight through to the core's build options, which caches the bundled shared packages between builds. The generated serve target sets it to `false`. |

## <a id="index-html"></a> Index HTML transform

Unless `skipHtmlTransform` is set, the builder rewrites the generated `index.html`:

- The polyfills script tag becomes `<script type="module" …>`.
- The main script tag becomes `<script type="module-shim" …>` — es-module-shims picks it up, which is what makes the shimmed import map apply.
- A `<script type="esms-options">` block is inserted at the top of `<body>` carrying `esmsInitOptions`.

Turning the transform off means wiring those three things yourself; the app will not resolve shared dependencies without them.

## <a id="build-notifications"></a> Dev server & hot reload

When serving in dev mode, the builder mounts two middlewares:

- **The artifact server.** Any request whose path matches a file in the project's browser output is answered directly from disk, with `Access-Control-Allow-Origin: *`. This is how a shell on port 4200 reads a remote's `remoteEntry.json` and bundles from port 4201 without a proxy.
- **The build-notification stream.** An SSE endpoint at `buildNotifications.endpoint`. After each federation rebuild the builder broadcasts `federation-rebuild-complete`; on failure `federation-rebuild-error`, and on a superseded rebuild `federation-rebuild-cancelled`.

The endpoint is written into the dev-mode `remoteEntry.json` as `buildNotificationsEndpoint`, so a host that loads that remote opens an `EventSource` on it and reloads the page when a rebuild completes. See [Runtime → Hot reload watching](../runtime/init-federation.md#hot-reload-watching). Production builds do not emit the field, so nothing connects.

Rebuilds are serialized through a queue: a new application build cancels a federation rebuild that is still waiting out its `rebuildDelay` or still running, and only the last one wins. Cancellations are logged at verbose level.

## Output paths and locales

The federation artifacts are written next to the Angular bundle, into `<outputPath>/browser`. With `localize` configured, the source-locale segment is appended, and the artifacts are translated into the remaining locales after the federation build — see [I18N](i18n.md).

For `ng serve`, only a single inline locale is supported: a `localize` array with more than one entry (or `localize: true`) is ignored while serving.

## Related

- [Schematics](schematics.md) — what wrote this `angular.json` layout, and how to undo it.
- [Angular Config](configuration.md) — the `federation.config.js` the builder loads.
- [Custom Builder](custom-builder.md) — wrapping `runBuilder` to inject your own esbuild plugins.
- [Build Process](../core/build-process.md) — what `buildForFederation` does once the adapter hands over.
