---
applies_to: [v3, v4]
---

# Migration to v4

> Migrate the Native Federation Angular adapter from v3 to v4 — ESM, builder rename, federation.config.mjs rewrite, and the optional orchestrator runtime.

v4 of the Angular adapter is a packaging and runtime upgrade — full ESM, the [orchestrator](../runtime/index.md) runtime by default, and a few `angular.json` tidy-ups. The `update-v4` schematic does the work for you, but the steps below are useful when migrating by hand or auditing the diff.

> **Note:** The fastest path is `ng g @angular-architects/native-federation-v4:update-v4` — see [Schematics → update-v4](schematics.md#update-v4). Pass `--project <name>` to scope it to a single project, otherwise every project in the workspace is migrated. The same migration runs automatically on `ng update`.

## Files Touched

```
📁 /
├── 📄 package.json                     ← new v4 dependencies
├── 📄 angular.json                     ← v4 builder name, entryPoints, projectName
└── 📁 projects/<your-project>/
    ├── 📄 federation.config.mjs        ← renamed from .js, CommonJS → ESM, package rename
    └── 📁 src/
        └── 📄 main.ts                  ← import moved to the -v4 package (orchestrator wiring is an optional manual step)
```

## 0. Clear Caches

Belt-and-braces — wipe caches before migrating to avoid mismatched artifacts:

```bash
rm -rf .angular/ dist/ node_modules/.cache/
```

## 1. `package.json`

Switch to the v4 packages:

```json
{
  "dependencies": {
    "@softarc/native-federation-runtime": "~4.0.0"
  },
  "devDependencies": {
    "@angular-architects/native-federation-v4": "~21.2.1",
    "@softarc/native-federation": "~4.0.0",
    "@softarc/native-federation-orchestrator": "^4.0.0"
  }
}
```

`@softarc/native-federation-runtime` is only needed if you deliberately stay on the classic runtime — v4 runs on the orchestrator by default, so for most projects you can drop it.

> **Note:** You do **not** need to add `"type": "module"` to `package.json`. The federation config is renamed to `federation.config.mjs` (step 2), which Node loads as ESM regardless of the package-wide setting. Renaming the config — which the `update-v4` schematic does for you — is enough.

`@angular-architects/native-federation-v4` is the package name v4 ships under on **Angular 20/21**. On **Angular 22** the adapter reverts to its original name, `@angular-architects/native-federation` — see [Updating to Angular 22](#updating-to-angular-22) for the one-command move once you're ready to take that step.

## 2. `federation.config.js` → `federation.config.mjs`

Rename the file to `federation.config.mjs`, switch from CommonJS to ESM, and update the import path. Functionally everything else stays the same. The `.mjs` extension is what makes the config ESM — Node treats it as a module regardless of your `package.json`, so there is no need to set `"type": "module"`. The builder still falls back to `federation.config.js` if no `.mjs` file is present, but the `update-v4` schematic renames it for you.

**Before**

```js
const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  name: 'mfe1',
  exposes: { './Component': './projects/mfe1/src/bootstrap.ts' },
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },
  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],
});
```

**After**

```ts
import { withNativeFederation, shareAll } from '@angular-architects/native-federation-v4/config';

export default withNativeFederation({
  name: 'mfe1',
  exposes: { './Component': './projects/mfe1/src/bootstrap.ts' },
  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto' },
      {
        overrides: {
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: { keepAll: true },
          },
        },
      },
    ),
  },
  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],
  features: {
    // ignoreUnusedDeps is enabled by default in v4
    denseChunking: true, // opt-in: groups chunks in remoteEntry.json for smaller metadata
  },
});
```

The `shareAll` call now accepts a second argument with `overrides` — handy for keeping `@angular/core`'s secondary entry points together (see [Angular Config → keepAll](configuration.md#why-keepall-for-angularcore)).

Code-splitting (`chunks`) and dense chunking (`denseChunking`) are configured here in `federation.config.mjs`, not in the builder options anymore.

## 3. `angular.json`

Switch every `@angular-architects/native-federation:build` reference to `@angular-architects/native-federation-v4:build`. The `update-v4` schematic also seeds every federation target with `entryPoints` (defaulting to `<sourceRoot>/main.ts`) and `projectName` when they aren't already set. A typical `serve` target on v4:

```json
"serve": {
  "builder": "@angular-architects/native-federation-v4:build",
  "options": {
    "projectName": "mfe1",
    "tsConfig": "projects/mfe1/tsconfig.federation.json",
    "entryPoints": ["projects/mfe1/src/main.ts"],
    "target": "mfe1:serve-original:development",
    "cacheExternalArtifacts": true,
    "rebuildDelay": 500,
    "dev": true,
    "port": 0
  }
}
```

## 4. `main.ts` — Required Change

Update the import path. v3 re-exported the runtime under `@angular-architects/native-federation`; on v4 the import simply moves to the `-v4` package — this is exactly what the `update-v4` schematic rewrites:

```ts
// before
import { initFederation } from '@angular-architects/native-federation';

// after
import { initFederation } from '@angular-architects/native-federation-v4';

initFederation()
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

That's the minimum to be on v4. The adapter's `initFederation` bridges to the orchestrator under the hood, so you already get range-based version selection, share scopes and in-browser caching without touching your call.

## 5. Optional — Switch to the Orchestrator

This is a **manual** step — `update-v4` does not perform it. If you want to call `@softarc/native-federation-orchestrator` directly (for full control over its options and the destructured `loadRemoteModule`), keep your existing `initFederation` first argument (the manifest path, remote map, or `{ '<project>': './remoteEntry.json' }`) and append the orchestrator's options block as a second argument:

```ts
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
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

The biggest behavioural change is that `loadRemoteModule` is no longer a global export — it's returned from the resolved `initFederation` promise. If you rely on `loadRemoteModule` inside your Angular code (routes, components, services), thread it through Angular's DI:

```ts
import { initFederation, type NativeFederationResult, type LoadRemoteModule } from '@softarc/native-federation-orchestrator';

initFederation(manifest, orchestratorOptions)
  .then(({ loadRemoteModule }: NativeFederationResult) =>
    import('./bootstrap').then((m: any) => m.bootstrap(loadRemoteModule)))
  .catch(err => console.error(err));
```

See [Runtime → The orchestrator runtime](runtime.md#the-orchestrator-runtime) for the full DI pattern (bootstrap, app config, injection token).

## Updating to Angular 22

Everything above lands you on v4 under the `@angular-architects/native-federation-v4` package — the name v4 ships under on **Angular 20 and 21**. From **Angular 22** the adapter is published under its original name again, `@angular-architects/native-federation` (22.x), so the move to Angular 22 also means dropping the `-v4` suffix.

You don't have to do that by hand. Run the Angular CLI update:

```bash
ng update @angular-architects/native-federation
```

This pulls the Angular 22 release and runs the bundled **`update22`** migration, which rewrites your project to the v22 ESM standard automatically — it swaps every `@angular-architects/native-federation-v4` import and `angular.json` builder reference back to `@angular-architects/native-federation`, and renames `federation.config.js` to `federation.config.mjs` if you're still on the old name.

If you already pulled the package with npm (e.g. `npm install @angular-architects/native-federation@22`), run the migration on its own instead:

```bash
ng update @angular-architects/native-federation --migrate-only update22
```

> **Note:** The `update22` schematic is all you need — and so is the `federation.config.js` → `.mjs` rename if you prefer to do it by hand. Either one is sufficient; you do **not** need to set `"type": "module"` in `package.json`. The `.mjs` extension already makes the config ESM.

Coming straight from v3 on Angular 22? You can run `ng update @angular-architects/native-federation` directly — the migration takes you to the v22 ESM setup in one step, so you can skip the intermediate `-v4` package entirely.

## That's It

If anything is off — corrupted cache, missing peer deps, weird ESM resolution — re-run step 0 and try again. Open an issue on the [GitHub org](https://github.com/native-federation) if you hit something this guide misses.

## Related

- [Schematics → update-v4](schematics.md#update-v4) — the automated equivalent of this page.
- [Runtime → The orchestrator runtime](runtime.md#the-orchestrator-runtime) — full orchestrator wiring details.
- [Angular Config](configuration.md) — what changed in `federation.config.mjs` defaults.
