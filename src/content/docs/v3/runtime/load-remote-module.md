# `loadRemoteModule`

> loadRemoteModule — how to load an exposed module from a registered remote, plus lazy registration and fallback behaviour.

`loadRemoteModule` resolves the URL of a remote's exposed module and performs a dynamic `import()` against the import map that [`initFederation`](init-federation.md) installed. It is the one call you make from router configs, event handlers, or anywhere else you decide a remote is needed.

## Signatures

```ts
function loadRemoteModule<T = any>(
  options: LoadRemoteModuleOptions<T>,
): Promise<T>;

function loadRemoteModule<T = any>(
  remoteName: string,
  exposedModule: string,
): Promise<T>;

type LoadRemoteModuleOptions<T = any> = {
  remoteEntry?: string;  // for lazy registration
  remoteName?: string;
  exposedModule: string;
  fallback?: T;
};
```

The positional form is the common case; the object form exists for lazy registration and fallbacks. Mixing them — a string first argument without a second, or an options object plus a second argument — throws `unexpected arguments: please pass options or a remoteName/exposedModule-pair`.

## Short form — positional

```ts
const { AppComponent } = await loadRemoteModule('mfe1', './Component');
```

The first argument matches the key you used in `initFederation`'s remotes map (or the remote's `name` field when no key was supplied). The second argument matches the key under `exposes` in the remote's `federation.config.js` — typically `./Component`, `./Routes`, etc.

## Long form — options object

```ts
const { AppComponent } = await loadRemoteModule({
  remoteName: 'mfe1',
  exposedModule: './Component',
});
```

Equivalent to the short form when only `remoteName` and `exposedModule` are set — use it when you also need `remoteEntry` or `fallback`.

## Lazy remote registration

If you want to load a remote that was _not_ in the `initFederation` manifest, pass its `remoteEntry` URL. The runtime will fetch it, register it into the global registry, append its import map to the DOM, and then import the exposed module:

```ts
const mod = await loadRemoteModule({
  remoteEntry: 'http://localhost:3003/remoteEntry.json',
  remoteName: 'mfe3',
  exposedModule: './Component',
});
```

This is useful for plugin-style systems where the list of remotes is only known after user interaction. The registration happens once per base URL — subsequent calls for the same remote skip the fetch and reuse the already-registered entry.

If you supply `remoteEntry` but not `remoteName`, the runtime derives the remote name from the registry lookup by base URL (populated during registration, using the `name` field from the remote's `remoteEntry.json`). If neither is supplied it throws `unexpected arguments: Please pass remoteName or remoteEntry`; if the lookup comes back empty it throws `unknown remoteName undefined`. Neither of those is covered by `fallback` — they are thrown while the arguments are still being resolved.

## Fallbacks and error handling

`loadRemoteModule` can fail for three reasons, and `fallback` only covers the first two:

| Failure | Without `fallback` | With `fallback` |
| --- | --- | --- |
| **Unknown remote** — nothing registered under `remoteName` | throws `unknown remote <name>` | logs the message, resolves with the fallback |
| **Unknown exposed module** — the remote is registered but does not expose that key | throws `Unknown exposed module <key> in remote <name>` | logs the message, resolves with the fallback |
| **Dynamic import failure** — the URL resolved but the module failed to load | rejects with the import error | rejects with the import error |

```ts
const mod = await loadRemoteModule({
  remoteName: 'mfe1',
  exposedModule: './Component',
  fallback: { AppComponent: DefaultComponent },
});
```

> **Warning:** The fallback does not catch a failing `import()`. The runtime returns the import promise rather than awaiting it, so a rejection escapes the fallback handling and surfaces to your `catch`. Wrap the call yourself if a network failure on the module bundle must also degrade gracefully.

The two messages that a fallback does absorb are logged through `console.error`, but only when `window` is defined — so they stay quiet in Node-based test and SSR contexts.

> **Note:** Fallbacks shine for non-critical widgets (recommendations panel, feature flag, A/B variant) where a missing remote should degrade gracefully. For main navigation or a route that has no sensible fallback, let it throw and handle it at your router's error boundary.

## importShim vs. native import

Under the hood the runtime prefers `globalThis.importShim()` — the hook installed by `es-module-shims` — and falls back to a native dynamic `import()` when the shim is not present:

```ts
function _import<T>(moduleUrl: string) {
  return typeof importShim !== 'undefined'
    ? importShim<T>(moduleUrl)
    : import(/* @vite-ignore */ moduleUrl) as T;
}
```

In practice `es-module-shims` must be on the page — the import map is injected as `type="importmap-shim"`, which native browsers ignore. The native fallback exists mainly for test environments and server contexts.

## Typing the result

`loadRemoteModule` returns `Promise<any>` by default. When the shape of the module is known ahead of time, parameterize the call:

```ts
interface RemoteComponent {
  AppComponent: unknown;
}

const mod = await loadRemoteModule<RemoteComponent>('mfe1', './Component');
mod.AppComponent;  // typed
```

There is no ambient contract between host and remote — you are responsible for keeping the type you assert here in sync with what the remote actually exposes. Framework adapters (for example the Angular router's `loadComponent`) narrow the type further for you.

## Related

- [`initFederation`](init-federation.md) — populates the registry that `loadRemoteModule` reads from.
- [The Import Map](import-map.md) — how the URL is actually resolved.
- [API Reference](api-reference.md) — the full export list and the global registry it reads from.
