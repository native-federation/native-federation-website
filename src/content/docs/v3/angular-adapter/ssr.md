# SSR

> Server-side rendering with the v3 Angular adapter — the ssr builder flag, what the schematic rewrites, and how initNodeFederation resolves shared dependencies in Node.

Native Federation v3 supports server-side rendering through a second package, `@softarc/native-federation-node`. It applies the same import map the browser gets, but as a Node module resolver hook, so a server bundle resolves `@angular/core` to the same file the browser would.

## Enabling SSR

Add SSR to the project the normal Angular way first, then run the adapter's `init` schematic:

```bash
ng add @angular/ssr --project shell
ng g @angular-architects/native-federation:init --project shell --port 4200 --type dynamic-host
```

The schematic detects SSR by looking for an `ssr` option on the project's build target. When it finds one it:

- adds `cors` to `package.json` (the server has to allow the remotes' origins);
- sets `ssr: true` on the federation build target in `angular.json`;
- rewrites the server entry point, moving the original content to `bootstrap-server.ts`.

`@softarc/native-federation-node` is added to `package.json` by the schematic in every case, SSR or not.

## What the schematic writes

The server entry becomes a small launcher that initializes federation before importing the real server:

```ts
// projects/shell/src/server.ts (generated, dynamic-host)
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

For `--type host` the manifest path is replaced by the inlined remote map; for a remote, only `relBundlePath` is passed. The ordering requirement is the same as in the browser: the resolver has to be registered before any module that imports a shared package is evaluated, which is what the dynamic `import('./bootstrap-server')` guarantees.

`bootstrap-server.ts` is the original server file with three edits: `cors` is required through `createRequire` and applied to the Express app, the view engine is set to `html`, and the `isMainModule(import.meta.url)` guard is unwrapped so the server starts on import rather than only when run directly.

## What `initNodeFederation` does

```ts
type InitNodeFederationOptions = {
  remotesOrManifestUrl: Record<string, string> | string;  // default {}
  relBundlePath: string;                                  // default '../browser'
  throwIfRemoteNotFound: boolean;                         // default false
  cacheTag?: string;
};
```

1. Reads the host's `remoteEntry.json` from `<relBundlePath>/remoteEntry.json` **off the file system** — not over HTTP — and turns it into root import-map entries prefixed with `relBundlePath`.
2. Loads the remotes. A string `remotesOrManifestUrl` is read as a local file, not fetched; an object is used as-is. Each remote's `remoteEntry.json` is then fetched over the network exactly as in the browser, so remote origins must be reachable from the server.
3. Merges both maps and writes them to `node.importmap` in the process's working directory.
4. Writes `federation-resolver.mjs` next to it and registers it with `module.register()`.

From that point on, Node resolves bare specifiers through the generated map. The resolver reads `node.importmap` from the working directory; set `IMPORT_MAP_PATH` to point it elsewhere.

> **Warning:** Both files are written relative to `process.cwd()`, not to the server bundle. Start the server from the directory you expect those files to land in, or the resolver will not find its map.

## The `ssr` builder flag

`ssr: true` on the federation build target changes two things:

- The externals are handed to Angular as `externalDependencies` instead of through the esbuild `externals` plugin — the server build fails if they are supplied as plugin options.
- A launcher script, `fstart.mjs`, is written to `dist/<project>/server/`.

The flag is ignored while `dev` is on, so `ng serve` renders without federated SSR; the dev server still serves the browser artifacts as usual.

## `fstart.mjs`

The generated launcher is an alternative to editing the server entry yourself. It calls `initNodeFederation` and then imports your server bundle:

```bash
cd dist/shell/server
node fstart.mjs --entry ./server.mjs --relBundlePath ../browser/ \
                --remotesOrManifestUrl ../browser/federation.manifest.json
```

| Switch | Default |
| --- | --- |
| `--entry` | `./server.mjs` |
| `--relBundlePath` | `../browser/` |
| `--remotesOrManifestUrl` | `../browser/federation.manifest.json`, dropped when the file does not exist |

Unknown switches or stray values print the usage and exit.

## Limits on v3

Remote modules execute on the server through the resolver hook, but everything else about the v3 runtime applies: deduplication is exact-version only, there is no persistent cache, and the manifest is read once at startup. Nothing re-reads it while the server runs, so a redeployed remote needs a server restart.

## Related

- [Builder](builder.md) — where the `ssr` flag lives.
- [Runtime → API Reference](../runtime/api-reference.md) — `processHostInfo`, `processRemoteInfos` and `mergeImportMaps`, which `initNodeFederation` composes.
- [SSR & Hydration](../ssr-hydration.md) — the general picture.
