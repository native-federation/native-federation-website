---
applies_to: [v4]
---

# Getting Started with Core

> Install @softarc/native-federation and wire the core builder into your build script with a bundler adapter.

This page walks through the minimum setup needed to use the core builder directly — install the package, add a bundler adapter, and call the three methods that augment your build process.

> **Note:** If you're using Angular, React-with-esbuild, or Vite, prefer the matching [adapter](../adapters/index.md). This page is for people wiring the core into a custom stack or authoring a new adapter.

## 1. Install the Core Package

```bash
npm i @softarc/native-federation
```

The core is tooling-agnostic. To actually run a bundle, you also need a build adapter. For most stacks the esbuild adapter is a good starting point:

```bash
npm i @softarc/native-federation-esbuild
```

For Angular, use [the Angular adapter](../angular-adapter/index.md) instead, which brings its own builder.

## 2. Create a Federation Config

Every host and every remote declares a `federation.config.js`. This is the single place where you describe what to share and what to expose. A minimal host config:

```js
// shell/federation.config.js
import { withNativeFederation, shareAll } from '@softarc/native-federation/config';

export default withNativeFederation({
  name: 'shell',
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
  },
});
```

A minimal remote config additionally declares `exposes`:

```js
// mfe1/federation.config.js
import { withNativeFederation, shareAll } from '@softarc/native-federation/config';

export default withNativeFederation({
  name: 'mfe1',
  exposes: {
    './component': './mfe1/component',
  },
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },
});
```

See [Configuration](configuration.md) for every available option.

## 3. Augment Your Build Script

The `federationBuilder` exposes three calls that wrap around your existing build. The pattern is always the same:

1. `init(...)` — normalize the config, register a bundler adapter, compute the externals list.
2. *Your build* — run your own bundler with `federationBuilder.externals` passed as externals.
3. `build()` — bundle the shared dependencies and exposed modules, then write `remoteEntry.json` and the import map.

```js
import * as esbuild from 'esbuild';
import * as path from 'path';
import { esBuildAdapter } from '@softarc/native-federation-esbuild';
import { federationBuilder } from '@softarc/native-federation';

const projectName = 'shell';
const outputPath = `dist/${projectName}`;

// 1. Initialize Native Federation
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

// 2. Run your own build, respecting the computed externals
await esbuild.build({
  entryPoints: [`${projectName}/main.ts`],
  outdir: outputPath,
  bundle: true,
  format: 'esm',
  external: federationBuilder.externals,
});

// 3. Let the core bundle shared + exposed modules and write artifacts
await federationBuilder.build();
```

## 4. Serve the Output

After a successful build you'll find a `remoteEntry.json` alongside the bundled shared and exposed modules in your `outputPath`. Serve that directory — the runtime picks it up.

## Next Steps

- [Configuration](configuration.md) — every option on `withNativeFederation`.
- [Sharing Dependencies](sharing.md) — `share`, `shareAll`, secondary entry points.
- [Build Process](build-process.md) — the full `federationBuilder` lifecycle, including watch-mode rebuilds.
- [Build Adapters](build-adapters.md) — implement `NFBuildAdapter` to support a new bundler.
