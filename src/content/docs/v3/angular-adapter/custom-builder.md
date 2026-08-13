# Custom Builder

> Wrapping the v3 Angular builder's runBuilder factory to preprocess its options — and what it cannot do.

The adapter's builder factory is exported as `runBuilder`, so you can wrap it in your own Architect builder and adjust the options before delegating. That is useful for computing an option per environment, deriving an output path, or applying a workspace-wide default without repeating it in `angular.json`.

> **Warning:** The v3 builder assembles its esbuild plugin list internally — the shared-mappings plugin plus the externals plugin — and never reads a `plugins` option. Wrapping `runBuilder` cannot inject esbuild plugins on this line. Plugin injection is a v4 capability; see [Custom Builder (v4)](/docs/v4/angular-adapter/custom-builder/).

## The Pattern

1. Write a builder file that calls `runBuilder` with a modified options object.
2. Point the relevant `angular.json` targets at your wrapper instead of `@angular-architects/native-federation:build`.

### 1. The wrapper

The v3 package has no `exports` map and its `main` is `src/index.js`, so the builder module is reachable by its path inside the package:

```js
// custom-builder.js
const { runBuilder } = require('@angular-architects/native-federation/src/builders/build/builder');
const { createBuilder } = require('@angular-devkit/architect');

async function* customBuilder(options, context) {
  const nfOptions = {
    ...options,
    outputPath: options.outputPath ?? `dist/${context.target.project}`,
    rebuildDelay: process.env.CI ? 0 : options.rebuildDelay,
  };

  yield* runBuilder(nfOptions, context);
}

module.exports = createBuilder(customBuilder);
```

`runBuilder` is an async generator yielding `BuilderOutput` values, so `yield*` forwards them unchanged — the dev-server and watch behaviour keep working.

### 2. Wire it in `angular.json`

```json
{
  "projects": {
    "mfe1": {
      "architect": {
        "build": {
          "builder": "./custom-builder",
          "options": {},
          "configurations": {
            "production": { "target": "mfe1:esbuild:production" },
            "development": { "target": "mfe1:esbuild:development", "dev": true }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "./custom-builder",
          "options": {
            "target": "mfe1:serve-original:development",
            "dev": true
          }
        }
      }
    }
  }
}
```

You are swapping the _builder_, not the options schema — every option from [Builder → Options](builder.md#builder-options) still applies, and your wrapper receives them as its first argument.

## Notes

- `runBuilder` lives at an internal path. It is not part of the public API guarantee — a minor bump may move or rename it. Pin the adapter version when you ship a custom builder.
- Your wrapper runs in the Architect process, so it can read the environment and the workspace, but it cannot reach into the federation build itself.
- If you need to change what gets bundled rather than how the builder is invoked, that belongs in `federation.config.js` — see [Angular Config](configuration.md).

## Related

- [Builder](builder.md) — the options the wrapper inherits.
- [Core → Build Adapters](../core/build-adapters.md) — the `BuildAdapter` contract, if you would rather drive the core build yourself with a different bundler.
