# Getting Started with the Core

> Install @softarc/native-federation, write a federation.config.js, and wire federationBuilder into your own build script.

The core has no CLI. You call it from your build script in three steps: initialize it, run your bundler with the externals it computed, then let it build the federated artifacts.

## 1. Install

```
npm i @softarc/native-federation
npm i @softarc/native-federation-esbuild
```

The second package is the reference [build adapter](build-adapters.md). Any function matching the `BuildAdapter` type will do; the esbuild one is the shortest path to a working setup.

## 2. Write a `federation.config.js`

One per application, in the project's folder. A remote exposes modules; a host usually only shares:

```js
// mfe1/federation.config.js
const { withNativeFederation, shareAll } = require('@softarc/native-federation/build');

module.exports = withNativeFederation({
  name: 'mfe1',

  exposes: {
    './component': './mfe1/component.ts',
  },

  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
  },
});
```

`shareAll` reads the dependencies from the nearest `package.json`; `requiredVersion: 'auto'` pins each declared range to the version actually installed. See [federation.config.js](configuration.md) for every option and [Sharing Dependencies](sharing.md) for how the helpers expand.

## 3. Wire the builder into your build script

```ts
import * as esbuild from 'esbuild';
import * as path from 'path';
import { esBuildAdapter } from '@softarc/native-federation-esbuild';
import { federationBuilder } from '@softarc/native-federation/build';

const projectName = 'mfe1';
const outputPath = `dist/${projectName}`;

// 1. Initialize — loads the config and computes the externals
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

// 2. Run your own build, respecting the externals
await esbuild.build({
  entryPoints: [`${projectName}/main.ts`],
  outdir: `${outputPath}/`,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: federationBuilder.externals,
});

// 3. Build the federated artifacts
await federationBuilder.build();
```

`federationBuilder.externals` is the list of package names your own bundle must _not_ inline — they are resolved through the import map at runtime instead. Step 3 bundles the exposed modules, the shared packages and the shared mappings, and writes `remoteEntry.json` and `importmap.json` into `outputPath`.

## 4. Serve the output and load it

The output folder is a static site. A host reads its `remoteEntry.json` through the [runtime](../runtime/getting-started.md):

```ts
import { initFederation, loadRemoteModule } from '@softarc/native-federation-runtime';

await initFederation({ mfe1: 'http://localhost:3001/remoteEntry.json' });

const mod = await loadRemoteModule('mfe1', './component');
```

Remember the two host-side requirements: `es-module-shims` on the page, and a bootstrap split so nothing that touches a shared dependency is evaluated before `initFederation` resolves.

## The `FederationOptions`

Everything `federationBuilder.init` accepts under `options`:

| Option | Required | Meaning |
| --- | --- | --- |
| `workspaceRoot` | yes | Absolute path all other paths are resolved against. |
| `outputPath` | yes | Where artifacts are written, relative to `workspaceRoot`. |
| `federationConfig` | yes | Path to `federation.config.js`, relative to `workspaceRoot`. |
| `tsConfig` | | Passed to the build adapter for compiling shared mappings and exposed modules. |
| `entryPoint` | | Your application's entry file. **Required** when `features.ignoreUnusedDeps` is on — the config loader throws without it. |
| `packageJson` | | Overrides which `package.json` the share helpers read. |
| `dev` | | Development mode; produces unminified shared bundles and enables build notifications. |
| `watch` | | Keep the adapter's bundler in watch mode. |
| `verbose` | | Verbose logging. |
| `cacheExternalArtifacts` | | Reuse the shared-package bundle cache between builds. See [Build Process → Caching](build-process.md#caching). |
| `buildNotifications` | | `{ enable, endpoint }`. With `dev` on, the endpoint is written into `remoteEntry.json` so hosts can subscribe to rebuild events. |

## Next

- [federation.config.js](configuration.md) — the config format in full.
- [Build Process](build-process.md) — what step 3 actually does.
- [Build Adapters](build-adapters.md) — writing your own instead of using esbuild's.
