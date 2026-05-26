---
applies_to: [v4]
---

# React & CommonJS Interop

> CommonJS interop for the esbuild adapter — the React preset, fileReplacements, shareAll overrides and the Shadow-DOM custom-element pattern.

Most of the React-specific plumbing in the esbuild adapter exists because React still ships as CommonJS. In v4 this is wrapped up in a built-in **React preset** that the adapter applies by default, so a React remote works out of the box. This page explains what that preset does and the knobs around it — the CommonJS plugin, `fileReplacements`, the `shareAll` overrides, the `skip` list, and the Shadow-DOM custom-element pattern.

## The React Preset (Default)

The adapter's [`frameworks`](configuration.md#frameworks) option defaults to `[reactFrameworkPlugin()]` whenever you don't pass `frameworks` yourself. That preset does two things:

1. Registers the canonical React `fileReplacements` (the `cjs/` map below), picking the development or production variant from the build's `dev` flag.
2. Sets `needsCommonJsPlugin: true`, which turns on `@chialab/esbuild-plugin-commonjs` for the node-modules bundle.

So for a React remote you usually configure nothing — just leave `adapterConfig.plugins: []` (or omit `adapterConfig` entirely) and the preset handles React. The package ships `@chialab/esbuild-plugin-commonjs` as a dependency, so there is nothing extra to install.

If you are **not** building a React app, opt out by passing an empty array:

```ts
adapterConfig: {
  plugins: [],
  frameworks: [],
}
```

## The CommonJS Plugin

When a preset sets `needsCommonJsPlugin` (the React preset does), the **node-modules** bundle is built with [`@chialab/esbuild-plugin-commonjs`](https://www.npmjs.com/package/@chialab/esbuild-plugin-commonjs). The adapter also defines `process.env.NODE_ENV` (`"development"` or `"production"` based on `dev`) on that bundle unconditionally. For most CJS libraries the plugin is enough — it converts `module.exports` / `exports.*` patterns to ESM named exports and you import them as normal.

With `frameworks: []` (no preset requesting it), the CommonJS plugin is not applied — the node-modules bundle is built as plain ESM.

## Why React Needs Extra Work

React's entry points (`react/index.js`, `react/jsx-runtime.js`, `react-dom/index.js`) are tiny CJS wrappers that `require()` a pre-bundled file under `cjs/`, choosing development or production at runtime via `process.env.NODE_ENV`. Three things make that problematic for a federation bundle:

1. The `require()` picks the dev/prod file dynamically — esbuild can't tree-shake the branch it doesn't need.
2. React's named exports (`useState`, `useEffect`, …) are attached to `module.exports` inside the `cjs/` file. Going through the wrapper layer can lose them after conversion, depending on how each consumer imports them.
3. React's submodules (`react-dom/client`, `react/jsx-runtime`, …) must share identity with the main module at runtime, or you get _Invalid Hook Call_ errors across the federation boundary.

The React preset solves all of this by pointing React's entry points straight at its pre-bundled `cjs/` files, so esbuild never sees the dynamic `require()`.

## What the Preset Replaces

The React preset applies this `fileReplacements` map automatically — the development variant when `dev` is on, the production variant otherwise. You do not have to write any of it; it is shown here so you know what the build resolves React to:

```ts
// dev
{
  'node_modules/react/index.js':
    'node_modules/react/cjs/react.development.js',
  'node_modules/react/jsx-runtime.js':
    'node_modules/react/cjs/react-jsx-runtime.development.js',
  'node_modules/react/jsx-dev-runtime.js':
    'node_modules/react/cjs/react-jsx-dev-runtime.development.js',
  'node_modules/react-dom/index.js':
    'node_modules/react-dom/cjs/react-dom.development.js',
}

// prod
{
  'node_modules/react/index.js':
    'node_modules/react/cjs/react.production.min.js',
  'node_modules/react/jsx-runtime.js':
    'node_modules/react/cjs/react-jsx-runtime.production.min.js',
  'node_modules/react/jsx-dev-runtime.js':
    'node_modules/react/cjs/react-jsx-dev-runtime.production.min.js',
  'node_modules/react-dom/index.js':
    'node_modules/react-dom/cjs/react-dom.production.min.js',
}
```

Feeding the pre-bundled React straight into esbuild skips the dynamic `require()` entirely and keeps the named exports intact across the federation boundary.

## Overriding the Replacements

You only need to touch `fileReplacements` when the defaults don't fit — for example, pinning React to a specific build or replacing a different CJS library. Your top-level `adapterConfig.fileReplacements` is merged on top of the preset's map and wins on conflicts:

```ts
await runEsBuildBuilder('federation.config.js', {
  outputPath: 'dist',
  entryPoints: ['src/bootstrap.tsx'],
  adapterConfig: {
    plugins: [],
    fileReplacements: {
      'node_modules/react/index.js':
        'node_modules/react/cjs/react.production.min.js',
    },
  },
});
```

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

- Leave the default React preset in place — don't pass `frameworks: []` for a React app.
- Share `react` and `react-dom` as _singletons_ with `includeSecondaries: { keepAll: true }`.
- Skip `react-dom/server*` and `react-dom/test-utils`.
- Expose a custom element with Shadow DOM so the remote is drop-in on any host.
- Only override `fileReplacements` if you need React pinned to a build the preset doesn't pick.
