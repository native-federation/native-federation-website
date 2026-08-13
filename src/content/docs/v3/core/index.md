# Core

> @softarc/native-federation v3 — the tooling-agnostic builder that turns a federation.config.js into a remoteEntry.json plus the bundles it points at.

`@softarc/native-federation` is the bundler-agnostic half of Native Federation. Give it a `federation.config.js` and a [build adapter](build-adapters.md), and it bundles your exposed modules, shared packages and shared mappings, then writes the metadata a host needs to load them: `remoteEntry.json` and `importmap.json`.

It knows nothing about Angular, React or esbuild. Everything bundler-specific goes through the `BuildAdapter` function you hand it — which is what makes the [Angular adapter](../angular-adapter/index.md), the [esbuild adapter](../adapters/esbuild/index.md) and the community Vite plugin possible.

```
npm i @softarc/native-federation
```

The package is CommonJS. Two entry points matter:

| Entry point | Contents |
| --- | --- |
| `@softarc/native-federation/build` | Everything build-time: `withNativeFederation`, `share`, `shareAll`, `federationBuilder`, `buildForFederation`, `setBuildAdapter`, `logger`, the config types. |
| `@softarc/native-federation` | A re-export of `@softarc/native-federation-runtime`, for convenience. |

Both the config helpers and the build helpers live behind `/build` — there is no separate config subpath. The Angular adapter's `@angular-architects/native-federation/config` re-exports a subset of it.

## What a build produces

For a project named `mfe1` with one exposed module and a handful of shared packages:

```
dist/mfe1/browser/
├── remoteEntry.json        ← name, exposes[], shared[]
├── importmap.json          ← packageName → file, for tooling
├── Component-<hash>.js     ← the exposed module
├── _angular_core-<hash>.js ← one file per shared package
└── ...
```

The host's runtime reads `remoteEntry.json`, merges every remote's into one import map, and resolves imports against it. See [Build Artifacts](artifacts.md) for the exact shapes.

## In this section

- [Getting Started](getting-started.md) — install, write a config, wire `federationBuilder` into a build script.
- [federation.config.js](configuration.md) — every option on `withNativeFederation`.
- [Sharing Dependencies](sharing.md) — `share`, `shareAll`, secondary entry points, skip lists.
- [Build Process](build-process.md) — what `buildForFederation` does, watch mode, and the bundle cache.
- [Build Adapters](build-adapters.md) — the `BuildAdapter` contract, if you are wiring a new bundler.
- [Build Artifacts](artifacts.md) — `remoteEntry.json` and `importmap.json`, field by field.

## Example repositories

- [VanillaJS example](https://github.com/manfredsteyer/native-federation-core-microfrontend)
- [React example](https://github.com/manfredsteyer/native-federation-react-example) — also shows watch mode
- [Vite + Svelte example](https://github.com/gioboa/svelte-microfrontend-demo)
- [Vite + Angular example powered by AnalogJS](https://github.com/manfredsteyer/native-federation-vite-angular-demo)
