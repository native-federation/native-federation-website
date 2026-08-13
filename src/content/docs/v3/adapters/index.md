# Adapters

> Native Federation adapters bridge the language-agnostic core builder to specific bundlers and frameworks.

Native Federation is bundler-agnostic. An adapter bridges the [core builder](../core/index.md) to a specific bundler or framework by implementing the `BuildAdapter` contract — a single function that bundles a set of entry points and reports what it emitted.

## Available Adapters

- [**Angular**](../angular-adapter/index.md) — first-class support via `@angular-architects/native-federation`, including a builder, schematics and an Nx generator that hook into the Angular CLI.
- [**esbuild**](esbuild/index.md) — the thin, framework-agnostic reference adapter, published as `@softarc/native-federation-esbuild`.

## Community Adapters

- [Vite plugin](https://www.npmjs.com/package/@gioboa/vite-module-federation) — community-maintained Vite integration by Giorgio Boa.

> **Note:** You can also write your own. An adapter is one function implementing `BuildAdapter` — see [Build Adapters](../core/build-adapters.md) for the contract.
