---
applies_to: [v4]
---

# Schematics

> The Angular adapter's schematics: init/ng-add, appbuilder, update-v4, update18 and remove — plus the Nx generator.

The adapter ships a small collection of schematics for the Angular CLI (and an Nx generator). They scaffold projects, migrate older setups forward, and tear federation back out cleanly when you no longer need it.

**On this page**

- [init / ng-add](#init--ng-add)
- [appbuilder](#appbuilder)
- [update-v4](#update-v4)
- [update18 (auto migration)](#update18-auto-migration)
- [remove](#remove)
- [Nx generator](#nx-generator)

## init / ng-add

```bash
ng add @angular-architects/native-federation-v4 \
  --project <name> --port <port> --type <remote|host|dynamic-host>
```

Initializes a project for Native Federation. `ng add` and `ng g …:init` both run the same factory.

### Inputs

| Option | Type | Description |
| --- | --- | --- |
| `--project` | `string` | Project name from `angular.json`. Falls back to the workspace's `defaultProject`, then to the first project. |
| `--port` | `number` | Dev server port. Defaults to `4200`. Also used as the SSR port for hosts. |
| `--type` | `'host' \| 'dynamic-host' \| 'remote'` | Defaults to `remote`. Determines the shape of the generated `main.ts`. |

### What it changes

1. **Polyfills.** Adds `es-module-shims` to the polyfills array (or to a `polyfills.ts` file).
2. **Federation config.** Generates `projects/<name>/federation.config.mjs` from a template — for remotes, the project's `app.component.ts` is auto-detected and exposed as `./Component`. The template enables `denseChunking` and adds an `@angular/core` override with `includeSecondaries: { keepAll: true }`. Skipped if a config already exists.
3. **tsconfig.** Generates `projects/<name>/tsconfig.federation.json` — extends the project's `tsconfig.json`, narrows `types` to `[]`, and only includes `src/**/*.ts` minus specs.
4. **angular.json.** Switches the existing build to `@angular/build:application` (if it isn't already), renames it to `esbuild`, renames the existing serve to `serve-original`, and slots the `@angular-architects/native-federation-v4:build` builder into `build` + `serve`. See [the angular.json layout](builder.md#the-angularjson-layout).
5. **main.ts split.** Moves your existing `main.ts` to `bootstrap.ts` and rewrites `main.ts` to call `initFederation(...)` first, then dynamically `import('./bootstrap')`. The first argument depends on `--type`:
    - `remote` → `{ '<project>': './remoteEntry.json' }`
    - `host` → an inline remote map derived from the workspace's other projects
    - `dynamic-host` → the path to a generated `federation.manifest.json`

    On v4 the schematic emits the **orchestrator** bootstrap (`@softarc/native-federation-orchestrator`) by default — `initFederation(<arg>, { ...useShimImportMap({ shimMode: true }), logger: consoleLogger, storage: globalThisStorageEntry, hostRemoteEntry: './remoteEntry.json', logLevel: 'debug' })`. See [Runtime](runtime.md).
6. **SSR.** If the project has SSR enabled (`build.options.ssr.entry` is set), the schematic also rewrites `main.server.ts` to `bootstrap-server.ts` + a federation-aware `main.server.ts` that calls `initNodeFederation`, and adds `cors` + `@softarc/native-federation-node` to dependencies.
7. **federation.manifest.json.** For dynamic hosts, generates a manifest file. It lives in `public/federation.manifest.json` if the project has a `public/` folder, else `src/assets/federation.manifest.json`.
8. **Dependencies.** Adds `es-module-shims`, `@angular-devkit/build-angular` and `@softarc/native-federation-orchestrator` (as a devDependency). Triggers `npm install` at the end.

### What it does NOT do

- It does not add lazy routes to your shell — wire `loadRemoteModule` in your `app.routes.ts` manually (see [Getting Started → step 4](getting-started.md#4-wire-a-lazy-route-in-the-host)).
- It does not change your application code; only the bootstrap files (`main.ts`, optionally `main.server.ts`) are touched.

## appbuilder

```bash
ng g @angular-architects/native-federation-v4:appbuilder --project <name>
```

Migrates a project from the legacy `@angular-devkit/build-angular:browser-esbuild` to the modern `@angular/build:application` Application Builder. Required to use any version of the adapter from 17.1 onward.

It only touches `angular.json`:

- Switches the `esbuild` target's builder to `@angular/build:application`.
- Renames the `main` option to `browser` (the new builder's spelling).
- Rewrites the `serve-original` target's `buildTarget` values from `:build:` to `:esbuild:`, and the federation `serve` target from `:esbuild:` back to `:serve-original:`.

## update-v4

```bash
ng g @angular-architects/native-federation-v4:update-v4 [--project <name>] [--orchestrator]
```

Migrates a v3 project (CommonJS, legacy runtime) to v4 (full ESM, optional orchestrator). `--project` is optional — omit it to migrate every project in the workspace. The schematic is also wired into `ng update`'s migration collection, so `ng update` picks it up automatically when you bump to a v4 release.

It performs:

1. Renames every `@angular-architects/native-federation:build` reference in `angular.json` to `@angular-architects/native-federation-v4:build`; ensures every federation target has `entryPoints` (defaulting to `<sourceRoot>/main.ts`) and `projectName` set.
2. For every project's `federation.config.js`: rewrites from CommonJS to ESM (`require()` → `import`, `module.exports = ...` → `export default ...`), swaps `@angular-architects/native-federation` imports for `@angular-architects/native-federation-v4`, and **renames the file to `federation.config.mjs`**.
3. Updates `main.ts` imports from `@angular-architects/native-federation` to `@softarc/native-federation-runtime`.

If you pass `--orchestrator` (or accept the prompt) it additionally:

4. Adds `@softarc/native-federation-orchestrator` (`^4.0.0`) to `dependencies`.
5. Surgically rewrites `initFederation(...)` to import from the orchestrator and pass the orchestrator's options block (`useShimImportMap`, `consoleLogger`, `globalThisStorageEntry`, `hostRemoteEntry: './remoteEntry.json'`, `logLevel: 'debug'`). The existing first argument (manifest path, remote map, or `{}`) is preserved.

Not touched by this schematic: the root `package.json`'s `"type": "module"` and the v4 runtime/core packages — those are workspace-level concerns handled by `ng update` itself. See [Migration to v4](migration-v4.md) for the full walkthrough.

## update18 (auto migration)

Legacy migration that shipped on the v3 line. Triggered automatically by `ng update @angular-architects/native-federation` when crossing version 18. It:

- Removes the obsolete `postinstall` hook that earlier versions injected into `package.json`.
- Patches `node_modules/@angular/build/package.json` to expose the `private` entry point the adapter needs.

You don't run this one by hand — it's listed here for completeness.

## remove

```bash
ng g @angular-architects/native-federation-v4:remove --project <name>
```

Reverts a project back to a plain Angular setup:

- Removes `es-module-shims` from polyfills.
- Restores the original `build` from the `esbuild` target and the original `serve` from `serve-original`.
- Rewrites `buildTarget` references back from `:esbuild:` to `:build:`.
- Removes `main.ts` and renames `bootstrap.ts` back to `main.ts`.

The schematic does _not_ delete `federation.config.mjs` or `tsconfig.federation.json` — clean those up by hand.

## Nx Generator

```bash
nx g @angular-architects/native-federation-v4:native-federation --name=<name>
```

Adds a new Nx _library_ project pre-wired to the federation builder. It registers the project, scaffolds a starter `src/index.ts`, and creates a `build` target executor pointing at `@angular-architects/native-federation-v4:build`.

| Option | Description |
| --- | --- |
| `--name` | Library name. Required. |
| `--directory` | Optional sub-directory under `libs/`. |
| `--tags` | Comma-separated Nx project tags. |

For application-shaped Nx projects, prefer `ng add` / `nx g @angular-architects/native-federation-v4:init` — the library generator is for shared, federation-aware code.

## Related

- [Getting Started](getting-started.md) — the happy path that uses these schematics.
- [Builder](builder.md) — what the `angular.json` the schematic generates actually does.
- [Migration to v4](migration-v4.md) — manual migration walkthrough complementing `update-v4`.
