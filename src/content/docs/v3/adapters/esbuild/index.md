# esbuild Adapter

> @softarc/native-federation-esbuild v3 — the reference build adapter, framework-agnostic, esbuild with a rollup pre-pass for CommonJS packages.

`@softarc/native-federation-esbuild` is the reference implementation of the core's [`BuildAdapter`](../../core/build-adapters.md) contract. It is small on purpose: hand it to `federationBuilder.init` and the core can bundle exposed modules, shared mappings and shared packages without knowing anything about your framework.

```
npm i @softarc/native-federation @softarc/native-federation-esbuild
```

The package exports one ready-made adapter and one factory:

```ts
import { esBuildAdapter, createEsBuildAdapter } from '@softarc/native-federation-esbuild';

// zero-config — createEsBuildAdapter({ plugins: [] })
esBuildAdapter;

// configured
const adapter = createEsBuildAdapter({
  plugins: [myEsbuildPlugin()],
  fileReplacements: reactReplacements.prod,
});
```

## How it bundles

Every entry point the core hands over is classified by whether it lives in `node_modules`:

- **Workspace files** — exposed modules and shared mappings — go straight through esbuild: bundled, ESM, `target: esnext`, minified unless `dev` is on, with the core's externals list applied.
- **Packages** get a rollup pre-pass first. Rollup resolves the package with `@rollup/plugin-commonjs` and `@rollup/plugin-node-resolve`, replaces `process.env.NODE_ENV` with `development` or `production`, and writes an ESM file into `node_modules/.tmp/<mangled package name>`. That file is then the esbuild entry point.

The pre-pass exists because esbuild alone cannot always convert CommonJS packages that build their `exports` object dynamically — React being the canonical case. See [React & CJS Interop](react-interop.md).

Output is written by the adapter itself (esbuild runs with `write: false`), with `[name]-[hash]` naming when the core asks for hashing.

## In this section

- [Getting Started](getting-started.md) — a complete build script for a host and a remote.
- [Adapter Configuration](configuration.md) — every field on `EsBuildAdapterConfig`.
- [React & CJS Interop](react-interop.md) — `fileReplacements` and the CommonJS story.

## Related

- [Core → Build Adapters](../../core/build-adapters.md) — the contract this implements.
- [Adapters](../index.md) — the other adapters.
