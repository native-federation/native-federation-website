---
applies_to: [v3, v4]
---

# v3 vs v4

> A clear overview of what changed between Native Federation v3 and v4 — packages, ESM, the Orchestrator runtime, Angular compatibility, and repository locations.

Native Federation v4 is a significant upgrade — new packages, full ESM, a new recommended runtime, and a new GitHub home. This page summarises every breaking change and new capability in one place so you know exactly what to expect before diving into a section of the docs.

## Repositories

v4 moves to a new GitHub organisation. The v3 source stays in the original Angular Architects monorepo.

### V3 monorepo

| Package | Repository |
| --- | --- |
| Monorepo: core, runtime and adapters (Angular and esbuild) | [github.com/angular-architects/module-federation-plugin](https://github.com/angular-architects/module-federation-plugin/) |

### V4 repositories

| Package | Repository |
| --- | --- |
| Core | [github.com/native-federation/native-federation-core](https://github.com/native-federation/native-federation-core) |
| Orchestrator | [github.com/native-federation/orchestrator](https://github.com/native-federation/orchestrator) |
| Angular adapter | [github.com/native-federation/angular-adapter](https://github.com/native-federation/angular-adapter) |
| Esbuild adapter | [github.com/native-federation/esbuild-adapter](https://github.com/native-federation/esbuild-adapter) |

## At a Glance

| Topic | v3 | v4 |
| --- | --- | --- |
| Angular adapter package | `@angular-architects/native-federation` | `@angular-architects/native-federation-v4` (beta -> stable with NG22) |
| Core package | `@softarc/native-federation` (v3.x) | `@softarc/native-federation` (v4.x) |
| Runtime package | `@softarc/native-federation-runtime` | `@softarc/native-federation-runtime` (still supported) or `@softarc/native-federation-orchestrator` (recommended) |
| Module format | CommonJS (`require`) | ESM (`import` / `export default`) |
| Angular version | Angular 14-21 | Angular 20+ (one backwards-compatible major) |
| Default browser runtime | Classic Runtime | Orchestrator (Classic Runtime still supported) |
| Builder name (Angular) | `@angular-architects/native-federation:build` | `@angular-architects/native-federation-v4:build` |

## Package Names

The core packages keep the same name but bump their major version. The Angular adapter is temporarily published under a new name while it stabilises:

| Package | v3 | v4 |
| --- | --- | --- |
| Core builder | `@softarc/native-federation@3.x` | `@softarc/native-federation@4.x` |
| Classic Runtime | `@softarc/native-federation-runtime@3.x` | `@softarc/native-federation-runtime@4.x` |
| Orchestrator | — | `@softarc/native-federation-orchestrator@4.x` |
| Angular adapter | `@angular-architects/native-federation` | `@angular-architects/native-federation-v4` (beta); will become `@angular-architects/native-federation` once stable |

## Angular Version

The v4 Angular adapter targets **Angular 20 and above**, with one backwards-compatible major. If you are on Angular 14-19 and cannot upgrade Angular yet, stay on v3.

The v4 adapter is currently in beta. It will be released as stable alongside Angular 22 (expected May 2025). The beta is published under `@angular-architects/native-federation-v4` to let you adopt it early without overwriting your existing v3 install.

## Full ESM

v4 drops CommonJS in every package. Two files in your project need to change:

1. **`package.json`** — (optionally) add `"type": "module"` to mark the workspace as ESM.
2. **`federation.config.(m)js`** — switch from `require()` / `module.exports` to `import` / `export default`, and update the import path to the v4 adapter package.

> **Note:** The easiest change is to rename the `federation.config.js` to `federation.config.mjs`. — Node will treat that extension as ESM regardless of the package-wide setting.

The [Migration to v4](migration.md) guide walks through these two changes step by step. The Angular-specific parts are in [Angular Adapter -> Migration to v4](angular-adapter/migration-v4.md).

## Runtime: Orchestrator vs Classic

v3 shipped one browser runtime: the **Classic Runtime** (`@softarc/native-federation-runtime`). It resolves shared dependencies at startup, wires a single import map, and loads remotes on demand. Simple and battle-tested.

v4 introduces the **Orchestrator** (`@softarc/native-federation-orchestrator`) as the recommended replacement. It keeps the same `remoteEntry.json` contract but adds:

- **Semver-range resolution** — remotes that declare different version ranges of the same package are reconciled automatically, rather than requiring byte-identical version strings.
- **Persistent caching** — `remoteEntry.json` files are cached in `localStorage` or `sessionStorage`, so the manifest fetch is skipped on repeat visits.
- **Share scopes** — fine-grained sharing boundaries for complex multi-team setups.

The Classic Runtime is still fully supported in v4 and remains the right choice when you need SSR on the host or want the simplest possible setup. It is *not* deprecated — but new v4 projects should prefer the Orchestrator.

> **Note:** The Orchestrator is **client-side only**. If your host renders on the server, keep the Classic Runtime for the SSR path and optionally use the Orchestrator on the browser path.

## Migrating

- [Migration to v4](migration.md) — the framework-agnostic steps (ESM, `package.json`, `federation.config.js`).
- [Angular Adapter -> Migration to v4](angular-adapter/migration-v4.md) — Angular-specific steps (builder rename, `angular.json`, `main.ts`). Includes the `update-v4` schematic that automates most of the work.
