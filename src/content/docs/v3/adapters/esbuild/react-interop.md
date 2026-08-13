# React & CJS Interop

> Why CommonJS packages need a rollup pre-pass, and how reactReplacements makes React work.

Native Federation moves modules over the wire as ES modules, because that is what import maps resolve. Most of the ecosystem ships ESM. React does not: it ships CommonJS, and it builds its `exports` object in a way that automatic conversion often gets wrong.

## The rollup pre-pass

The esbuild adapter handles this by treating package entry points differently from workspace files. Any entry point whose path contains `node_modules` is first run through rollup:

```
node_modules/react/index.js
  → rollup: commonjs() + nodeResolve() + replace(process.env.NODE_ENV)
  → node_modules/.tmp/_react_index.js   (ESM)
  → esbuild: bundle, minify, hash
  → dist/<project>/react-<hash>.js
```

`@rollup/plugin-commonjs` does the conversion, `@rollup/plugin-node-resolve` resolves the package's own imports, `rollup-plugin-node-externals` keeps the core's externals external, and `@rollup/plugin-replace` substitutes `process.env.NODE_ENV` with `"development"` or `"production"` depending on the core's `dev` flag. The output is written with `exports: 'named'`.

The temporary file name is derived from the entry path with every non-alphanumeric character replaced, so two packages never collide in `node_modules/.tmp`.

## `reactReplacements`

React's `index.js` is a thin dispatcher that requires either `cjs/react.development.js` or `cjs/react.production.min.js` based on `process.env.NODE_ENV`. Converting the dispatcher is fragile; converting the concrete build is not. `fileReplacements` points the pre-pass at the concrete build, and the package ships the maps for React:

```ts
import { createEsBuildAdapter } from '@softarc/native-federation-esbuild';
import { reactReplacements } from '@softarc/native-federation-esbuild/src/lib/react-replacements';

const adapter = createEsBuildAdapter({
  plugins: [],
  fileReplacements: reactReplacements.prod,
});
```

Both maps cover the same four entry points:

| Replaced | `dev` | `prod` |
| --- | --- | --- |
| `react/index.js` | `react/cjs/react.development.js` | `react/cjs/react.production.min.js` |
| `react/jsx-runtime.js` | `react/cjs/react-jsx-runtime.development.js` | `react/cjs/react-jsx-runtime.production.min.js` |
| `react/jsx-dev-runtime.js` | `react/cjs/react-jsx-dev-runtime.development.js` | `react/cjs/react-jsx-dev-runtime.production.min.js` |
| `react-dom/index.js` | `react-dom/cjs/react-dom.development.js` | `react-dom/cjs/react-dom.production.min.js` |

Pick the map that matches the build you are producing — the choice is yours to make, the adapter does not switch between them.

## Other CommonJS libraries

The same technique applies to any package with a dispatcher entry point. Add your own entries to `fileReplacements`, keyed by the tail of the path:

```ts
createEsBuildAdapter({
  plugins: [],
  fileReplacements: {
    ...reactReplacements.prod,
    'node_modules/my-cjs-lib/index.js': 'node_modules/my-cjs-lib/dist/lib.cjs.js',
  },
});
```

If a library's exports still come out wrong after conversion, the remaining options are to share a different entry point, to mark the package as an external you do not share, or to write a small ESM wrapper in your workspace and share that instead.

> **Note:** Older versions of this adapter had a `compensateExports` mechanism that appended re-exports to a converted bundle. In `3.5.5` the option is still on the type but the code behind it is disabled — it has no effect.

## Sharing React across remotes

Nothing about React changes the sharing rules. Declare it like any other package:

```js
shared: {
  ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
}
```

`singleton: true` matters more than usual here: two React instances on one page break hooks. Remember that the v3 runtime only deduplicates when the `version` strings match exactly, so keep React's version aligned across host and remotes.

## Related

- [Adapter Configuration](configuration.md) — `fileReplacements` in the wider config.
- [Core → Sharing Dependencies](../../core/sharing.md) — the sharing rules themselves.
