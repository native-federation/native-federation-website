---
applies_to: [v3, v4]
---

# Custom Builder

> Inject custom esbuild plugins into the Native Federation Angular builder via runBuilder.

Sometimes you need an esbuild plugin in the federation build itself — code transformation, bundling tweaks, third-party tooling. Since v4 the Angular adapter exposes its builder factory as `runBuilder` from `@angular-architects/native-federation-v4/internal`, so you can wrap it in your own Architect builder and pass extra plugins through.

## The Pattern

1. Write a tiny builder file that calls `runBuilder` with an extended options object.
2. Point the relevant `angular.json` targets at your wrapper instead of the default `@angular-architects/native-federation-v4:build`.

### 1. The wrapper

```js
// custom-builder.js
import { runBuilder } from '@angular-architects/native-federation-v4/internal';
import { createBuilder } from '@angular-devkit/architect';
import { myEsbuildPlugin } from './my-esbuild-plugin.js';

async function* customBuilder(options, context) {
  const nfOptions = {
    ...options,
    plugins: [
      myEsbuildPlugin(),
      // ...more plugins
    ],
  };

  yield* runBuilder(nfOptions, context);
}

export default createBuilder(customBuilder);
```

The `plugins` array is appended to the adapter's own externals plugin, so the order is: externals plugin first, then yours. Plugins receive the standard esbuild `PluginBuild` interface and run for both the federation build (shared bundles, exposed modules) and the Angular build path.

### 2. Wire it in `angular.json`

```json
{
  "projects": {
    "mfe1": {
      "architect": {
        "build": {
          "builder": "./custom-builder",
          "options": {
            "projectName": "mfe1",
            "tsConfig": "projects/mfe1/tsconfig.federation.json"
            // ... everything you'd normally pass to the federation builder
          }
        },
        "serve": {
          "builder": "./custom-builder",
          "options": { /* same idea */ }
        }
      }
    }
  }
}
```

You're swapping the _builder_, not the options schema — every option from [Builder → Options](builder.md#builder-options) still applies.

## Notes

- `runBuilder` is exposed from `@angular-architects/native-federation-v4/internal`. As the name suggests, it's not part of the public API guarantee — minor bumps may rename or refine the signature. Pin the adapter version when you ship a custom builder.
- Plugins added this way only run inside the build the adapter drives. They do _not_ see Angular CLI's pipeline outside the federation flow.
- If you only need a config tweak rather than a plugin (e.g. forcing externals, changing output paths), prefer the existing [builder options](builder.md#builder-options) or a `federation.config.mjs` change.

## Related

- [Builder](builder.md) — the options the wrapper inherits.
- [Core: Build Adapters](../core/build-adapters.md) — the contract under the hood (`NFBuildAdapter`) if you'd rather plug a different bundler in entirely.
