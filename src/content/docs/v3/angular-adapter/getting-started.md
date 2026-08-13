# Getting Started

> Install the v3 Angular adapter and scaffold your first host and remote with ng add.

Install the adapter, run its `init` schematic on every project that should participate in the federation, and you have a working host + remote pair within minutes.

## 1. Install

```bash
npm i @angular-architects/native-federation -D
```

Pin the adapter to the same major as your Angular CLI — the `21.x` line targets Angular 21, `20.x` targets Angular 20, and so on. The package brings `@softarc/native-federation` and `@softarc/native-federation-runtime` (both `~3.5`) with it. The `init` step below adds `es-module-shims`, `@angular/animations`, `@angular-devkit/build-angular` and `@softarc/native-federation-node` to your `package.json` and runs an install.

## 2. Scaffold a Remote (Micro Frontend)

```bash
ng g @angular-architects/native-federation:init --project mfe1 --port 4201 --type remote
```

`ng add @angular-architects/native-federation` runs the same schematic. See [Schematics → init](schematics.md#init--ng-add) for the full list of changes; in summary it:

- Adds `es-module-shims` to the project's polyfills.
- Generates `projects/mfe1/federation.config.js` with one entry exposed (`./Component` → the project's `app.component.ts` or `app.ts`).
- Renames the existing `build` / `serve` targets in `angular.json` to `esbuild` / `serve-original` and points `build` and `serve` at `@angular-architects/native-federation:build`.
- Splits `main.ts` in two: a federation bootstrap calling `initFederation`, and the original Angular bootstrap moved to `bootstrap.ts`.

## 3. Scaffold a Host (Shell)

```bash
ng g @angular-architects/native-federation:init --project shell --port 4200 --type dynamic-host
```

The same schematic runs in `dynamic-host` mode for the shell. In addition to the changes above, it creates a `federation.manifest.json` in the project's `public/` folder (or `src/assets/` when the project has no `public/`) listing the other applications in the workspace:

```json
{
  "mfe1": "http://localhost:4201/remoteEntry.json"
}
```

The map is derived from the workspace: every other project with both a `build` and a `serve` target becomes an entry, keyed by its camelized name and pointing at the port configured for its serve target. If the workspace has no other application, the schematic writes a single placeholder entry, `mfe1` on port 3000, for you to edit.

Pick the type that fits the role of the project:

| `--type` | What you get | When to use it |
| --- | --- | --- |
| `remote` | `main.ts` calls `initFederation()` with no arguments — it registers only its own shared dependencies. | Every Micro Frontend. |
| `host` | The remote map is inlined in `main.ts`. | Single-environment shells where remote URLs never change. |
| `dynamic-host` | `main.ts` reads `federation.manifest.json` at runtime. | The default for shells — swap the manifest per environment without rebuilding. |

## 4. Wire a Lazy Route in the Host

The generated `main.ts` initializes federation, then dynamically imports your Angular bootstrap:

```ts
// projects/shell/src/main.ts (generated)
import { initFederation } from '@angular-architects/native-federation';

initFederation('federation.manifest.json')
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

The dynamic `import('./bootstrap')` is what keeps the ordering correct: the import map must be in the DOM before any module that resolves a shared dependency is evaluated. See [Runtime → Getting Started](../runtime/getting-started.md) for why the split is required.

Loading a remote module is then plain Angular lazy-loading with `loadRemoteModule` in place of a dynamic `import()`:

```ts
// projects/shell/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';

export const routes: Routes = [
  {
    path: 'flights',
    loadComponent: () =>
      loadRemoteModule('mfe1', './Component').then(m => m.AppComponent),
  },
];
```

Both `initFederation` and `loadRemoteModule` come straight from `@softarc/native-federation-runtime` — the adapter re-exports it unchanged. See [Runtime](runtime.md) for the full surface.

## 5. Run It

```bash
ng serve mfe1 -o   # in one terminal
ng serve shell -o  # in another
```

The Angular adapter's dev server serves the federation artifacts — shared bundles and exposed modules — directly out of the project's output folder with permissive CORS headers, so no separate static server is needed. The shell fetches `http://localhost:4201/remoteEntry.json` at startup and lazy-loads the remote when the route is hit.

## What Got Generated

After running the schematic against a project, expect the following layout:

```
projects/mfe1/
├── federation.config.js          ← shared/exposes config (see Angular Config)
└── src/
    ├── main.ts                   ← initFederation(...) bootstrap
    └── bootstrap.ts              ← the *original* Angular bootstrap (bootstrapApplication etc.)
```

And in the workspace root:

```
angular.json    ← build → @angular-architects/native-federation:build
                ← serve → @angular-architects/native-federation:build
                ← esbuild → @angular/build:application (the original build)
                ← serve-original → the original serve target
package.json    ← + es-module-shims, + @angular/animations,
                  + @angular-devkit/build-angular, + @softarc/native-federation-node
```

## Production Builds

```bash
ng build mfe1
ng build shell --configuration production
```

Each project's output (`dist/<project>/browser/`) contains a `remoteEntry.json` alongside the Angular bundle. Deploy the whole folder as a static site; the host's manifest only needs to point at the matching `remoteEntry.json` URL.

> **Note:** The shape of `remoteEntry.json` and the import map is produced by the core. See [Build Artifacts](../core/artifacts.md) for the full layout.

## Next Steps

- [Builder](builder.md) — every option in the `angular.json` targets the schematic created.
- [Angular Config](configuration.md) — what `withNativeFederation` changes for Angular projects.
- [Runtime](runtime.md) — `initFederation`, `loadRemoteModule` and lazy remote registration.
