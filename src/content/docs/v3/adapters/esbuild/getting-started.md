# Getting Started with the esbuild Adapter

> Build a remote and a host with the esbuild adapter — install, configure, write the build script, serve.

This walks through a framework-agnostic setup: two applications, each with its own `federation.config.js` and build script, both bundled by esbuild through the adapter.

## 1. Install

```
npm i @softarc/native-federation @softarc/native-federation-esbuild
npm i esbuild es-module-shims
```

## 2. Configure the remote

```js
// mfe1/federation.config.js
const { withNativeFederation, shareAll } = require('@softarc/native-federation/build');

module.exports = withNativeFederation({
  name: 'mfe1',

  exposes: {
    './component': './mfe1/component.ts',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },
});
```

## 3. Write the build script

The same script shape works for both applications — only the project name changes.

```ts
// tools/build.ts
import * as esbuild from 'esbuild';
import * as path from 'path';
import { esBuildAdapter } from '@softarc/native-federation-esbuild';
import { federationBuilder } from '@softarc/native-federation/build';

const projectName = process.argv[2];
const outputPath = `dist/${projectName}`;

await federationBuilder.init({
  options: {
    workspaceRoot: path.join(__dirname, '..'),
    outputPath,
    tsConfig: 'tsconfig.json',
    federationConfig: `${projectName}/federation.config.js`,
    verbose: false,
  },
  adapter: esBuildAdapter,
});

await esbuild.build({
  entryPoints: [`${projectName}/main.ts`],
  outdir: `${outputPath}/`,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['esnext'],
  external: federationBuilder.externals,
});

await federationBuilder.build();
```

`federationBuilder.externals` is the list your own bundle must leave alone — those specifiers resolve through the import map at runtime. Skipping that line is the most common way to end up with two copies of a framework on the page.

## 4. Configure the host

A host usually exposes nothing and only declares what it shares:

```js
// shell/federation.config.js
const { withNativeFederation, shareAll } = require('@softarc/native-federation/build');

module.exports = withNativeFederation({
  name: 'shell',
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },
});
```

## 5. Wire the host's HTML

The runtime injects its import map as `<script type="importmap-shim">`, so `es-module-shims` has to be on the page and the entry script has to be `type="module-shim"`:

```html
<script type="esms-options">
  { "shimMode": true, "mapOverrides": true }
</script>

<script src="https://ga.jspm.io/npm:es-module-shims@1.10.0/dist/es-module-shims.js"></script>

<script type="module-shim" src="main.js"></script>
```

## 6. Split the host's bootstrap

```ts
// shell/main.ts
import { initFederation } from '@softarc/native-federation-runtime';

(async () => {
  await initFederation({
    mfe1: 'http://localhost:3001/remoteEntry.json',
  });

  await import('./app');
})();
```

The dynamic `import('./app')` is required — the import map must exist before anything that resolves a shared dependency is evaluated. See [Runtime → Getting Started](../../runtime/getting-started.md).

A remote does the same with no arguments, so its own shared dependencies are registered when it runs standalone:

```ts
// mfe1/main.ts
import { initFederation } from '@softarc/native-federation-runtime';

(async () => {
  await initFederation();
  await import('./component');
})();
```

## 7. Load a remote module

```ts
const mod = await loadRemoteModule({
  remoteName: 'mfe1',
  exposedModule: './component',
});
```

## 8. Serve

Both `dist/` folders are static sites. Serve each on its own port — the host fetches the remote's `remoteEntry.json` over HTTP, so the remote's server needs permissive CORS in development.

## Next

- [Adapter Configuration](configuration.md) — plugins, loaders and file replacements.
- [React & CJS Interop](react-interop.md) — what to add when React is in the mix.
- [Core → Build Process](../../core/build-process.md) — what `federationBuilder.build()` does.
