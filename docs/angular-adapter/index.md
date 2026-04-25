---
applies_to: [v4]
---

# Angular Adapter

> The Angular adapter for Native Federation — a builder, schematics and runtime helpers that integrate Angular's esbuild-based ApplicationBuilder with the Native Federation core.

The Angular adapter — published as `@angular-architects/native-federation-v4` during the v4 beta (it will revert to `@angular-architects/native-federation` once stable) — is the first-class integration between Angular's esbuild-based `@angular/build:application` and the [Native Federation core](../core/index.md). It ships a builder that wraps the Angular CLI, schematics that scaffold hosts and remotes, an Nx generator, and a small set of Angular-aware config and runtime helpers.

> **Note:** This section covers the v4 Angular adapter (Angular 20+, currently in beta as `@angular-architects/native-federation-v4`). For a full overview of what changed since v3 — packages, ESM, Angular version support — see [v3 vs v4](../v3-vs-v4.md).

> **Try the Angular playground** — runnable hosts, remotes and SSR examples on GitHub: [native-federation/angular-examples](https://github.com/native-federation/angular-examples).

## What's in the Box

| Piece | Entry point | Purpose |
| --- | --- | --- |
| **Builder** | `@angular-architects/native-federation-v4:build` | Replaces the default Angular build/serve target. Wraps `@angular/build:application`, runs the federation build, and proxies federation artifacts through the dev-server. |
| **Schematics** | `ng add @angular-architects/native-federation-v4` | Initializes a project as a host, dynamic-host or remote — patches `angular.json`, polyfills, `main.ts` and creates `federation.config.mjs`. Also ships `update-v4`, `appbuilder` and `remove`. |
| **Config helpers** | `@angular-architects/native-federation-v4/config` | `withNativeFederation`, `share`, `shareAll`, `shareAngularLocales`, `NG_SKIP_LIST` — Angular-aware wrappers around the core config helpers. |
| **Runtime re-exports** | `@angular-architects/native-federation-v4` | Re-exports `initFederation`, `loadRemoteModule` (and related types) from `@softarc/native-federation-runtime` for ergonomic import when using the classic runtime. The generated `main.ts` wires the orchestrator by default — see [Runtime](runtime.md). |
| **Nx generator** | `@angular-architects/native-federation-v4:native-federation` | Adds a Nx library project pre-wired to the federation builder. |
| **Internal API** | `@angular-architects/native-federation-v4/internal` | Exposes `runBuilder` for users who need to inject custom esbuild plugins. See [Custom Builder](custom-builder.md). |

## Why an Adapter?

The [core builder](../core/index.md) is intentionally framework- and bundler-agnostic. The Angular adapter adds the glue that an Angular project needs:

- **Delegates to the Application Builder** — Angular's `@angular/build:application` does the actual app compile, so every CLI optimisation (esbuild, Vite dev server, Incremental Hydration, prerender, …) is preserved.
- **Drives the dev server** — patches `serveWithVite` with federation middleware so `ng serve` serves the federated artifacts alongside the Angular bundle, with hot-reload via Server-Sent Events.
- **Sane Angular defaults** — ships an Angular-aware `NG_SKIP_LIST`, infers the `browser`/`node` platform from your dependencies, and special-cases `@angular/common/locales` so locale data stays correct under `ignoreUnusedDeps`.
- **Angular I18N** — runs `localize-translate` over the federation artifacts so a single build produces one bundle per locale.
- **SSR + Hydration** — handles the Angular SSR entry point (`main.server.ts`) and writes a tiny `fstart.mjs` bootstrap so `@softarc/native-federation-node` can take over on the server.

## In this Section

- [Getting Started](getting-started.md) — install the package and scaffold your first host and remote with `ng add`.
- [Builder](builder.md) — the `@angular-architects/native-federation-v4:build` target, what it puts in your `angular.json`, and every option it accepts.
- [Schematics](schematics.md) — `init`, `appbuilder`, `update-v4`, `remove`, plus the Nx generator.
- [Angular Config](configuration.md) — what `withNativeFederation` changes for Angular projects (skip list, platform inference, locale handling). Refer back to [core configuration](../core/configuration.md) for the full schema.
- [Runtime](runtime.md) — `initFederation`, `loadRemoteModule` and the optional orchestrator runtime.
- [SSR & Hydration](ssr.md) — Angular SSR, Incremental Hydration and the Node bootstrap.
- [I18N](i18n.md) — Angular's built-in I18N with federated remotes.
- [Localization](localization.md) — `@angular/common/locales`, `ignoreUnusedDeps`, and the `shareAngularLocales` helper.
- [Custom Builder](custom-builder.md) — inject extra esbuild plugins via `runBuilder`.
- [Migration to v4](migration-v4.md) — moving from v3 to the v4 (ESM, orchestrator-ready) generation.

## Versioning

The adapter follows Angular's major versions: `21.x` targets Angular 21.x, `20.1.x` targets Angular 20.1, and so on. Pin the same major as your Angular CLI.

> **Note:** The v4 generation is published under `@angular-architects/native-federation-v4` while it stabilises. Once it lands as the new default, the package name will revert to `@angular-architects/native-federation`. The runtime semantics, config and builder API are identical.

## Example repositories

- [Explore all of our Angular examples](https://github.com/native-federation/angular-examples)

## Prerequisites

- **Angular CLI 16.1+** — the adapter targets the modern `@angular/build:application` builder. Older `browser-esbuild` projects must run the `appbuilder` migration first (see [Schematics](schematics.md)).
- **Nx** — works out of the box; tested with both Angular CLI workspaces and Nx.
- **ESM** — v4 requires `"type": "module"` in the root `package.json`. The migration schematic adds it for you.
