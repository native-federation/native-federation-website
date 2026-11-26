# Recipes

> Copy-paste integrations for any framework, custom elements, React and RxJS, plus `firstValue` and `values` helpers, request-scoped buses for SSR, a React Native ↔ WebView bridge and test setup.

The package ships no framework adapters: `on` returns `off`, which is the cleanup function every framework asks for. Copy the recipe you need into your app. Every snippet uses the installed bus through `bus`, so the host must have [installed it](getting-started.md#install).

## In a component

Hand `off` over where the component is destroyed, and follow the channel's kind (see [Commands](getting-started.md#commands)):

- **State**: seed with `peek`, so the first render has the retained value, then subscribe with replay on. The replay also delivers a value emitted in between; getting the current value twice is harmless.
- **A command**: subscribe with `{ replay: false }`, so a remount, or React's StrictMode, doesn't rerun an old command.

| Framework | State in a component                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Angular   | `const user = signal(bus.peek('shell:user'));` `inject(DestroyRef).onDestroy(bus.on('shell:user', u => user.set(u)));`                   |
| Lit       | `this.#off = bus.on('shell:user', u => (this.user = u));` after `super.connectedCallback()`, and `this.#off()` in `disconnectedCallback` |
| React     | [`useChannel`](#react)                                                                                                                   |
| Solid     | `const user = from(set => bus.on('shell:user', u => set(() => u)));` (a setter calls a function value)                                   |
| Svelte    | `const user = readable(bus.peek('shell:user'), set => bus.on('shell:user', set));` with runes, `fromStore(user)`                         |
| Vanilla   | the [custom element](#custom-elements) recipe: one `AbortController` per connection                                                      |
| Vue       | `const user = shallowRef(bus.peek('shell:user'));` `onScopeDispose(bus.on('shell:user', u => (user.value = u)));`                        |

## Custom elements

One `AbortController` per `connectedCallback` removes every subscription of the element at once:

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

## React

`useSyncExternalStore` takes `on` as its `subscribe` and `peek` as its snapshot. For a command, `on` is the effect's cleanup: `useEffect(() => bus.on('ui:toast', ({ text }) => toast(text), { replay: false }), [])`. For state:

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

Each micro frontend bundles its own RxJS, so send plain values over the bus, not observables, and wrap the bus with your own RxJS:

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

`off` becomes the teardown, and a subscriber gets the retained value on subscribe, like a `BehaviorSubject`.

## `firstValue`

For app initializers, guards and top-level `await`: `firstValue` resolves with the retained value, or else the next one, then unsubscribes. It unsubscribes by aborting its own controller, because `off` doesn't exist yet while the retained value is delivered.

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

Await it only in the browser. Where the bus is inert, as on a server outside a request, `on` drops the listener, so the promise settles only when its `signal` aborts.

## `values`

For code that handles each value in turn, with an `await` in between: `values` is an async iterator over a channel. It subscribes when called and keeps every value until the loop takes it. When its `signal` aborts or the loop breaks, the loop ends quietly and drops the values it hasn't taken.

```js
import { bus } from '@softarc/native-federation-communication';

/**
 * @template {import('@softarc/native-federation-communication').ChannelName} K
 * @param {K} channel
 * @param {{ signal?: AbortSignal, replay?: boolean }} [options]
 * @returns {AsyncIterableIterator<import('@softarc/native-federation-communication').ChannelValue<K>>}
 */
export function values(channel, { signal, replay } = {}) {
  const queue = [];
  let wake = () => {};
  const done = new AbortController();
  const stop = signal ? AbortSignal.any([signal, done.signal]) : done.signal;
  const end = () => (done.abort(), { done: true, value: undefined });
  stop.addEventListener('abort', () => wake());
  bus.on(channel, value => (queue.push(value), wake()), { signal: stop, replay });
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      while (!queue.length && !stop.aborted) await new Promise(resolve => (wake = resolve));
      return stop.aborted ? end() : { done: false, value: queue.shift() };
    },
    async return() {
      return end();
    },
  };
}
```

```js
for await (const job of values('export:requested', { signal, replay: false })) await runExport(job);
```

- To render state, use [In a component](#in-a-component): a loop gets even the retained value a microtask later, after the first render.
- One loop per call. Unlike Node's `events.on`, aborting ends the loop instead of throwing.
- Where the bus is inert, as on a server outside a request, the loop waits until its `signal` aborts, as `firstValue` does.

## Server-side rendering

Never import `/install` in server code: one bus for the whole process would show one user's retained values to the next. Import it only in the browser or React Native entry. Without an installed bus, server code gets the [inert bus](api.md#without-an-installed-bus), which drops every call and warns once per copy. To give each request its own bus, install, once at boot, a [`busFrom`](api.md#bus-from) bus that looks up the current request's bus on every call:

```js
import { AsyncLocalStorage } from 'node:async_hooks';
import { busFrom, createBus, installGlobalBus } from '@softarc/native-federation-communication/setup';

const requests = new AsyncLocalStorage();

export function installRequestBus() {
  const requestBus = busFrom(() => requests.getStore());
  // a bus installed earlier would be shared by every request, so refuse to run on top of it
  if (installGlobalBus(requestBus) !== requestBus)
    throw new Error('__NF_BUS__ already holds another bus.');
}

export const withRequestBus = handle => requests.run(createBus(), handle);
```

```js
installRequestBus();
server.on('request', (req, res) => withRequestBus(() => render(req, res)));
```

- `installRequestBus` throws when another bus was installed first, since every request would share that one.
- Every copy uses what is in `__NF_BUS__`, so the host's and every remote's server code use the current request's bus, across `await` too.
- Outside a request the store is empty, so a call goes to the inert bus: its arguments are checked, then it is dropped with the warning.
- With a browser and a server entry, keep the `/install` import in the browser entry (in a federated host, its `bootstrap.ts`), and call `installRequestBus()` from the server entry.

## React Native and WebView

React Native has a bus of its own, and so has each page in a `react-native-webview`. Bridge them with [`connectTransport`](api.md#connect-transport) and one [transport](api.md#transports) per side. Each side installs its bus once, first thing in its entry (the app's `index.js`; in a federated page, the module `initFederation` loads), with `import '@softarc/native-federation-communication/install';`, and imports `bus` and `connectTransport` from the main entry. `/transport/broadcast-channel` isn't needed, and Metro resolves the package's `exports` by default from React Native 0.79.

**The page** sends with `window.ReactNativeWebView.postMessage`, which exists once the app's `WebView` has an `onMessage` prop, and receives through a global function of its own that the app calls. `connectTransport` calls `listen` once it has connected, so `listen` is where the page tells the app it is ready, with a message that is not an envelope:

```js
import { connectTransport } from '@softarc/native-federation-communication';

const app = {
  name: 'react-native',
  send: envelope => window.ReactNativeWebView?.postMessage(JSON.stringify(envelope)),
  listen: receive => {
    window.__SHOP_FROM_APP__ = json => receive(JSON.parse(json));
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'webview-ready' }));
    return () => delete window.__SHOP_FROM_APP__;
  },
};

connectTransport(app, ['cart:changed', 'auth:user']);
```

**The app** sends by injecting a call to that global, with the JSON encoded twice so it is a string literal, and receives the page's messages in `onMessage`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import { connectTransport } from '@softarc/native-federation-communication';

function webViewTransport(name, webView, onReady) {
  let receive = () => {};
  return {
    name,
    send: envelope => {
      const json = JSON.stringify(JSON.stringify(envelope));
      webView.current?.injectJavaScript(`window.__SHOP_FROM_APP__?.(${json}); true;`);
    },
    listen: next => {
      receive = next;
      return () => (receive = () => {});
    },
    onMessage: ({ nativeEvent: { data } }) => {
      const message = parse(data);
      if (message?.type === 'webview-ready') onReady();
      else receive(message);
    },
  };
}

// Other libraries post on the same channel; connectTransport ignores what is not an envelope.
function parse(data) {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export function Shop() {
  const webView = useRef(null);
  const connection = useRef(null);
  const [transport] = useState(() =>
    webViewTransport('webview:shop', webView, () => connection.current?.replay())
  );

  useEffect(() => {
    connection.current = connectTransport(transport, ['cart:changed', 'auth:user']);
    return () => connection.current?.close();
  }, [transport]);

  return (
    <WebView
      ref={webView}
      source={{ uri: 'https://shop.example.com' }}
      onMessage={transport.onMessage}
    />
  );
}
```

- Values cross as JSON: functions and `undefined` fields are dropped, a `Date` arrives as a string.
- A loaded or reloaded page starts empty, so the app sends its retained values with `replay()` when the page posts `{ type: 'webview-ready' }`. Not on `onLoadEnd`: a federated page often connects after its load event.
- Give each `WebView` its own transport name, since a bus connects a name once.
- The injected script ends with `true;`, as react-native-webview asks.

## Testing

App code imports `bus`, which reads `globalThis.__NF_BUS__` on every call. So a test setup file puts a fresh bus from `createBus()` there before each test; no DOM environment is needed:

```js
import { createBus } from '@softarc/native-federation-communication/setup';

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

A rethrown error also skips the remaining deliveries of that `emit`, which is fine in a test. Without `vi.stubGlobal`, use `Object.defineProperty(globalThis, '__NF_BUS__', { value: createBus(), configurable: true })`: a plain assignment throws once `/install` or `installGlobalBus` has filled the slot. Code that takes the bus as a parameter needs no global: pass it a `createBus()` of its own.
