---
applies_to: [v4]
---

# Angular Adapter

> The Angular adapter for Native Federation — a builder, schematics and runtime helpers that integrate Angular's esbuild-based ApplicationBuilder with the Native Federation core.

The Angular adapter — published as `@angular-architects/native-federation` from **Angular 22** onward (and as `@angular-architects/native-federation-v4` on **Angular 20/21**) — is the first-class integration between Angular's esbuild-based `@angular/build:application` and the [Native Federation core](../core/index.md). It ships a builder that wraps the Angular CLI, schematics that scaffold hosts and remotes, an Nx generator, and a small set of Angular-aware config and runtime helpers.

> **Note:** This section covers the v4 Angular adapter (Angular 20+). The examples use the **Angular 22** package name `@angular-architects/native-federation`; on Angular 20/21 the identical adapter is published as `@angular-architects/native-federation-v4` (substitute `-v4` throughout). For a full overview of what changed since v3 — packages, ESM, Angular version support — see [v3 vs v4](../v3-vs-v4.md).

> **Try the playground** — runnable hosts, remotes and SSR examples on GitHub: [native-federation/playground](https://github.com/native-federation/playground).

## What's in the Box

| Piece | Entry point | Purpose |
| --- | --- | --- |
| **Builder** | `@angular-architects/native-federation:build` | Replaces the default Angular build/serve target. Wraps `@angular/build:application`, runs the federation build, and proxies federation artifacts through the dev-server. |
| **Schematics** | `ng add @angular-architects/native-federation` | Initializes a project as a host, dynamic-host or remote — patches `angular.json`, polyfills, `main.ts` and creates `federation.config.mjs`. Also ships `update-v4`, `appbuilder` and `remove`. |
| **Config helpers** | `@angular-architects/native-federation/config` | `withNativeFederation`, `share`, `shareAll`, `shareAngularLocales`, `NG_SKIP_LIST` — Angular-aware wrappers around the core config helpers. |
| **Runtime helpers** | `@angular-architects/native-federation` | Provides `initFederation` and a (deprecated) top-level `loadRemoteModule` that bridge to the [orchestrator](runtime.md) runtime, plus re-exported domain types. The generated `main.ts` wires the orchestrator by default — see [Runtime](runtime.md). |
| **Nx generator** | `@angular-architects/native-federation:native-federation` | Adds a Nx library project pre-wired to the federation builder. |
| **Internal API** | `@angular-architects/native-federation/internal` | Exposes `runBuilder` for users who need to inject custom esbuild plugins. See [Custom Builder](custom-builder.md). |

## Why an Adapter?

The [core builder](../core/index.md) is intentionally framework- and bundler-agnostic. The Angular adapter adds the glue that an Angular project needs:

- **Delegates to the Application Builder** — Angular's `@angular/build:application` does the actual app compile, so every CLI optimisation (esbuild, Vite dev server, Incremental Hydration, prerender, …) is preserved.
- **Drives the dev server** — patches `serveWithVite` with federation middleware so `ng serve` serves the federated artifacts alongside the Angular bundle, with hot-reload via Server-Sent Events.
- **Sane Angular defaults** — ships an Angular-aware `NG_SKIP_LIST`, infers the `browser`/`node` platform from your dependencies, and special-cases `@angular/common/locales` so locale data stays correct under `ignoreUnusedDeps`.
- **Angular I18N** — runs `localize-translate` over the federation artifacts so a single build produces one bundle per locale.
- **SSR + Hydration** — registers the federation loader before Angular evaluates via a `node --import …/node-preload` launch preload (prod) or a dev host-instance bridge (`ng serve`), bridging the host's shared singletons so remotes render server-side against one `@angular/core`. The same orchestrator [`/node` entry](../orchestrator/node.md) you'd use elsewhere drives it. See [SSR & Hydration](ssr.md).

## In this Section

- [Getting Started](getting-started.md) — install the package and scaffold your first host and remote with `ng add`.
- [Builder](builder.md) — the `@angular-architects/native-federation:build` target, what it puts in your `angular.json`, and every option it accepts.
- [Schematics](schematics.md) — `init`, `appbuilder`, `update-v4`, `remove`, plus the Nx generator.
- [Angular Config](configuration.md) — what `withNativeFederation` changes for Angular projects (skip list, platform inference, locale handling). Refer back to [core configuration](../core/configuration.md) for the full schema.
- [Runtime](runtime.md) — `initFederation`, `loadRemoteModule` and the optional orchestrator runtime.
- [SSR & Hydration](ssr.md) — Angular SSR, Incremental Hydration and the Node bootstrap.
- [I18N](i18n.md) — Angular's built-in I18N with federated remotes.
- [Localization](localization.md) — `@angular/common/locales`, `ignoreUnusedDeps`, and the `shareAngularLocales` helper.
- [Custom Builder](custom-builder.md) — inject extra esbuild plugins via `runBuilder`.
- [Migration to v4](migration-v4.md) — moving from v3 to the v4 (ESM, orchestrator-ready) generation.

## Versioning

The adapter follows Angular's major versions: `22.x` targets Angular 22.x, `21.x` targets Angular 21.x, `20.1.x` targets Angular 20.1, and so on. Pin the same major as your Angular CLI.

> **Note:** The package name depends on your Angular version. From **Angular 22** the v4 adapter is published under its original name, `@angular-architects/native-federation` (22.x). On **Angular 20/21** the same adapter ships as `@angular-architects/native-federation-v4`. The runtime semantics, config and builder API are identical — only the package name differs.

## Example repositories

- [Explore all of our examples](https://github.com/native-federation/playground)

## Prerequisites

- **Angular CLI 16.1+** — the adapter targets the modern `@angular/build:application` builder. Older `browser-esbuild` projects must run the `appbuilder` migration first (see [Schematics](schematics.md)).
- **Nx** — works out of the box; tested with both Angular CLI workspaces and Nx.
- **ESM** — v4 is fully ESM. You do **not** need `"type": "module"` in `package.json`; the federation config is loaded as `federation.config.mjs`, and the schematics generate it for you.
