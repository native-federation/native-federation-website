---
applies_to: [v3, v4]
---

# `loadRemoteModule`

> loadRemoteModule — how to load an exposed module from a registered remote, plus lazy registration and fallback behaviour.

`loadRemoteModule` resolves the URL of a remote's exposed module and performs a dynamic `import()` against the import map that [`initFederation`](init-federation.md) installed. It is the one call you make from router configs, event handlers, or anywhere else you decide a remote is needed.

## Signatures

```ts
function loadRemoteModule<T = any>(
  remoteName: string,
  exposedModule: string,
): Promise<T>;

function loadRemoteModule<T = any>(
  options: LoadRemoteModuleOptions<T>,
): Promise<T>;

interface LoadRemoteModuleOptions<T = any> {
  remoteEntry?: string;  // for lazy registration
  remoteName?: string;
  exposedModule: string;
  fallback?: T;
}
```

The short form is the common case; the object form exists for lazy registration and fallbacks.

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

This is useful for plugin-style systems where the list of remotes is only known after user interaction. The registration happens once per base URL — subsequent calls for the same remote reuse the already-registered entry.

If you supply `remoteEntry` but not `remoteName`, the runtime derives the remote name from the registry lookup by base URL (populated when the remote was registered, using the `name` field from its `remoteEntry.json`). If neither is resolvable, it throws `unexpected arguments: Please pass remoteName or remoteEntry`.

## Fallbacks and error handling

`loadRemoteModule` can fail for three reasons:

1. **Unknown remote** — no remote matching `remoteName` is registered.
2. **Unknown exposed module** — the remote is registered, but does not expose the requested key.
3. **Dynamic import failure** — the URL resolved but the module itself failed to load (network, parse, runtime error).

By default each of those rejects the returned promise. Supply a `fallback` value to return it instead:

```ts
const mod = await loadRemoteModule({
  remoteName: 'mfe1',
  exposedModule: './Component',
  fallback: { AppComponent: DefaultComponent },
});
```

With a fallback, cases (1) and (2) log the error to `console.error` (only in browser environments) and resolve with the fallback. Case (3) logs the error and resolves with the fallback. Without a fallback, cases (1) and (2) throw synchronously-shaped rejections (`unknown remote ...`, `Unknown exposed module ...`) and case (3) rethrows the original import error.

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
- [API Reference](api-reference.md) — the registry helpers (`getRemote`, `hasRemote`, …).
