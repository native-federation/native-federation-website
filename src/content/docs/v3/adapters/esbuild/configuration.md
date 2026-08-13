# Adapter Configuration

> Every field on EsBuildAdapterConfig — plugins, fileReplacements, loader — and the two fields that are declared but inert in v3.

`createEsBuildAdapter` takes one object:

```ts
interface EsBuildAdapterConfig {
  plugins: esbuild.Plugin[];
  fileReplacements?: Record<string, string | { file: string }>;
  loader?: { [ext: string]: esbuild.Loader };
  skipRollup?: boolean;
  compensateExports?: RegExp[];
}
```

`plugins` is the only required field. `esBuildAdapter`, the ready-made export, is exactly `createEsBuildAdapter({ plugins: [] })`.

## `plugins`

Standard esbuild plugins, passed straight to the esbuild pass:

```ts
import { createEsBuildAdapter } from '@softarc/native-federation-esbuild';
import svelte from 'esbuild-svelte';

const adapter = createEsBuildAdapter({
  plugins: [svelte()],
});
```

They apply to every entry point the core hands over — exposed modules, shared mappings and shared packages alike. They do **not** apply to the rollup pre-pass that packages go through first, so a plugin that has to see a package's original CommonJS source will not fire.

## `fileReplacements`

Rewrites an entry point's path before the rollup pre-pass runs. The key is matched against the **end** of the path; the value is what replaces it:

```ts
createEsBuildAdapter({
  plugins: [],
  fileReplacements: {
    'node_modules/react/index.js': 'node_modules/react/cjs/react.production.min.js',
  },
});
```

Both the shorthand above and the long form `{ file: '...' }` are accepted. This only affects packages — workspace files never take the rollup path, so replacing one has no effect.

The main use is pointing a package at a build variant that converts cleanly. `reactReplacements` ships ready-made maps for dev and prod; see [React & CJS Interop](react-interop.md).

## `loader`

Passed through to esbuild's [`loader`](https://esbuild.github.io/api/#loader) option, mapping a file extension to how it should be handled:

```ts
createEsBuildAdapter({
  plugins: [],
  loader: {
    '.svg': 'text',
    '.png': 'dataurl',
  },
});
```

## Declared but inert

Two fields exist on the type in `3.5.5` but do nothing:

| Field | Status |
| --- | --- |
| `skipRollup` | Never read. Packages always go through the rollup pre-pass. |
| `compensateExports` | Defaulted to `[/\/react\//]` when unset, but the code that consumed it is disabled. Setting it has no effect. |

They are safe to pass — they are simply ignored. Do not rely on them to change behaviour.

## What the adapter fixes for you

Everything else is derived from the options the core passes:

| esbuild option | Value |
| --- | --- |
| `bundle` | `true` |
| `format` | `'esm'` |
| `target` | `['esnext']` |
| `write` | `false` — the adapter writes the results itself |
| `external` | the core's externals list |
| `entryNames` | `'[name]-[hash]'` when the core asks for hashing, else `'[name]'` |
| `minify` | on unless `dev` |
| `sourcemap` | on when `dev` |

There is no hook for overriding those; if you need different behaviour, write your own adapter against the [`BuildAdapter`](../../core/build-adapters.md) contract — it is one function.

## Related

- [Getting Started](getting-started.md) — where the adapter is plugged in.
- [React & CJS Interop](react-interop.md) — the rollup pre-pass in practice.
