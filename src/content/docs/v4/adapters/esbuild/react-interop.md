# React & CommonJS Interop

> CommonJS interop for the esbuild adapter — the CommonJS plugin, how React is bundled, shareAll overrides and the Shadow-DOM custom-element pattern.

React still ships as CommonJS, and so do many other libraries you share. The esbuild adapter handles this for every build, so a React remote needs no framework preset or extra configuration. This page explains what the adapter does for CommonJS packages, the `shareAll` overrides React needs, `REACT_SKIP_LIST`, and the Shadow-DOM custom-element pattern.

## The CommonJS Plugin

esbuild handles CommonJS on its own: a CJS package bundled into ESM output gets its `module.exports` wrapped, and you import it as normal. The gap is a CJS `require()` of another **shared** package. That package is external, and esbuild turns the call into a `__require` shim that throws in the browser (`Dynamic require of "react" is not supported`).

The adapter adds its CommonJS plugin to every shared-package bundle. The plugin routes each `require()` of an external through a small ESM stub, so it becomes a real top-level `import` that the import map resolves to the shared copy. Everything else keeps esbuild's own interop. The plugin is part of the adapter, so there is nothing to install or switch on.

## How React Is Bundled

React's entry points (`react/index.js`, `react/jsx-runtime.js`, `react-dom/index.js`) are tiny CJS wrappers that `require()` either the development or the production build under `cjs/`, depending on `process.env.NODE_ENV`. The adapter defines `process.env.NODE_ENV` on shared packages — `"development"` when `dev` is on, `"production"` otherwise — so esbuild drops the branch it doesn't need and bundles only the matching React build.

If an older build script still passes `reactFrameworkPlugin()` in [`frameworks`](configuration.md#frameworks), remove it: the preset is deprecated and empty. Keep importing `REACT_SKIP_LIST` from the same entry point.

To point a CommonJS library at a different file, use [`fileReplacements`](configuration.md#filereplacements).

## `shareAll` Overrides

On the core side, `react` and `react-dom` need to be shared as singletons with their _secondary_ entry points kept together. This is what ensures `react-dom/client` resolves to the same React as `react` itself on every host and every remote:

```ts
shared: {
  ...shareAll({
    singleton: true,
    strictVersion: true,
    requiredVersion: "auto",
  }, {
    skipList: REACT_SKIP_LIST,
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

React DOM's package also exposes server-rendering, static-rendering, test and profiling entry points that the core would otherwise try to bundle for the browser. `REACT_SKIP_LIST` skips them:

```ts
import { REACT_SKIP_LIST } from '@softarc/native-federation-esbuild/frameworks/react';

// REACT_SKIP_LIST is:
[
  ...ESBUILD_SKIP_LIST,
  /^react-dom\/(server|static)(\.|$)/,
  'react-dom/test-utils',
  'react-dom/profiling',
]
```

Pass it as `skipList` to `shareAll` (as above), to `share`, or to `fromPackageJson(...).skip(...)`. Extend it with your own entries the same way — `[...REACT_SKIP_LIST, /^@my-org\/internal/]`. See [Skip Lists](configuration.md#skip-lists) for `ESBUILD_SKIP_LIST`, the base it builds on.

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

- Share `react` and `react-dom` as _singletons_ with `includeSecondaries: { keepAll: true }`.
- Pass `REACT_SKIP_LIST` as the `skipList` of `shareAll` / `share`.
- Expose a custom element with Shadow DOM so the remote is drop-in on any host.
