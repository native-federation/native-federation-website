---
applies_to: [v3, v4]
---

# v3 vs v4

> A clear overview of what changed between Native Federation v3 and v4 — packages, ESM, the Orchestrator runtime, Angular compatibility, and repository locations.

Native Federation v4 is a significant upgrade — new packages, full ESM, a new recommended runtime, and a new GitHub home. This page summarises every breaking change and new capability in one place so you know exactly what to expect before diving into a section of the docs.

## Repositories

v4 moves to a new GitHub organisation. The v3 source stays in the original Angular Architects monorepo.

### V3 monorepo

| Package                                                    | Repository                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Monorepo: core, runtime and adapters (Angular and esbuild) | [github.com/angular-architects/module-federation-plugin](https://github.com/angular-architects/module-federation-plugin/) |

### V4 repositories

| Package         | Repository                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Core            | [github.com/native-federation/native-federation-core](https://github.com/native-federation/native-federation-core) |
| Orchestrator    | [github.com/native-federation/orchestrator](https://github.com/native-federation/orchestrator)                     |
| Angular adapter | [github.com/native-federation/angular-adapter](https://github.com/native-federation/angular-adapter)               |
| Esbuild adapter | [github.com/native-federation/esbuild-adapter](https://github.com/native-federation/esbuild-adapter)               |

## At a Glance

| Topic                   | v3                                            | v4                                                                                                                             |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Angular adapter package | `@angular-architects/native-federation`       | `@angular-architects/native-federation` on Angular 22+, `@angular-architects/native-federation-v4` on Angular 20/21            |
| Core package            | `@softarc/native-federation` (v3.x)           | `@softarc/native-federation` (v4.x)                                                                                            |
| Runtime package         | `@softarc/native-federation-runtime`          | `@softarc/native-federation-runtime` (still supported) or `@softarc/native-federation-orchestrator` (recommended)              |
| Module format           | CommonJS (`require`)                          | ESM (`import` / `export default`)                                                                                              |
| Angular version         | Angular 14-21                                 | Angular 20+ (one backwards-compatible major)                                                                                   |
| Default browser runtime | Classic Runtime                               | Orchestrator (Classic Runtime still supported)                                                                                 |
| Builder name (Angular)  | `@angular-architects/native-federation:build` | `@angular-architects/native-federation:build` (Angular 22+) / `@angular-architects/native-federation-v4:build` (Angular 20/21) |

## Package Names

The core packages keep the same name but bump their major version. The Angular adapter's package name depends on your Angular version — it was published under a `-v4` name during the Angular 20/21 cycle and reverts to its original name on Angular 22:

| Package         | v3                                       | v4                                                                                                                       |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Core builder    | `@softarc/native-federation@3.x`         | `@softarc/native-federation@4.x`                                                                                         |
| Classic Runtime | `@softarc/native-federation-runtime@3.x` | `@softarc/native-federation-runtime@4.x`                                                                                 |
| Orchestrator    | —                                        | `@softarc/native-federation-orchestrator@4.x`                                                                            |
| Angular adapter | `@angular-architects/native-federation`  | `@angular-architects/native-federation@22.x` on Angular 22+; `@angular-architects/native-federation-v4` on Angular 20/21 |

## Angular Version

The v4 Angular adapter targets **Angular 20 and above**, with one backwards-compatible major. If you are on Angular 14-19 and cannot upgrade Angular yet, stay on v3.

v4 is stable. On **Angular 22** it ships as the base package `@angular-architects/native-federation` (22.x). On **Angular 20 and 21** the same adapter is published under `@angular-architects/native-federation-v4`, so you can adopt v4 early without overwriting an existing v3 install. Moving from `-v4` (or straight from v3) to Angular 22 is a single `ng update @angular-architects/native-federation` — see [Angular Adapter → Updating to Angular 22](angular-adapter/migration-v4.md#updating-to-angular-22).

## Full ESM

v4 drops CommonJS in every package. The change you need is in one file:

1. **`federation.config.(m)js`** — rename it to `federation.config.mjs` and switch from `require()` / `module.exports` to `import` / `export default`, updating the import path to the v4 adapter package.
2. **`package.json`** — bump the dependencies to their v4 majors. Adding `"type": "module"` is optional and only matters if you want the whole workspace to default to ESM.

> **Note:** The easiest change is to rename the `federation.config.js` to `federation.config.mjs`. — Node will treat that extension as ESM regardless of the package-wide setting.

The [Migration to v4](migration.md) guide walks through these two changes step by step. The Angular-specific parts are in [Angular Adapter -> Migration to v4](angular-adapter/migration-v4.md).

## Runtime: Orchestrator vs Classic

v3 shipped one browser runtime: the **Classic Runtime** (`@softarc/native-federation-runtime`). It resolves shared dependencies at startup, wires a single import map, and loads remotes on demand. Simple and battle-tested.

v4 introduces the **Orchestrator** (`@softarc/native-federation-orchestrator`) as the recommended replacement. It keeps the same `remoteEntry.json` contract but adds:

- **Semver-range resolution** — remotes that declare different version ranges of the same package are reconciled automatically, rather than requiring byte-identical version strings.
- **Persistent caching** — `remoteEntry.json` files are cached in `localStorage` or `sessionStorage`, so the manifest fetch is skipped on repeat visits.
- **Share scopes** — fine-grained sharing boundaries for complex multi-team setups.

The Classic Runtime is still fully supported in v4 and remains the right choice when you need SSR on the host or want the simplest possible setup. It is _not_ deprecated — but new v4 projects should prefer the Orchestrator.

> **Note:** The Orchestrator is **client-side only**. If your host renders on the server, keep the Classic Runtime for the SSR path and optionally use the Orchestrator on the browser path.

## Migrating

- [Migration to v4](migration.md) — the framework-agnostic steps (ESM, `package.json`, `federation.config.js`).
- [Angular Adapter -> Migration to v4](angular-adapter/migration-v4.md) — Angular-specific steps (builder rename, `angular.json`, `main.ts`). Includes the `update-v4` schematic that automates most of the work.
