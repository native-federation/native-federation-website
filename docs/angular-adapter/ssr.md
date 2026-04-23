---
applies_to: [v3]
---

# SSR & Hydration

> Angular SSR and Incremental Hydration with Native Federation — Node bootstrap, the fstart helper, externals, and CORS.

The Angular adapter supports Angular SSR and Incremental Hydration as of Angular 18 — both for hosts and remotes. Most of the wiring is done by the `init` schematic when it detects an SSR-enabled project; this page documents what it generates and the moving parts behind it.

**On this page**

- [Enabling SSR](#enabling-ssr)
- [The Node bootstrap](#the-node-bootstrap)
- [fstart.mjs](#fstartmjs)
- [Externals on the server](#externals-on-the-server)
- [Manifests & CORS](#manifests--cors)

## Enabling SSR

Add SSR to your Angular project the usual way:

```bash
ng add @angular/ssr --project shell
```

Then run the federation init (or re-run it). When the schematic sees `build.options.ssr.entry` it adds two SSR-specific things:

1. Sets `ssr: true` on the federation `build` target. The builder uses this flag to route externals through Angular's `externalDependencies` instead of an esbuild plugin (the SSR build path doesn't run that plugin).
2. Splits `main.server.ts` into a federation bootstrap (`main.server.ts`) plus the original Angular SSR bootstrap (`bootstrap-server.ts`).

## The Node Bootstrap

The schematic generates a `main.server.ts` that calls `initNodeFederation` from `@softarc/native-federation-node` before pulling in the Angular SSR app:

```ts
// projects/shell/src/main.server.ts (dynamic-host)
import { initNodeFederation } from '@softarc/native-federation-node';

console.log('Starting SSR for Shell');

(async () => {
  await initNodeFederation({
    remotesOrManifestUrl: '../browser/federation.manifest.json',
    relBundlePath: '../browser/',
  });

  await import('./bootstrap-server');
})();
```

For static hosts the manifest is inlined; for remotes only the `relBundlePath` is set:

```ts
// remote variant
import { initNodeFederation } from '@softarc/native-federation-node';

(async () => {
  await initNodeFederation({ relBundlePath: '../browser/' });
  await import('./bootstrap-server');
})();
```

Your existing SSR setup — Express, prerender, Vite middleware, anything `ng add @angular/ssr` generated — moves to `bootstrap-server.ts` unchanged. The schematic also rewrites the Express setup to:

- Drop the `isMainModule` guard (the federation bootstrap now controls execution).
- Enable CORS on the Express app (federated remotes load across origins).
- Apply the `--port` argument as the default SSR port.

## fstart.mjs

For SSR builds the federation builder writes a tiny `fstart.mjs` next to the server output (`dist/<project>/server/fstart.mjs`). It's a small Node bootstrap that ensures the federation runtime starts before Angular's server entry, mirroring the `main.ts` → `bootstrap.ts` split on the browser side. You don't need to invoke it directly — point your runtime at it the same way you'd point at `server.mjs`.

## Externals on the Server

On the browser side, externals are excluded from the Angular bundle by an esbuild plugin the adapter installs. That plugin is bypassed for SSR builds, so the adapter instead sets `options.externalDependencies = externals` on the underlying Angular target. The result is the same — Angular doesn't pre-bundle anything Native Federation will load at runtime — but uses Angular's first-class hook.

One important consequence: `@angular/core` infers `ngServerMode` from the bundling step. Because Native Federation reuses the _same_ shared `@angular/core` bundle on the server and in the browser, the adapter patches `node_modules/@angular/core/fesm2022/core.mjs` with a small runtime check:

```js
if (typeof globalThis.ngServerMode === 'undefined')
  globalThis.ngServerMode = (typeof window === 'undefined') ? true : false;
```

The patch is applied automatically by the adapter on every build. Treat it as an implementation detail.

## Manifests & CORS

- **Same manifest, both worlds.** Use the same `federation.manifest.json` for browser and Node. The schematic points the Node bootstrap at `../browser/federation.manifest.json` so they stay in sync.
- **Production URLs.** If your remotes are deployed across origins, list absolute URLs in the manifest. The Node side will fetch `remoteEntry.json` from those URLs; make sure they're reachable from your SSR runtime.
- **CORS.** The schematic enables `cors` on the generated Express app so cross-origin requests don't bounce. Adjust the policy in `bootstrap-server.ts` if you need stricter rules.
- **I18N.** When SSR runs alongside multiple locales, the dev server only serves _one_ locale at a time (Angular's limitation). Production builds emit one folder per locale; route accordingly. See [I18N](i18n.md).

## Related

- [Runtime overview](../runtime/index.md).
- [SSR & Hydration with Native Federation for Angular](https://www.angulararchitects.io/blog/ssr-and-hydration-with-native-federation-for-angular/) — the long-form article behind these features.
