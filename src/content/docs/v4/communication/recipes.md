# Recipes

> Copy-paste integrations for Angular, React, RxJS and custom elements, plus a `firstValue` helper, request-scoped buses for SSR and test setup.

> [!INFO] **Beta — feedback wanted.** The communication package is in pre-release (`4.0.0-next.1`), and its API may still change before 4.0.0. Tried it? Tell us what works and what doesn't in the [GitHub issues](https://github.com/native-federation/communication/issues).

There are no framework adapters: `on` returns the cleanup function every framework asks for. Copy what
you need.

## Angular

Hand `off` to `DestroyRef`, and seed the signal with `peek` so the first render has the value:

```ts
import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import { bus, type ChannelName, type ChannelValue } from '@softarc/native-federation-communication';

export function channelSignal<K extends ChannelName>(
  channel: K
): Signal<ChannelValue<K> | undefined> {
  const value = signal(bus.peek(channel));
  inject(DestroyRef).onDestroy(bus.on(channel, next => value.set(next)));
  return value.asReadonly();
}
```

A command has nothing to show, so subscribe directly. In `provideAppInitializer` or a root service the
listener lives as long as the app, and a `TestBed` reset removes it:

```ts
provideAppInitializer(() => {
  const router = inject(Router);
  inject(DestroyRef).onDestroy(bus.on('nav:navigate', ({ url }) => router.navigateByUrl(url)));
});
```

## React

For a command, `on` is the effect's cleanup:
`useEffect(() => bus.on('ui:toast', ({ text }) => toast(text)), [])`. For state:

```js
import { useCallback, useSyncExternalStore } from 'react';
import { bus } from '@softarc/native-federation-communication';

/**
 * @template {import('@softarc/native-federation-communication').ChannelName} K
 * @param {K} channel
 * @returns {import('@softarc/native-federation-communication').ChannelValue<K> | undefined}
 */
export function useChannel(channel) {
  const subscribe = useCallback(onChange => bus.on(channel, onChange), [channel]);
  return useSyncExternalStore(
    subscribe,
    () => bus.peek(channel),
    () => undefined
  );
}
```

## RxJS

Each micro frontend bundles its own RxJS, so send plain values over the bus and wrap it with your own:

```js
import { Observable } from 'rxjs';
import { bus } from '@softarc/native-federation-communication';

/**
 * @template {import('@softarc/native-federation-communication').ChannelName} K
 * @param {K} channel
 * @returns {Observable<import('@softarc/native-federation-communication').ChannelValue<K>>}
 */
export const fromChannel = channel =>
  new Observable(subscriber => bus.on(channel, value => subscriber.next(value)));
```

`off` becomes the teardown, and the retained value arrives on subscribe, like a `BehaviorSubject`.

## `firstValue`

For app initializers, guards and top-level `await`: resolves with the retained or the next value, then
unsubscribes. It aborts its own controller, because `off` doesn't exist yet during the first call.

```js
import { bus } from '@softarc/native-federation-communication';

/**
 * @template {import('@softarc/native-federation-communication').ChannelName} K
 * @param {K} channel
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<import('@softarc/native-federation-communication').ChannelValue<K>>}
 */
export function firstValue(channel, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const done = new AbortController();
    const stop = signal ? AbortSignal.any([signal, done.signal]) : done.signal;
    if (stop.aborted) return reject(signal?.reason);
    stop.addEventListener('abort', () => reject(signal?.reason));
    bus.on(channel, value => (resolve(value), done.abort()), { signal: stop });
  });
}
```

```js
const user = await firstValue('shell:user', { signal: AbortSignal.timeout(5000) });
```

Await it only in the browser: on a server it may never settle.

## Custom elements

One `AbortController` per connection removes every subscription at once:

```js
import { bus } from '@softarc/native-federation-communication';

class CartBadge extends HTMLElement {
  #connection;

  connectedCallback() {
    this.#connection = new AbortController();
    const { signal } = this.#connection;
    bus.on('cart:changed', ({ count }) => (this.textContent = String(count)), { signal });
    bus.on('shell:theme', ({ name }) => this.setAttribute('theme', name), { signal });
  }

  disconnectedCallback() {
    this.#connection?.abort();
  }
}

customElements.define('cart-badge', CartBadge);
```

## Server-side rendering

A process-wide bus would show one user's values to the next. Install, once at boot, a bus that forwards
each call to the current request's own bus:

```js
import { AsyncLocalStorage } from 'node:async_hooks';
import { createBus } from '@softarc/native-federation-communication';

const requests = new AsyncLocalStorage();

export function installRequestBus() {
  let warned = false;
  const call = (method, args) => {
    const scoped = requests.getStore();
    if (scoped) return scoped[method](...args);
    // a throwaway bus checks the arguments like any bus and keeps nothing
    const result = createBus()[method](...args);
    if (!warned) console.warn('__NF_BUS__ was used outside a request: the call was ignored.');
    warned = true;
    return result;
  };
  globalThis.__NF_BUS__ = Object.freeze({
    protocol: 1,
    version: createBus().version,
    emit: (...args) => call('emit', args),
    on: (...args) => call('on', args),
    peek: (...args) => call('peek', args),
  });
}

export const withRequestBus = handle => requests.run(createBus(), handle);
```

```js
installRequestBus();
server.on('request', (req, res) => withRequestBus(() => render(req, res)));
```

Every copy uses what is in `__NF_BUS__`, so the host and every remote's server code share the request's
bus, across `await` too. A call outside a request is checked, then dropped with one warning.

## Testing

App code imports `bus`, which reads `globalThis.__NF_BUS__` on every call. Replace it in a setup file;
no DOM environment is needed:

```js
import { createBus } from '@softarc/native-federation-communication';

beforeEach(() => {
  vi.stubGlobal('__NF_BUS__', createBus());
  // a listener that throws, a failed expect included, now fails the emit and so the test
  vi.stubGlobal('reportError', error => {
    throw error;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

A rethrown error also skips that `emit`'s remaining deliveries, which is fine in a test. Without
`vi.stubGlobal`, use
`Object.defineProperty(globalThis, '__NF_BUS__', { value: createBus(), configurable: true })`.
