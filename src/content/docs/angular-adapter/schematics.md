---
applies_to: [v4]
---

# Schematics

> The Angular adapter's schematics: init/ng-add, appbuilder, update-v4, update22, update18 and remove — plus the Nx generator.

The adapter ships a small collection of schematics for the Angular CLI (and an Nx generator). They scaffold projects, migrate older setups forward, and tear federation back out cleanly when you no longer need it.

> **Note:** The commands below use the **Angular 22** package name `@angular-architects/native-federation`. On **Angular 20/21** the same schematics ship under `@angular-architects/native-federation-v4` — substitute `-v4` in the command. The exception is [`update-v4`](#update-v4), which lives in the `-v4` package because it produces a pre-22 v4 setup.

**On this page**

- [init / ng-add](#init--ng-add)
- [appbuilder](#appbuilder)
- [update-v4](#update-v4)
- [update22 (Angular 22)](#update22-angular-22)
- [update18 (auto migration)](#update18-auto-migration)
- [remove](#remove)
- [Nx generator](#nx-generator)

## init / ng-add

```bash
ng add @angular-architects/native-federation \
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
4. **angular.json.** Switches the existing build to `@angular/build:application` (if it isn't already), renames it to `esbuild`, renames the existing serve to `serve-original`, and slots the `@angular-architects/native-federation:build` builder into `build` + `serve`. See [the angular.json layout](builder.md#the-angularjson-layout).
5. **main.ts split.** Moves your existing `main.ts` to `bootstrap.ts` and rewrites `main.ts` to call `initFederation(...)` first, then dynamically `import('./bootstrap')`. The first argument depends on `--type`:
    - `remote` → `{ '<project>': './remoteEntry.json' }`
    - `host` → an inline remote map derived from the workspace's other projects
    - `dynamic-host` → the path to a generated `federation.manifest.json`

    On v4 the schematic emits the **orchestrator** bootstrap (`@softarc/native-federation-orchestrator`) by default — `initFederation(<arg>, { ...useShimImportMap({ shimMode: true }), logger: consoleLogger, storage: globalThisStorageEntry, hostRemoteEntry: './remoteEntry.json', logLevel: 'debug' })`. See [Runtime](runtime.md).
6. **SSR.** If the project has SSR enabled (`build.options.ssr.entry` is set), the schematic sets `ssr: true` on the federation `build` target, adds `app.use(cors())` to the generated `server.ts`, switches `RenderMode.Prerender` → `RenderMode.Server` in `app.routes.server.ts`, and forces `security.allowedHosts: ['localhost']` on the `esbuild` target. It does **not** split `main.server.ts`, emit an `fstart.mjs`, or add `@softarc/native-federation-node` — on v4 the server-side loader is registered at launch by the `node --import @angular-architects/native-federation/node-preload …` preload, which wires the orchestrator's [`/node` entry](../orchestrator/node.md). The orchestrator is added as a runtime (not dev) dependency for SSR projects. You still set the prod start command to use the preload yourself. See [SSR & Hydration](ssr.md).
7. **federation.manifest.json.** For dynamic hosts, generates a manifest file. It lives in `public/federation.manifest.json` if the project has a `public/` folder, else `src/assets/federation.manifest.json`.
8. **Dependencies.** Adds `es-module-shims`, `@angular-devkit/build-angular` and `@softarc/native-federation-orchestrator` — the orchestrator as a devDependency for browser-only projects, or a runtime dependency (plus `cors`) for SSR projects. Triggers `npm install` at the end.

### What it does NOT do

- It does not add lazy routes to your shell — wire `loadRemoteModule` in your `app.routes.ts` manually (see [Getting Started → step 4](getting-started.md#4-wire-a-lazy-route-in-the-host)).
- It does not change your application code; only the bootstrap files (`main.ts`) and, for SSR, the generated `server.ts` / `app.routes.server.ts` are touched.

## appbuilder

```bash
ng g @angular-architects/native-federation:appbuilder --project <name>
```

Migrates a project from the legacy `@angular-devkit/build-angular:browser-esbuild` to the modern `@angular/build:application` Application Builder. Required to use any version of the adapter from 17.1 onward.

It only touches `angular.json`:

- Switches the `esbuild` target's builder to `@angular/build:application`.
- Renames the `main` option to `browser` (the new builder's spelling).
- Rewrites the `serve-original` target's `buildTarget` values from `:build:` to `:esbuild:`, and the federation `serve` target from `:esbuild:` back to `:serve-original:`.

## update-v4

```bash
ng g @angular-architects/native-federation-v4:update-v4 [--project <name>]
```

Migrates a v3 project (CommonJS, legacy runtime) to v4 (full ESM) on the `-v4` package — the right path when you adopt v4 on **Angular 20/21**. `--project` is optional — omit it to migrate every project in the workspace. The schematic is also wired into `ng update`'s migration collection, so `ng update` picks it up automatically when you bump to a v4 release.

> **On Angular 22?** Don't run `update-v4`. The package is back to `@angular-architects/native-federation`, and the [`update22`](#update22-angular-22) migration handles the move for you — including swapping any `-v4` imports back to the base package.

It performs three changes:

1. Renames every `@angular-architects/native-federation:build` reference in `angular.json` to `@angular-architects/native-federation-v4:build`; ensures every federation target has `entryPoints` (defaulting to `<sourceRoot>/main.ts`) and `projectName` set.
2. For every project's `federation.config.js`: rewrites from CommonJS to ESM (`require()` → `import`, `module.exports = ...` → `export default ...`), swaps `@angular-architects/native-federation` imports for `@angular-architects/native-federation-v4`, and **renames the file to `federation.config.mjs`**.
3. Updates `main.ts` imports from `@angular-architects/native-federation` to `@angular-architects/native-federation-v4`. Because the v4 adapter's `initFederation` bridges to the orchestrator, your migrated project runs on the orchestrator runtime without further changes.

The schematic does **not** rewrite your bootstrap onto the orchestrator's own API or change the shape of the `initFederation` call. If you'd rather call `@softarc/native-federation-orchestrator` directly — for the destructured `loadRemoteModule` and full control over its options — do it by hand; see [Migration to v4 → Switch to the Orchestrator](migration-v4.md#5-optional--switch-to-the-orchestrator).

Not touched by this schematic: the v4 runtime/core package versions in the root `package.json` — those are workspace-level concerns handled by `ng update` itself. You do **not** need to add `"type": "module"`; the renamed `federation.config.mjs` is enough. See [Migration to v4](migration-v4.md) for the full walkthrough.

## update22 (Angular 22)

```bash
ng update @angular-architects/native-federation
```

The migration to **Angular 22**. From Angular 22 the v4 adapter is published under its original name `@angular-architects/native-federation` (22.x), so this is the schematic you run to move a v4 project (on the `-v4` package) — or a v3 project — onto the Angular 22 release. `ng update` pulls the new package and runs the bundled `update22` migration, which rewrites your setup to the v22 ESM standard automatically: it swaps `@angular-architects/native-federation-v4` imports and `angular.json` builder references back to `@angular-architects/native-federation`, and renames `federation.config.js` to `federation.config.mjs` if you haven't already.

If you already pulled the package yourself (e.g. `npm install @angular-architects/native-federation@22`), run the migration on its own in **migrate-only** mode:

```bash
ng update @angular-architects/native-federation --migrate-only update22
```

The schematic is enough on its own — you do **not** need to set `"type": "module"` in `package.json`. The ESM config lives in `federation.config.mjs`, which Node treats as ESM regardless of the package-wide setting. See [Migration to v4 → Updating to Angular 22](migration-v4.md#updating-to-angular-22) for the full walkthrough.

## update18 (auto migration)

Legacy migration that shipped on the v3 line. Triggered automatically by `ng update @angular-architects/native-federation` when crossing version 18. It:

- Removes the obsolete `postinstall` hook that earlier versions injected into `package.json`.
- Patches `node_modules/@angular/build/package.json` to expose the `private` entry point the adapter needs.

You don't run this one by hand — it's listed here for completeness.

## remove

```bash
ng g @angular-architects/native-federation:remove --project <name>
```

Reverts a project back to a plain Angular setup:

- Removes `es-module-shims` from polyfills.
- Restores the original `build` from the `esbuild` target and the original `serve` from `serve-original`.
- Rewrites `buildTarget` references back from `:esbuild:` to `:build:`.
- Removes `main.ts` and renames `bootstrap.ts` back to `main.ts`.

The schematic does _not_ delete `federation.config.mjs` or `tsconfig.federation.json` — clean those up by hand.

## Nx Generator

```bash
nx g @angular-architects/native-federation:native-federation --name=<name>
```

Adds a new Nx _library_ project pre-wired to the federation builder. It registers the project, scaffolds a starter `src/index.ts`, and creates a `build` target executor pointing at `@angular-architects/native-federation:build`.

| Option | Description |
| --- | --- |
| `--name` | Library name. Required. |
| `--directory` | Optional sub-directory under `libs/`. |
| `--tags` | Comma-separated Nx project tags. |

For application-shaped Nx projects, prefer `ng add` / `nx g @angular-architects/native-federation:init` — the library generator is for shared, federation-aware code.

## Related

- [Getting Started](getting-started.md) — the happy path that uses these schematics.
- [Builder](builder.md) — what the `angular.json` the schematic generates actually does.
- [Migration to v4](migration-v4.md) — manual migration walkthrough complementing `update-v4`.
