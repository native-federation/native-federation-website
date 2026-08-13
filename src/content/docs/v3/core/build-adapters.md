# Build Adapters

> The BuildAdapter contract — one function that bundles a set of entry points, and everything the core asks of it.

The core never calls a bundler directly. It calls a `BuildAdapter`: a single async function that takes entry points and options and returns the file names it produced. That is the whole contract, and it is why Native Federation works with esbuild, the Angular CLI, Vite and anything else you care to wire up.

```ts
type BuildAdapter = (options: BuildAdapterOptions) => Promise<BuildResult[]>;

interface BuildResult {
  fileName: string;
}
```

Register one before building:

```ts
import { setBuildAdapter } from '@softarc/native-federation/build';

setBuildAdapter(myAdapter);
```

`federationBuilder.init({ options, adapter })` does this for you. Without a registered adapter the core logs `Please set a BuildAdapter!` and produces nothing.

## `BuildAdapterOptions`

| Field | Type | Meaning |
| --- | --- | --- |
| `entryPoints` | `{ fileName, outName }[]` | What to bundle. `fileName` is the source path; `outName` is the name the core expects back, and how it looks the result up afterwards. |
| `outdir` | string | Where to write. Already resolved against the workspace root. |
| `external` | `string[]` | Package names that must **not** be inlined — they resolve through the import map at runtime. |
| `kind` | `'shared-package' \| 'shared-mapping' \| 'exposed' \| 'mapping-or-exposed'` | What is being built. Adapters use it to vary optimization, linking or logging. |
| `tsConfigPath` | string? | The project's tsconfig, for adapters that compile TypeScript. |
| `mappedPaths` | `MappedPath[]` | The resolved tsconfig path aliases, so the bundler can resolve workspace-internal imports. |
| `packageName` | string? | Set when bundling a single shared package. |
| `platform` | `'browser' \| 'node'` | Which platform this bundle targets. |
| `esm` | boolean? | Whether the input is already ESM. |
| `dev` | boolean? | Development mode: skip minification, keep the output readable. |
| `watch` | boolean? | Keep the bundler running and re-emit on change. |
| `hash` | boolean | Whether output file names should carry a content hash. |
| `optimizedMappings` | boolean? | Hint that shared mappings may be bundled together. |
| `signal` | `AbortSignal`? | Cancellation. A long-running adapter should abort and reject when it fires. |

## What an adapter must do

1. **Bundle each entry point to ESM** in `outdir`, honouring `external`.
2. **Return one `BuildResult` per emitted file**, with the file name relative to `outdir`. The core matches them back to entry points by `outName`, so the names must line up.
3. **Respect `hash`** — with hashing on, the core reads the real emitted names out of your results rather than guessing them.

Everything else — how TypeScript is compiled, whether rollup is involved, how CommonJS is converted — is the adapter's business.

## The reference adapter

`@softarc/native-federation-esbuild` is the shortest example: esbuild for the common path, rollup for the cases esbuild cannot handle alone (CommonJS packages that build their `exports` object dynamically). See the [esbuild adapter](../adapters/esbuild/index.md) section for its configuration.

The Angular adapter's is more involved: it reuses Angular's own compiler plugin so shared packages and exposed modules are built with the project's TypeScript and Angular options, and it runs the Angular linker over shared packages that ship partial-Ivy code.

## Related

- [Build Process](build-process.md) — when and with which `kind` the adapter is called.
- [esbuild Adapter](../adapters/esbuild/index.md) — the reference implementation.
- [Getting Started](getting-started.md) — registering an adapter through `federationBuilder.init`.
