# Angular Adapter

> The v3 Angular adapter for Native Federation — a builder, schematics and config helpers that integrate native-federation into Angular's esbuild-based Application Builder.

`@angular-architects/native-federation` is the first-class integration between Angular's `@angular/build:application` builder and the [Native Federation core](../core/index.md). It ships a builder that wraps the Angular CLI, schematics that scaffold hosts and remotes, an Nx generator, and Angular-aware config helpers.

Its version tracks the Angular major it targets: the `21.x` line documented here builds against Angular 21 and depends on `@softarc/native-federation@~3.5` and `@softarc/native-federation-runtime@~3.5`. Earlier majors of the adapter follow the same shape back to Angular 14.

> **Note:** This section covers the **v3** adapter. The v4 adapter is a different package on Angular 20/21 (`@angular-architects/native-federation-v4`) and takes the original name again from Angular 22. For what changed, see [v3 vs v4](/docs/v4/v3-vs-v4/); for the upgrade itself, [Migration to v4](/docs/v4/migration/).

## What's in the Box

| Piece | Entry point | Purpose |
| --- | --- | --- |
| **Builder** | `@angular-architects/native-federation:build` | Replaces the default Angular build and serve targets. Wraps `@angular/build:application`, runs the federation build, and serves federation artifacts through the dev-server. See [Builder](builder.md). |
| **Schematics** | `ng add @angular-architects/native-federation` | Initializes a project as a `host`, `dynamic-host` or `remote` — rewrites `angular.json`, adds `es-module-shims` to the polyfills, splits `main.ts`, and creates `federation.config.js`. Also ships `appbuilder` and `remove`. See [Schematics](schematics.md). |
| **Config helpers** | `@angular-architects/native-federation/config` | `withNativeFederation`, `share`, `shareAll`, `findRootTsConfigJson`, `DEFAULT_SKIP_LIST` — re-exported from the core — plus the Angular-specific `shareAngularLocales`. See [Angular Config](configuration.md). |
| **Runtime** | `@angular-architects/native-federation` | A plain `export * from '@softarc/native-federation-runtime'`. Everything the adapter offers at runtime _is_ the classic runtime. See [Runtime](runtime.md). |
| **Nx generator** | `@angular-architects/native-federation:native-federation` | Adds an Nx library project pre-wired to the federation builder. |
| **Nx executor** | `@angular-architects/native-federation:build` | The same builder registered as an Nx executor. |

## Why an Adapter?

The [core builder](../core/index.md) is intentionally framework- and bundler-agnostic: hand it a `federation.config.js` and a build adapter, and it emits `remoteEntry.json` plus the bundles it references. The Angular adapter supplies the parts an Angular project needs on top of that:

- **An esbuild adapter wired to Angular's compiler.** Shared packages and shared mappings are bundled with the same TypeScript and Angular compiler options as your application code.
- **`angular.json` integration.** The federation build has to run before and alongside the application build, and the dev-server has to serve the artifacts it emits. The builder handles the sequencing in both `ng build` and `ng serve`.
- **Angular-shaped defaults.** The skip list keeps `zone.js`, `@angular/localize` and the CLI's own packages out of the shared graph; `shareAngularLocales` teaches the share helpers about `@angular/common/locales`.
- **i18n.** Federation artifacts are translated per locale alongside Angular's own locale outputs. See [I18N](i18n.md).

## In this section

- [Getting Started](getting-started.md) — scaffold a host and a remote with `ng add`, wire a lazy route, run both.
- [Builder](builder.md) — the `angular.json` layout the schematic writes, every builder option, and what happens on build and serve.
- [Schematics](schematics.md) — `ng-add`/`init`, `appbuilder`, `remove`, the `update18` migration and the Nx generator.
- [Angular Config](configuration.md) — the `/config` entry point and what the generated `federation.config.js` contains.
- [Runtime](runtime.md) — `initFederation`, `loadRemoteModule` and lazy remote registration as Angular hosts use them.
- [SSR](ssr.md) — the `ssr` builder flag, `initNodeFederation`, and what the schematic generates for a server build.
- [I18N](i18n.md) — Angular's built-in internationalization across federated artifacts.
- [Localization](localization.md) — loading `@angular/common/locales` data.
- [Custom Builder](custom-builder.md) — injecting your own esbuild plugins into the federation build.
