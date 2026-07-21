---
applies_to: [v3, v4]
---

# Migration to v4

> Migrate the Native Federation Angular adapter from v3 to v4 — ESM, builder rename, federation.config.mjs rewrite, and the optional orchestrator runtime.

v4 of the Angular adapter is a packaging and runtime upgrade — full ESM, the [orchestrator](../runtime/index.md) runtime by default, and a few `angular.json` tidy-ups. This guide targets **Angular 22**, where the adapter ships under its original name, `@angular-architects/native-federation` (22.x). If you're still on **Angular 20 or 21**, the same v4 release is published under `@angular-architects/native-federation-v4` — see [Angular 20/21 — the `-v4` package](#angular-2021--the--v4-package) at the bottom.

The `ng update` migration does the work for you, but the steps below are useful when migrating by hand or auditing the diff.

> **Note:** The fastest path is `ng update @angular-architects/native-federation` — it pulls the Angular 22 release and runs the bundled **`update22`** migration, which rewrites your project to the v22 ESM standard automatically. Coming straight from v3, you can run this in one step. See [Schematics → update22](schematics.md#update22).

## Files Touched

```
📁 /
├── 📄 package.json                     ← new v4 dependencies
├── 📄 angular.json                     ← v4 builder name, entryPoints, projectName
└── 📁 projects/<your-project>/
    ├── 📄 federation.config.mjs        ← renamed from .js, CommonJS → ESM
    └── 📁 src/
        └── 📄 main.ts                  ← orchestrator wiring is an optional manual step
```

## 0. Clear Caches

Belt-and-braces — wipe caches before migrating to avoid mismatched artifacts:

```bash
rm -rf .angular/ dist/ node_modules/.cache/
```

## 1. `package.json`

Update the packages:

```json
{
  "dependencies": {
    // your dependencies
  },
  "devDependencies": {
    "@angular-architects/native-federation": "~22.0.6",
    "@softarc/native-federation": "~4.3.2",
    "@softarc/native-federation-orchestrator": "^4.5.2"
  }
}
```

`@softarc/native-federation-runtime` is only needed if you deliberately stay on the classic runtime — v4 runs on the orchestrator by default, so for most projects you can drop it.

> **Note:** You do **not** need to add `"type": "module"` to `package.json`. The federation config is renamed to `federation.config.mjs` (step 2), which Node loads as ESM regardless of the package-wide setting. Renaming the config — which the migration does for you — is enough.

## 2. `federation.config.js` → `federation.config.mjs`

Rename the file to `federation.config.mjs`, switch from CommonJS to ESM, and update the import path. Functionally everything else stays the same. The `.mjs` extension is what makes the config ESM — Node treats it as a module regardless of your `package.json`, so there is no need to set `"type": "module"`. The builder still falls back to `federation.config.js` if no `.mjs` file is present, but the migration renames it for you.

**Before**

```js
const {
  withNativeFederation,
  shareAll,
} = require("@angular-architects/native-federation/config");

module.exports = withNativeFederation({
  name: "mfe1",
  exposes: { "./Component": "./projects/mfe1/src/bootstrap.ts" },
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: "auto",
    }),
  },
  skip: ["rxjs/ajax", "rxjs/fetch", "rxjs/testing", "rxjs/webSocket"],
});
```

**After**

```ts
import {
  withNativeFederation,
  shareAll,
} from "@angular-architects/native-federation/config";

export default withNativeFederation({
  name: "mfe1",
  exposes: { "./Component": "./projects/mfe1/src/bootstrap.ts" },
  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: "auto" },
      {
        overrides: {
          "@angular/core": {
            singleton: true,
            strictVersion: true,
            requiredVersion: "auto",
            includeSecondaries: { keepAll: true },
          },
        },
      },
    ),
  },
  skip: ["rxjs/ajax", "rxjs/fetch", "rxjs/testing", "rxjs/webSocket"],
  features: {
    // ignoreUnusedDeps is enabled by default in v4
    denseChunking: true, // opt-in: groups chunks in remoteEntry.json for smaller metadata
  },
});
```

The `shareAll` call now accepts a second argument with `overrides` — handy for keeping `@angular/core`'s secondary entry points together (see [Angular Config → keepAll](configuration.md#why-keepall-for-angularcore)).

Code-splitting (`chunks`) and dense chunking (`denseChunking`) are configured here in `federation.config.mjs`, not in the builder options anymore.

## 3. `angular.json`

Switch every `@angular-architects/native-federation:build` reference to its v22 form (the builder name is unchanged on Angular 22 — it's already `@angular-architects/native-federation:build`). The migration also seeds every federation target with `entryPoints` (defaulting to `<sourceRoot>/main.ts`) and `projectName` when they aren't already set. A typical `serve` target on v4:

```json
"serve": {
  "builder": "@angular-architects/native-federation:build",
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

The import path stays on `@angular-architects/native-federation` on Angular 22 — v3 already re-exported the runtime under this name, so if you're upgrading in place there's nothing to rewrite here:

```ts
import { initFederation } from "@angular-architects/native-federation";

initFederation()
  .catch((err) => console.error(err))
  .then((_) => import("./bootstrap"))
  .catch((err) => console.error(err));
```

That's the minimum to be on v4. The adapter's `initFederation` bridges to the orchestrator under the hood, so you already get range-based version selection, share scopes and in-browser caching without touching your call.

## 5. Optional — Switch to the Orchestrator

This is a **manual** step — the migration does not perform it. If you want to call `@softarc/native-federation-orchestrator` directly (for full control over its options and the destructured `loadRemoteModule`), keep your existing `initFederation` first argument (the manifest path, remote map, or `{ '<project>': './remoteEntry.json' }`) and append the orchestrator's options block as a second argument:

```ts
import { initFederation } from "@softarc/native-federation-orchestrator";
import {
  useShimImportMap,
  consoleLogger,
  globalThisStorageEntry,
} from "@softarc/native-federation-orchestrator/options";

initFederation("/assets/federation.manifest.json", {
  ...useShimImportMap({ shimMode: true }),
  logger: consoleLogger,
  storage: globalThisStorageEntry,
  hostRemoteEntry: "./remoteEntry.json",
  logLevel: "debug",
})
  .catch((err) => console.error(err))
  .then((_) => import("./bootstrap"))
  .catch((err) => console.error(err));
```

The biggest behavioural change is that `loadRemoteModule` is no longer a global export — it's returned from the resolved `initFederation` promise. If you rely on `loadRemoteModule` inside your Angular code (routes, components, services), thread it through Angular's DI:

```ts
import {
  initFederation,
  type NativeFederationResult,
  type LoadRemoteModule,
} from "@softarc/native-federation-orchestrator";

initFederation(manifest, orchestratorOptions)
  .then(({ loadRemoteModule }: NativeFederationResult) =>
    import("./bootstrap").then((m: any) => m.bootstrap(loadRemoteModule)),
  )
  .catch((err) => console.error(err));
```

See [Runtime → The orchestrator runtime](runtime.md#the-orchestrator-runtime) for the full DI pattern (bootstrap, app config, injection token).

## Angular 20/21 — the `-v4` package

Everything above targets **Angular 22**, where the adapter is published under its original name, `@angular-architects/native-federation`. On **Angular 20 and 21** the exact same v4 release ships under a suffixed package, `@angular-architects/native-federation-v4`, so the standalone version stays clear of the Angular version stream. The migration steps are identical apart from the package name.

Use the `-v4` package if you want v4 on Angular 20/21 without moving to Angular 22 yet. Run the dedicated schematic:

```bash
ng g @angular-architects/native-federation-v4:update-v4
```

Pass `--project <name>` to scope it to a single project, otherwise every project in the workspace is migrated. The same migration runs automatically on `ng update`. See [Schematics → update-v4](schematics.md#update-v4).

Wherever the steps above reference `@angular-architects/native-federation`, substitute the suffixed name:

| Step                           | Angular 22                                      | Angular 20/21                                      |
| ------------------------------ | ----------------------------------------------- | -------------------------------------------------- |
| `package.json`                 | `@angular-architects/native-federation` `~22.x` | `@angular-architects/native-federation-v4` `~22.x` |
| `federation.config.mjs` import | `@angular-architects/native-federation/config`  | `@angular-architects/native-federation-v4/config`  |
| `angular.json` builder         | `@angular-architects/native-federation:build`   | `@angular-architects/native-federation-v4:build`   |
| `main.ts` import               | `@angular-architects/native-federation`         | `@angular-architects/native-federation-v4`         |

For example, the `federation.config.mjs` import becomes:

```ts
import {
  withNativeFederation,
  shareAll,
} from "@angular-architects/native-federation-v4/config";
```

and `main.ts` moves to the `-v4` package — on v3 the runtime was re-exported under `@angular-architects/native-federation`, so this import path is the one required change the `update-v4` schematic rewrites:

```ts
// before
import { initFederation } from "@angular-architects/native-federation";

// after
import { initFederation } from "@angular-architects/native-federation-v4";
```

### Moving from `-v4` to Angular 22

When you're ready to move from Angular 20/21 to Angular 22, dropping the `-v4` suffix is part of the jump. You don't have to do it by hand — run the Angular CLI update:

```bash
ng update @angular-architects/native-federation
```

This pulls the Angular 22 release and runs the bundled **`update22`** migration, which swaps every `@angular-architects/native-federation-v4` import and `angular.json` builder reference back to `@angular-architects/native-federation`, and renames `federation.config.js` to `federation.config.mjs` if you're still on the old name.

If you already pulled the package with npm (e.g. `npm install @angular-architects/native-federation@22`), run the migration on its own instead:

```bash
ng update @angular-architects/native-federation --migrate-only update22
```

> **Note:** The `update22` schematic is all you need — and so is the `federation.config.js` → `.mjs` rename if you prefer to do it by hand. Either one is sufficient; you do **not** need to set `"type": "module"` in `package.json`. The `.mjs` extension already makes the config ESM.

## That's It

If anything is off — corrupted cache, missing peer deps, weird ESM resolution — re-run step 0 and try again. Open an issue on the [GitHub org](https://github.com/native-federation) if you hit something this guide misses.

## Related

- [Schematics → update22](schematics.md#update22) — the automated Angular 22 migration.
- [Schematics → update-v4](schematics.md#update-v4) — the automated migration for the Angular 20/21 `-v4` package.
- [Runtime → The orchestrator runtime](runtime.md#the-orchestrator-runtime) — full orchestrator wiring details.
- [Angular Config](configuration.md) — what changed in `federation.config.mjs` defaults.
