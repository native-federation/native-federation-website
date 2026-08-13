# Adapters

> Native Federation adapters bridge the language-agnostic core builder to specific bundlers and frameworks.

Native Federation is bundler-agnostic. Adapters bridge the [core builder](/docs/v4/core/) to a specific bundler or framework by implementing the `NFBuildAdapter` contract.

## Available Adapters

- [**Angular**](/docs/v4/angular-adapter/) — first-class support via `@angular-architects/native-federation`, including a builder, schematics and an Nx generator that hook into the Angular CLI. Documented in its own [Angular Adapter](/docs/v4/angular-adapter/) section.
- [**esbuild**](/docs/v4/adapters/esbuild/) — a thin, framework-agnostic adapter used by the React reference example, published as `@softarc/native-federation-esbuild`.

## Community Adapters

- [Vite plugin](https://www.npmjs.com/package/@gioboa/vite-module-federation) — community-maintained Vite integration by Giorgio Boa.

> **Note:** You can also write your own adapter. An adapter is a single object implementing `NFBuildAdapter` — see [Build Adapters](/docs/v4/core/build-adapters/) for the contract.
