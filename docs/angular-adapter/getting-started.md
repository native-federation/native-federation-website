---
applies_to: [v4]
---

# Getting Started

> Install the Angular adapter and scaffold your first host and remote with ng add.

Install the adapter, run `ng add` on every project that should participate in the federation, and you have a working host + remote pair within minutes.

## 1. Install

```bash
npm i @angular-architects/native-federation-v4 -D
```

The package brings `@softarc/native-federation` (`~4.0.0`) and `@softarc/native-federation-runtime` (`~4.0.0`) as transitive dependencies. The `ng add` step below adds `es-module-shims`, `@angular-devkit/build-angular` and `@softarc/native-federation-orchestrator` on top — nothing else to install up front.

## 2. Scaffold a Remote (Micro Frontend)

```bash
ng g @angular-architects/native-federation-v4:init --project mfe1 --port 4201 --type remote
```

This runs the `init` schematic against `mfe1`. See [Schematics → init](schematics.md#init) for the full list of changes; in summary it:

- Adds `es-module-shims` to the polyfills.
- Generates `projects/mfe1/federation.config.mjs` with one entry exposed (`./Component` → the project's `app.component.ts`).
- Generates `projects/mfe1/tsconfig.federation.json`.
- Renames the existing `build`/`serve` targets in `angular.json` to `esbuild` / `serve-original` and points `build`/`serve` at `@angular-architects/native-federation-v4:build`.
- Splits `main.ts` in two: an orchestrator-based federation bootstrap, and the original Angular bootstrap moved to `bootstrap.ts`.

## 3. Scaffold a Host (Shell)

```bash
ng g @angular-architects/native-federation-v4:init --project shell --port 4200 --type dynamic-host
```

The same schematic runs in `dynamic-host` mode for the shell. In addition to the changes above, it creates a `federation.manifest.json` in the project's `public/` (or `src/assets/`) folder listing the remotes it knows about:

```json
{
  "mfe1": "http://localhost:4201/remoteEntry.json"
}
```

Pick the type that fits the role of the project:

| `--type` | What you get | When to use it |
| --- | --- | --- |
| `remote` | `main.ts` calls `initFederation({ '<name>': './remoteEntry.json' })` — exposes its own `remoteEntry.json`. | Every Micro Frontend. |
| `host` | Remote map is inlined in `main.ts`. | Single-environment shells where remote URLs never change. |
| `dynamic-host` | `main.ts` reads from `federation.manifest.json`. | The default for shells — swap the manifest per environment without rebuilding. |

## 4. Wire a Lazy Route in the Host

Loading a remote module is plain Angular lazy-loading with `loadRemoteModule` in place of a dynamic `import()`. On v4 the schematic wires the orchestrator by default, which returns `loadRemoteModule` from `initFederation` — pass it through Angular's DI so routes can use it:

```ts
// projects/shell/src/main.ts (generated)
import { initFederation } from '@softarc/native-federation-orchestrator';
import {
  useShimImportMap,
  consoleLogger,
  globalThisStorageEntry,
} from '@softarc/native-federation-orchestrator/options';

initFederation('/assets/federation.manifest.json', {
  ...useShimImportMap({ shimMode: true }),
  logger: consoleLogger,
  storage: globalThisStorageEntry,
  hostRemoteEntry: './remoteEntry.json',
  logLevel: 'debug',
})
  .then(({ loadRemoteModule }) =>
    import('./bootstrap').then(m => m.bootstrap(loadRemoteModule)))
  .catch(err => console.error(err));
```

```ts
// projects/shell/src/app/app.routes.ts
import { Routes } from '@angular/router';
import type { LoadRemoteModule } from '@softarc/native-federation-orchestrator';

export const routes = (loadRemoteModule: LoadRemoteModule): Routes => [
  {
    path: 'flights',
    loadComponent: () =>
      loadRemoteModule('mfe1', './Component').then(m => m.AppComponent),
  },
];
```

See [Runtime](runtime.md) for the full `loadRemoteModule` reference, the bootstrap/app-config wiring, and how to stay on the classic runtime (`@softarc/native-federation-runtime`) if you prefer a global `loadRemoteModule` import.

## 5. Run It

```bash
ng serve mfe1 -o   # in one terminal
ng serve shell -o  # in another
```

The shell's dev server proxies `http://localhost:4201/remoteEntry.json` at request time and lazy-loads the remote when the route is hit. The Angular adapter's dev server also serves the federation artifacts (shared bundles, exposed modules) directly from `dist/<project>/browser`, so you don't need a separate static server.

## What Got Generated

After running `ng add` against a project, expect the following layout:

```
projects/mfe1/
├── federation.config.mjs         ← shared/exposes config (see Angular Config)
├── tsconfig.federation.json      ← extends tsconfig.json, used only by the federation builder
└── src/
    ├── main.ts                   ← initFederation(...) bootstrap (orchestrator by default)
    └── bootstrap.ts              ← the *original* Angular bootstrap (bootstrapApplication etc.)
```

And in the workspace root:

```
angular.json    ← build → @angular-architects/native-federation-v4:build
                ← serve → @angular-architects/native-federation-v4:build
                ← esbuild → @angular/build:application (the original build)
                ← serve-original → @angular/build:dev-server (the original serve)
package.json    ← + es-module-shims, + @softarc/native-federation-orchestrator (devDep)
```

## Production Builds

```bash
ng build mfe1
ng build shell --configuration production
```

Each project's output (`dist/<project>/browser/`) contains a `remoteEntry.json` alongside the Angular bundle. Deploy the whole folder as a static site; the host's manifest only needs to point at the matching `remoteEntry.json` URL.

> **Note:** The shape of `remoteEntry.json`, the import map and the artifact cache are all produced by the core. See [Build Artifacts](../core/artifacts.md) for the full layout.

## Next Steps

- [Builder](builder.md) — every option in the `angular.json` targets the schematic created.
- [Angular Config](configuration.md) — what `withNativeFederation` changes for Angular projects.
- [Runtime](runtime.md) — `initFederation`, `loadRemoteModule` and the orchestrator.
