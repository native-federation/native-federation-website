---
applies_to: [v3, v4]
---

# Getting Started with the Runtime

> Install @softarc/native-federation-runtime, add es-module-shims, split your bootstrap, and load your first remote module.

This page walks through the minimum setup needed to load remotes in the browser with the classic runtime — install the package, add `es-module-shims` to your HTML, split your bootstrap, and call `initFederation` and `loadRemoteModule`.

> **Note:** If you are on Angular, the Angular adapter already wires this up for you — schematics generate the bootstrap split and the correct `initFederation` call. See [Angular Adapter → Runtime](../angular-adapter/runtime.md). This page is for hosts built with a framework-agnostic or custom stack.

## 1. Install the runtime

```
npm i @softarc/native-federation-runtime
```

The runtime has one peer: the build output from [`@softarc/native-federation`](../core/index.md) — it consumes the `remoteEntry.json` your build emits. For Angular projects, install `@angular-architects/native-federation` instead; it re-exports the same runtime.

## 2. Add es-module-shims to the HTML

The runtime injects the import map as a `<script type="importmap-shim">`. Browsers ignore that type — [es-module-shims](https://github.com/guybedford/es-module-shims) picks it up and makes `importShim()` available for the runtime to use when loading modules.

```html
<!-- index.html -->
<script
  type="module"
  src="https://ga.jspm.io/npm:es-module-shims@1.10.0/dist/es-module-shims.js"
></script>

<script type="module" src="./main.js"></script>
```

> **Warning:** Use `type="importmap-shim"` (not `importmap`). The runtime uses the shimmed flavour so that it keeps working after Angular, React or any other framework has already started evaluating modules. If you remove `es-module-shims`, `loadRemoteModule` will fall back to native `import()` — but the injected map will not be honoured, and remote imports will fail.

## 3. Split your bootstrap

Federation must install the import map _before_ any module that depends on a shared external is evaluated. The idiomatic way to guarantee that is to split `main.ts` into a tiny entry file that calls `initFederation` and then dynamically imports the real bootstrap:

```ts
// src/main.ts
import { initFederation } from '@softarc/native-federation-runtime';

initFederation({
  mfe1: 'http://localhost:3001/remoteEntry.json',
})
  .catch(err => console.error(err))
  .then(() => import('./bootstrap'))
  .catch(err => console.error(err));
```

```ts
// src/bootstrap.ts — what main.ts used to contain
import './app/app';   // or your framework's bootstrap call
```

The dynamic `import('./bootstrap')` is the important bit: it forces your bundler to emit the real app as a separate chunk that only loads after `initFederation` resolves. Without the split, the app chunk would evaluate before the import map exists, and any shared dependency would be pinned to the host-bundled copy.

## 4. Call initFederation

`initFederation` accepts either an inline remotes map or a URL to a manifest JSON. Inline is fine for a fixed topology; a manifest lets you ship the same build to different environments.

```ts
// Inline — remotes known at build time
initFederation({
  mfe1: 'http://localhost:3001/remoteEntry.json',
  mfe2: 'http://localhost:3002/remoteEntry.json',
});

// Manifest — remotes resolved at runtime
initFederation('/assets/federation.manifest.json');
```

The manifest itself is just `{ "<remoteName>": "<remoteEntry.json URL>" }`. See [`initFederation`](init-federation.md) for the full signature, options, and error-handling behaviour.

## 5. Load a remote module

Once `initFederation` resolves, any registered remote's exposed modules can be loaded by name. The short form takes a remote name and an exposed key:

```ts
import { loadRemoteModule } from '@softarc/native-federation-runtime';

const { AppComponent } = await loadRemoteModule('mfe1', './Component');
```

The exposed key is exactly the string under `exposes` in the remote's `federation.config.js`. The longer object form adds lazy registration and a fallback value — see [`loadRemoteModule`](load-remote-module.md).

## 6. On the remote side

A remote also calls `initFederation` during its own bootstrap — but passing an empty (or self-referential) remotes map. The purpose is not to load other remotes, but to register the remote's _own_ shared dependencies into the import map so its code resolves them to the bundled versions:

```ts
// remote src/main.ts
import { initFederation } from '@softarc/native-federation-runtime';

initFederation({})
  .catch(err => console.error(err))
  .then(() => import('./bootstrap'))
  .catch(err => console.error(err));
```

A remote is still a deployable web app in its own right — it just happens to also expose modules. The same bootstrap split applies.

## Next

- [`initFederation`](init-federation.md) — manifest URLs, cache busting, failure modes.
- [`loadRemoteModule`](load-remote-module.md) — both call signatures and lazy registration.
- [The Import Map](import-map.md) — what actually gets written to the DOM.
