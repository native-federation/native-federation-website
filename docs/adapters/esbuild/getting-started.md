---
applies_to: [v4]
---

# Getting Started

> Install the esbuild adapter and build your first React remote with Native Federation.

This page walks the [React reference example](https://github.com/Aukevanoost/native-federation-examples-react/) end-to-end — a `federation.config.js`, a `build.mjs` that drives the adapter, and a host page that mounts the remote as a custom element. The whole setup is roughly fifty lines.

## 1. Install

```bash
npm i -D esbuild \
  @softarc/native-federation \
  @softarc/native-federation-esbuild \
  @chialab/esbuild-plugin-commonjs
npm i @softarc/native-federation-orchestrator
```

Also make sure your `package.json` has `"type": "module"` — the adapter and its generated `federation.config.js` are native ESM.

## 2. `federation.config.js`

Declare the remote's name, what it exposes, and how it shares dependencies. This is the exact configuration the React example uses:

```js
import {
  withNativeFederation,
  shareAll,
} from "@softarc/native-federation/config";

export default withNativeFederation({
  name: "@team/mfe1",

  exposes: {
    "./Bootstrap": "./src/bootstrap.tsx"
  },

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
  },

  features: {
    ignoreUnusedDeps: true
  },
  skip: [
    'react-dom/server',
    'react-dom/server.node',
    'react-dom/server.browser',
    'react-dom/test-utils'
  ]
});
```

A few things are specifically shaped for React; the rest is standard federation config — see [federation.config.js](../../core/configuration.md) for the full schema.

- `react` and `react-dom` are pinned as **singletons** with `includeSecondaries: { keepAll: true }` — React's internal sub-modules (`react/jsx-runtime`, `react-dom/client`, …) must all resolve to the same copy.
- The `skip` list removes server entry points that React ships but the browser build should not try to bundle.
- `features.ignoreUnusedDeps: true` tells the core to skip sharing anything the build didn't actually pull in — useful for apps that list everything in `package.json`.

## 3. `build.mjs`

The adapter does not ship a CLI. You call `runEsBuildBuilder` from a small Node script:

```js
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { extname, join } from 'path';
import { runEsBuildBuilder } from '@softarc/native-federation-esbuild';

const isDev = process.argv.includes('--dev');

const federation = await runEsBuildBuilder('federation.config.js', {
  outputPath: 'dist',
  tsConfig: 'tsconfig.json',
  dev: isDev,
  watch: isDev,
  entryPoints: ['src/bootstrap.tsx'],
  adapterConfig: { plugins: [] },
});

if (isDev) {
  // …simple static server for dist/ + public/ on :3000 …
  process.on('SIGINT',  async () => { await federation.close(); process.exit(0); });
  process.on('SIGTERM', async () => { await federation.close(); process.exit(0); });
} else {
  await federation.close();
  console.log('Build complete.');
}
```

The option names mirror `EsBuildBuilderOptions` one-to-one (see [Builder](builder.md)). In short:

- `outputPath` — where federation artifacts and the bundled entry points are written. `remoteEntry.json` lands here.
- `dev: true` — sourcemaps on, minification off.
- `watch: true` — start the file watcher and rebuild queue; calling `federation.close()` stops them.
- `entryPoints` — the source files esbuild starts from. You normally list the files named in `exposes`.
- `adapterConfig.plugins` — extra esbuild plugins for the source bundle (Sass, SVG loader, …). Leave empty if you don't need any.

In production mode (`npm run build`), the script awaits `federation.close()` to tear esbuild down cleanly and exits. In dev mode, `watch: true` keeps the process alive — the adapter rebuilds on file changes and the tiny HTTP server serves `dist/` and `public/`.

> **Note:** The example uses a hand-written `http.createServer` because the adapter is deliberately framework-agnostic. You can just as easily pipe its output into Vite, a Fastify static server, or `@web/dev-server`.

## 4. Host page (`public/index.html`)

The host page declares the remotes, pulls in the orchestrator runtime, and mounts the remote's custom element. No JS framework needed on the host itself:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Todos</title>

    <!-- 1. Declare your micro frontends (remotes) -->
    <script type="application/json" id="mfe-manifest">
      { "@team/mfe1": "./remoteEntry.json" }
    </script>

    <!-- 2. Trigger module loading once the orchestrator is ready -->
    <script>
      window.addEventListener(
        "mfe-loader-available",
        (e) => { e.detail.loadRemoteModule("@team/mfe1", "./Bootstrap"); },
        { once: true }
      );
    </script>

    <!-- 3. Include the orchestrator runtime -->
    <script src="https://unpkg.com/@softarc/native-federation-orchestrator@4.0.2/quickstart.mjs"></script>
  </head>
  <body>
    <!-- 4. Use your loaded components -->
    <my-react-app></my-react-app>
  </body>
</html>
```

See the [orchestrator docs](../../orchestrator/index.md) for the full `quickstart.mjs` story, or [initFederation](../../runtime/init-federation.md) if you want to drive loading manually.

## 5. `src/bootstrap.tsx`

The exposed entry point registers a custom element that owns a Shadow DOM — this keeps the remote's styles from leaking into the host page:

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

The custom-element-plus-Shadow-DOM pattern is covered in more detail on the [React & CommonJS Interop](react-interop.md) page.

## 6. Run it

Wire the two scripts in `package.json`:

```json
{
  "scripts": {
    "start": "node build.mjs --dev",
    "build": "node build.mjs"
  }
}
```

```bash
npm start   # dev server on http://localhost:3000 with file watching
npm run build   # writes dist/remoteEntry.json + bundled artifacts
```

## Next Steps

- [Builder](builder.md) — the full `EsBuildBuilderOptions` reference.
- [Adapter Configuration](configuration.md) — add esbuild plugins, file replacements and custom loaders.
- [React & CommonJS Interop](react-interop.md) — what to do when a CJS library doesn't Just Work.
