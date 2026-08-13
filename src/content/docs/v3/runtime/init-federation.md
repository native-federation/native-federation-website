# `initFederation`

> initFederation — how the host discovers remotes, builds the import map, and handles manifest URLs, deployUrl, cache busting and remote load errors.

`initFederation` is the one call a host needs to make before any remote can be loaded. It fetches the host's own `remoteEntry.json`, fetches every configured remote's `remoteEntry.json` in parallel, merges everything into a single import map and injects it into the DOM.

## Signature

```ts
function initFederation(
  remotesOrManifestUrl?: Record<string, string> | string,
  options?: InitFederationOptions,
): Promise<ImportMap>;

interface InitFederationOptions {
  cacheTag?: string;
  deployUrl?: string;
}
```

The first argument is either an inline `{ remoteName: remoteEntryUrl }` map or a URL string that resolves to such a map (a manifest). It defaults to `{}`, in which case the runtime still loads the host's own `remoteEntry.json` — useful when a project only needs its own shared deps registered (this is the shape a remote uses).

The returned promise resolves to the final merged [`ImportMap`](import-map.md) that was written into the DOM.

## The initialization flow

On every call the runtime does exactly this, in order:

1. If the first argument is a string, fetch it and `JSON.parse` it into a remotes record.
2. Fetch the host's **`remoteEntry.json`** from `deployUrl` (default `./`, i.e. the same origin and directory as the host page).
3. Build the host's import map via `processHostInfo`: every `shared[]` entry becomes a root import keyed by package name, and is registered in the [externals registry](import-map.md#externals).
4. Call `processRemoteInfos`, which kicks off one `fetchAndRegisterRemote` promise per remote, in parallel. Each one:
   - fetches the remote's `remoteEntry.json`;
   - registers the remote in the global registry;
   - adds exposed modules as root imports (`<remoteName>/<exposedKey>`);
   - adds shared deps under a scope keyed by the remote's base URL.
5. Merge the host map and the remotes map into one `ImportMap`.
6. Inject that map as `<script type="importmap-shim">` via `document.head.appendChild`.

The injection goes through a Trusted Types policy called `native-federation` when the browser has Trusted Types enabled, so the runtime plays nicely with strict CSPs. See [The Import Map → Trusted Types](import-map.md#trusted-types).

## Inline remotes

If you know which remotes you need at build time, pass them directly:

```ts
import { initFederation } from '@softarc/native-federation-runtime';

await initFederation({
  mfe1: 'http://localhost:3001/remoteEntry.json',
  mfe2: 'https://cdn.example.com/orders/remoteEntry.json',
});
```

The key is the **remote name** you will pass to `loadRemoteModule`. It does _not_ have to match the `name` field inside the remote's `remoteEntry.json` — the key you supply here wins. If you leave it out (by calling `fetchAndRegisterRemote` yourself without a name) the name falls back to `remoteEntry.name`.

## Manifest URL

Pass a string to defer the remotes map to runtime:

```ts
await initFederation('/assets/federation.manifest.json');
```

The manifest is just JSON mapping remote names to `remoteEntry.json` URLs:

```json
{
  "mfe1": "http://localhost:3001/remoteEntry.json",
  "mfe2": "https://cdn.example.com/orders/remoteEntry.json"
}
```

Ship a different manifest per environment to re-point remotes without rebuilding the host. Relative URLs are resolved by the browser against the page, so `./remoteEntry.json` and absolute URLs both work.

## <a id="deploy-url"></a> Serving the host from elsewhere: `deployUrl`

By default the runtime looks for the host's own `remoteEntry.json` at `./remoteEntry.json` — relative to the page. When the host's build output is served from a different location (a CDN, a sub-path, a separate asset host), point the runtime at it:

```ts
await initFederation(
  { mfe1: 'http://localhost:3001/remoteEntry.json' },
  { deployUrl: 'https://cdn.example.com/shell' },
);
```

A trailing slash is added when missing, so the example above fetches `https://cdn.example.com/shell/remoteEntry.json`. The same value is used as the prefix for the host's shared-dependency URLs in the import map, so it must be the directory the host's bundles are served from.

## <a id="cache-tag"></a> Cache busting with `cacheTag`

If you set `options.cacheTag`, the runtime appends a `t=<cacheTag>` query parameter to every metadata request it makes — the manifest URL, the host `remoteEntry.json`, and every remote `remoteEntry.json`:

```ts
await initFederation('/assets/federation.manifest.json', {
  cacheTag: BUILD_HASH,
});
```

Use a deployment-stable value — a build hash, a git SHA, a CI run ID. It only affects metadata fetches; the actual module bundles are loaded through the import map and have their own hashed filenames.

> **Note:** For remote URLs the runtime picks `?` or `&` depending on whether the URL already has a query string. The manifest URL and the host's `remoteEntry.json` always get `?t=…` appended, so keep those two free of query strings.

## Remote load errors

If a single remote fails to load (network error, 404, invalid JSON), `initFederation` does **not** fail the whole operation. It logs `Error loading remote entry for <name> from file <url>` plus the original error to `console.error` and continues with the remotes that did load. The rationale is that one flaky remote should not bring the host down.

If you need strict behaviour, call `processRemoteInfos` directly with `throwIfRemoteNotFound: true`:

```ts
import { processRemoteInfos } from '@softarc/native-federation-runtime';

await processRemoteInfos(
  { mfe1: 'http://localhost:3001/remoteEntry.json' },
  { throwIfRemoteNotFound: true },
);
```

Note that this only changes behaviour for _remote_ load errors. If the _host's_ own `remoteEntry.json` cannot be fetched or parsed, `initFederation` rejects — no fallback.

Doing it this way means driving the sequence yourself: `processRemoteInfos` returns the remotes' import map but does not merge it with the host's or inject anything. Combine it with [`processHostInfo`](api-reference.md) and `mergeImportMaps` if you need full control over the flow.

## Hot reload watching

If a remote's `remoteEntry.json` contains a `buildNotificationsEndpoint` field, `fetchAndRegisterRemote` opens an `EventSource` on `<remote base URL><endpoint>`. When the dev server emits `{ type: 'federation-rebuild-complete' }`, the runtime logs `[Federation] Rebuild completed, reloading...` and calls `window.location.reload()`. This is how the Angular adapter's `ng serve` integration triggers a reload after a federation rebuild — see [Angular Adapter → Builder](../angular-adapter/builder.md#build-notifications).

In production builds the endpoint is not written to `remoteEntry.json`, so no SSE connection is opened. You do not need to configure anything on the runtime side — it is purely a function of the build output.

## Calling it from a remote

A remote calls `initFederation` too — usually with an empty remotes map:

```ts
// remote src/main.ts
initFederation({})
  .catch(err => console.error(err))
  .then(() => import('./bootstrap'));
```

This loads the remote's own `remoteEntry.json` and registers its shared dependencies at the root of the import map, so the remote's code resolves `@angular/core`, `rxjs` and friends to the bundled versions when running the remote directly. If the remote is only ever loaded through a host, this call can be omitted — the host's `initFederation` will register the remote's shared deps under a scope instead.

## Related

- [`loadRemoteModule`](load-remote-module.md) — the companion call used from routes/components.
- [The Import Map](import-map.md) — what `initFederation` writes to `document.head`.
- [API Reference](api-reference.md) — `fetchAndRegisterRemote`, `processHostInfo` and the lower-level building blocks.
