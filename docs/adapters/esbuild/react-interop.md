---
applies_to: [v4]
---

# React & CommonJS Interop

> CommonJS interop for the esbuild adapter — React fileReplacements, compensateExports, shareAll overrides and the Shadow-DOM custom-element pattern.

Most of the React-specific plumbing in the esbuild adapter exists because React still ships as CommonJS. This page collects every knob you might need — the built-in CommonJS plugin, `fileReplacements`, `compensateExports`, the `shareAll` overrides, the `skip` list, and the Shadow-DOM custom-element pattern.

## The CommonJS Plugin (Automatic)

Every **node-modules** bundle is built with [`@chialab/esbuild-plugin-commonjs`](https://www.npmjs.com/package/@chialab/esbuild-plugin-commonjs), and the adapter defines `process.env.NODE_ENV` (`"development"` or `"production"` based on `dev`). For most CJS libraries this is enough — the plugin converts `module.exports` / `exports.*` patterns to ESM named exports and you import them as normal.

There is no opt-out and no configuration: the node-modules bundle is deliberately opaque so that _shared_ dependencies always come out of the build shaped the same way, regardless of what the host app does.

## Why React Needs Extra Work

React's entry points (`react/index.js`, `react/jsx-runtime.js`, `react-dom/index.js`) are tiny CJS wrappers that `require()` a pre-bundled file under `cjs/`, choosing development or production at runtime via `process.env.NODE_ENV`. Three things make that problematic for a federation bundle:

1. The `require()` picks the dev/prod file dynamically — esbuild can't tree-shake the branch it doesn't need.
2. React's named exports (`useState`, `useEffect`, …) are attached to `module.exports` inside the `cjs/` file. Going through the wrapper layer can lose them after conversion, depending on how each consumer imports them.
3. React's submodules (`react-dom/client`, `react/jsx-runtime`, …) must share identity with the main module at runtime, or you get _Invalid Hook Call_ errors across the federation boundary.

The adapter has three mechanisms for this — a default, a fallback, and a core-level knob.

## Default: `compensateExports`

Out of the box, `EsBuildAdapterConfig.compensateExports` defaults to `[/react/]`. Modules matching this list go through the core's **export-compensation pass**: the adapter parses the bundled output with `acorn`, detects named `exports.*` assignments and default exports, and writes a small re-export shim so named ESM imports resolve correctly regardless of how the CJS side wrote them.

For most React apps this default is all you need. Leave it alone unless you are sharing another CJS library with the same export shape and want it compensated too:

```ts
adapterConfig: {
  plugins: [],
  compensateExports: [/react/, /some-legacy-cjs-lib/],
}
```

## Fallback: `fileReplacements`

When the wrapper dance still gives you hook errors, or when you want a fully pre-bundled React build for production, point the entry points directly at React's `cjs/` files. The adapter already ships this replacement map internally — reuse it verbatim or adapt per environment:

```ts
const isDev = process.argv.includes('--dev');

const reactDev = {
  'node_modules/react/index.js':
    'node_modules/react/cjs/react.development.js',
  'node_modules/react/jsx-runtime.js':
    'node_modules/react/cjs/react-jsx-runtime.development.js',
  'node_modules/react/jsx-dev-runtime.js':
    'node_modules/react/cjs/react-jsx-dev-runtime.development.js',
  'node_modules/react-dom/index.js':
    'node_modules/react-dom/cjs/react-dom.development.js',
};

const reactProd = {
  'node_modules/react/index.js':
    'node_modules/react/cjs/react.production.min.js',
  'node_modules/react/jsx-runtime.js':
    'node_modules/react/cjs/react-jsx-runtime.production.min.js',
  'node_modules/react/jsx-dev-runtime.js':
    'node_modules/react/cjs/react-jsx-dev-runtime.production.min.js',
  'node_modules/react-dom/index.js':
    'node_modules/react-dom/cjs/react-dom.production.min.js',
};

await runEsBuildBuilder('federation.config.js', {
  outputPath: 'dist',
  entryPoints: ['src/bootstrap.tsx'],
  dev: isDev,
  watch: isDev,
  adapterConfig: {
    plugins: [],
    fileReplacements: isDev ? reactDev : reactProd,
  },
});
```

This feeds the pre-bundled React straight into esbuild and skips the dynamic `require()` entirely. Combine it with the default `compensateExports` and the named-export story is airtight.

## `shareAll` Overrides

On the core side, `react` and `react-dom` need to be shared as singletons with their _secondary_ entry points kept together. This is what ensures `react-dom/client` resolves to the same React as `react` itself on every host and every remote:

```ts
shared: {
  ...shareAll({
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
  }, {
    overrides: {
      "react": {
        singleton: true,
        strictVersion: true,
        requiredVersion: "auto",
        includeSecondaries: { keepAll: true }
      },
      "react-dom": {
        singleton: true,
        strictVersion: true,
        requiredVersion: "auto",
        includeSecondaries: { keepAll: true }
      }
    }
  }),
}
```

`includeSecondaries: { keepAll: true }` is the important part — without it, submodules like `react-dom/client` are dropped from the shared set and load a second React copy, which breaks hooks across the federation boundary.

## Skip the Server Exports

React DOM's package also exposes server-rendering entry points that the core will otherwise try to bundle for the browser. Skip them:

```ts
skip: [
  'react-dom/server',
  'react-dom/server.node',
  'react-dom/server.browser',
  'react-dom/test-utils',
]
```

(If you actually want SSR, set up a separate build with `platform: 'node'` — but that is out of scope for the browser remote.)

## Custom Element + Shadow DOM

Remotes are consumed by the host through a plain tag (`<my-react-app></my-react-app>`), so the idiomatic way to expose a React tree is as a custom element whose `connectedCallback` mounts a React root, and whose `disconnectedCallback` unmounts it. Attaching a Shadow DOM scopes the remote's styles so they can't leak into the host page — and can't be overwritten by it:

```tsx
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { styles } from './styles';
import { TodoApp } from './TodoApp';

class MyReactAppElement extends HTMLElement {
  private root: Root | null = null;

  connectedCallback() {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    shadow.appendChild(styleEl);

    const mount = document.createElement('div');
    shadow.appendChild(mount);

    this.root = createRoot(mount);
    this.root.render(<StrictMode><TodoApp /></StrictMode>);
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }
}

if (!customElements.get('my-react-app')) {
  customElements.define('my-react-app', MyReactAppElement);
}
```

The entry point in your `federation.config.js`'s `exposes` map points at this file, and the host page simply renders `<my-react-app>`. No React in the host; no CSS leakage in either direction.

## Checklist

- Keep the default `compensateExports: [/react/]`.
- Share `react` and `react-dom` as _singletons_ with `includeSecondaries: { keepAll: true }`.
- Skip `react-dom/server*` and `react-dom/test-utils`.
- Expose a custom element with Shadow DOM so the remote is drop-in on any host.
- If you still hit hook errors or missing named exports, add the React `fileReplacements` map above.
