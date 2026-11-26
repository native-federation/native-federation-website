# API

> The complete reference: the entry points, every member of the bus, `connectTransport` and transports, the setup functions, the delivery rules, and every error and warning.

For a first read, start with [Getting Started](getting-started.md).

## Terms

- **Bus**: an object with `emit`, `on`, `peek` and `tap`. The **installed bus** is the one at `globalThis.__NF_BUS__`, which every copy of the package on the page uses.
- **Channel**: a string name, such as `'cart:changed'`. It exists from its first use.
- **Retained value**: the last value a channel keeps, so that `on` can replay it and `peek` can return it. At most one per channel.
- **Command**: a value emitted with `{ retain: false }`, for the current listeners only.
- **Listener**: a function subscribed to one channel with `on`.
- **Tap**: a named listener for every channel of a bus, opened with `bus.tap`. Bridges are built on it.
- **Envelope**: what a tap receives and a transport carries: `{ channel, value, retain }`.
- **Transport**: an object with `name`, `send` and `listen` that carries envelopes to a bus on the other side: another tab, a WebView, a native app.
- **Connection**: what `connectTransport` returns while a transport is bridged to a bus.

## Entry points

Every subpath is under `@softarc/native-federation-communication`:

| Import                         | Exports                                    | Who imports it                                         |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------ |
| the package                    | `bus`, `connectTransport`, every type      | The host and every remote                              |
| `/install`                     | nothing: importing it installs a bus       | The host, once                                         |
| `/setup`                       | `createBus`, `busFrom`, `installGlobalBus` | [Custom installs](#setup-functions), servers, tests    |
| `/transport/broadcast-channel` | `broadcastChannelTransport`                | [Cross-tab](cross-tab.md)                              |
| `/install.js`                  | a classic script that installs a bus       | The [script tag](getting-started.md#with-a-script-tag) |

```js
import { bus, connectTransport } from '@softarc/native-federation-communication';
```

`bus` serves the installed bus: it reads `globalThis.__NF_BUS__` on every call, so every copy of the package uses the same bus, whichever copy installed it. With nothing installed, `bus` is [inert](#without-an-installed-bus).

Types without runtime code come from the package itself: `import type { Bus, Envelope } from '@softarc/native-federation-communication'`.

## The bus

`bus` and every bus from `createBus()` have this shape. The methods never use `this`, so `const { emit } = bus` works.

```ts
type Bus = {
  readonly protocol: number; // the contract between copies: 1
  readonly version: string; // the package version of the copy that created the bus
  emit(channel: string, value: unknown, options?: { retain?: boolean }): void;
  on(
    channel: string,
    listener: (value: unknown) => void,
    options?: { signal?: AbortSignal; replay?: boolean }
  ): () => void;
  peek(channel: string): unknown;
  tap?(name: string, listener: TapListener): Tap | undefined; // see tap below
};
```

A value can be anything, functions included. `Bus` is the typed view (see [Typing](typing.md)); `NativeFederationBus` is the untyped shape declared for `__NF_BUS__`. Write code against `Bus`.

**Options.** A missing or `undefined` option means its default (`true`). Any other value is read as a boolean, so `{ retain: 0 }` means `{ retain: false }` and `{ retain: 'false' }` retains. Unknown options are ignored. The one exception is `connectTransport`'s `{ bus: undefined }`, which is [refused](#a-refused-connection) instead of meaning the installed bus.

**Errors.** Every method throws a `TypeError` when `channel` is not a string, and `on` throws one when `listener` is not a function. The message names what was expected and what it got:

```text
[native-federation-communication] A channel must be a string, got number.
[native-federation-communication] A listener must be a function, got undefined.
```

`on` also throws when `signal` is not an `AbortSignal`, such as an `AbortController` passed instead of its `signal`. That `TypeError` comes from the runtime (`addEventListener` is not a function), and no listener is subscribed.

## <a id="emit"></a> `emit(channel, value, options?)`

Delivers `value` to the channel's listeners and makes it the channel's retained value.

```js
bus.emit('cart:changed', { count: 3 });
bus.peek('cart:changed'); // { count: 3 }

bus.emit('ui:toast', { text: 'Saved' }, { retain: false });
bus.peek('ui:toast'); // undefined
```

With `{ retain: false }` the value is a command: only the listeners subscribed at this moment get it, and the channel's retained value is cleared, so a later `on` replays nothing and `peek` returns `undefined`. `emit` returns nothing.

## <a id="on"></a> `on(channel, listener, options?)`

Subscribes `listener` to `channel` and returns `off`, which unsubscribes it. Calling `off` twice is safe.

```js
bus.emit('cart:changed', { count: 3 });

const off = bus.on('cart:changed', cart => console.log(cart)); // logs { count: 3 } before on returns
bus.emit('cart:changed', { count: 4 }); // logs { count: 4 }
off();
bus.emit('cart:changed', { count: 5 }); // logs nothing
```

- **Replay.** If the channel has a retained value, `listener` gets it before `on` returns, then every later value. Replay is one value, the last retained one, not a buffer like RxJS's `ReplaySubject`.
- **`{ replay: false }`** skips the retained value: `listener` gets only later emits.
- **`{ signal }`** unsubscribes `listener` when the signal aborts. With a signal that is already aborted, `on` subscribes nothing and returns an `off` that does nothing.

```js
const controller = new AbortController();
bus.on('cart:changed', render, { signal: controller.signal, replay: false });
controller.abort(); // same as calling off
```

## <a id="peek"></a> `peek(channel)`

Returns the channel's retained value, or `undefined` if there is none. A retained `undefined` looks the same as none.

## <a id="tap"></a> `tap(name, listener)`

Opens a tap: `listener` receives an envelope for every emit on every channel of this bus. To bridge channels to another bus, use [`connectTransport`](#connect-transport), which opens a tap for you.

```ts
type Envelope = { channel: string; value: unknown; retain: boolean };
type TapListener = (envelope: Envelope) => void;
type Tap = {
  emit(channel: string, value: unknown, options?: { retain?: boolean }): void;
  replay(): void;
  close(): void;
};
```

```js
const tap = bus.tap?.('logger', ({ channel, value, retain }) =>
  console.log(channel, value, retain)
);
bus.emit('cart:changed', { count: 3 }); // logs cart:changed { count: 3 } true
tap?.close();
```

- **Call it as `bus.tap?.(…)`.** `tap` is optional on the type, and stays optional: members added after protocol 1 are optional, and an [inert bus](#without-an-installed-bus) has no `tap`.
- **Names are unique per bus.** `tap` returns `undefined` while a tap or connection with that `name` is open on this bus. It throws a `TypeError` when `name` is not a string (`A tap name must be a string, got …`) or `listener` is not a function (`A tap listener must be a function, got …`).
- **Order.** The tap listener runs after the emit's listeners, so it sees values in the order they do, with the emit's `retain`. A tap listener that throws is [reported](#delivery-rules) like a listener that throws.
- **`tap.emit`** is `bus.emit`, except that this tap's own listener doesn't receive it. Every other listener and tap does.
- **`tap.replay()`** calls this tap's listener once for each channel with a retained value, with `retain: true`. A retained `undefined` is included.
- **`tap.close()`** removes the tap and frees its name. Afterwards `tap.emit` and `tap.replay` do nothing. Calling it twice is safe.

## <a id="connect-transport"></a> `connectTransport(transport, channels, options?)`

Bridges the listed channels of a bus to a bus on the other side of a transport. Returns a connection, or `undefined` when [refused](#a-refused-connection).

```js
import { connectTransport } from '@softarc/native-federation-communication';

const connection = connectTransport(transport, ['cart:changed', 'auth:user']);
connection?.replay(); // send this side's retained values, e.g. when the other side (re)loads
connection?.close(); // stop both directions; safe to call twice
```

- **Outgoing.** From the moment it connects, every emit on a listed channel is passed to `transport.send` as an envelope, with its `retain`. Values retained before that are not sent until you call `replay()`.
- **Incoming.** Every envelope that `transport.listen` receives for a listed channel is emitted on this side, with its `retain`, and not sent back. Envelopes for other channels, and messages that are not envelopes, are ignored.
- **`{ bus }`** connects that bus, such as one from `createBus()` or [`busFrom`](#bus-from), instead of the installed bus. An explicit `{ bus: undefined }`, such as an iframe's empty slot, is refused; it never falls back to the installed bus.
- **`replay()`** sends this side's retained values of the listed channels, one per channel, with `retain: true`, so they overwrite the other side's. It doesn't request the other side's values.
- **`close()`** closes the tap, frees the name and calls the cleanup that `listen` returned.

`connectTransport` takes these steps, in order:

1. A `transport.name` that is not a string throws `A transport name must be a string, got …`; a channel that is not a string throws `A channel must be a string, got …`. Both are `TypeError`s.
2. Without a bus with `tap`, or with the name already taken, it warns and returns `undefined`: see [A refused connection](#a-refused-connection).
3. It calls `transport.listen` once. If that throws, including when `listen` is not a function, it closes the tap, which frees the name, and rethrows.

A `send` that throws, or that is not a function, is [reported](#delivery-rules) on each emit on a listed channel, like a listener that throws. The local listeners have the value already.

### A refused connection

A refused `connectTransport` connects nothing, returns `undefined` and warns with `transport.name` and the cause:

```text
[native-federation-communication] Transport 'broadcast:native-federation-communication/1' is not connected: no bus is installed.
```

| Cause                                                         | What to do                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `no bus is installed`                                         | Install the bus in the host before connecting                                         |
| `the installed bus has no tap (an older copy installed it)`   | Upgrade the host's copy to 4.0.0 or later                                             |
| `options.bus is undefined`                                    | Pass a bus, or wait until the bus you meant to pass exists                            |
| `options.bus has no tap`                                      | Pass a bus from `createBus()`, or a `busFrom` bus whose getter returns one with `tap` |
| `the name is already taken on this bus by a tap or transport` | Close the other connection, or give this transport its own `name`                     |

### Transports

A transport carries envelopes between this side and the other. [`broadcastChannelTransport`](cross-tab.md) is built in; [React Native and WebView](recipes.md#react-native-and-webview) shows one you write yourself.

```ts
type Transport = {
  readonly name: string;
  send(envelope: Envelope): void;
  listen(receive: (envelope: Envelope) => void): () => void; // returns the cleanup
};
```

`Transport`, `Envelope`, `Connection` and `ConnectTransportOptions` are exported types. A transport follows six rules:

- **`send` never delivers to its own side.** An echo would reach this side's listeners twice.
- **Values must survive the encoding.** JSON drops functions and `undefined` fields; structured clone turns class instances into plain objects and rejects functions.
- **`name` is the tap name, and taps and transports share one set of names per bus.** Use `kind:id` names like `broadcast:<wire>` or `webview:shop`. A second `connectTransport` with a name that is taken is refused, so two copies of the same transport never bridge twice.
- **`listen` subscribes and returns the cleanup.** If it throws, `connectTransport` closes the tap and rethrows.
- **`send` is fire-and-forget.** A synchronous throw is reported; an async `send` catches its own rejections, since nobody awaits it.
- **Connections form a tree.** A value received over one connection is sent on by the bus's other connections, so one bus can join tabs and a WebView. A cycle sends values around forever.

A received envelope's `retain` follows the [option rules](#the-bus): a missing `retain` retains.

## Setup functions

`/setup` exports three functions for installing or reaching a bus yourself: servers, tests, iframes, DI containers.

```js
import {
  busFrom,
  createBus,
  installGlobalBus,
} from '@softarc/native-federation-communication/setup';
```

- **`createBus()`** returns a new, empty bus that is installed nowhere: to install yourself, to pass to code that takes the bus as a parameter, or for tests.
- **`installGlobalBus(instance)`** installs `instance` at `globalThis.__NF_BUS__` if the slot is empty, and returns the installed bus. The first install wins: it never replaces a bus that others use. `/install` and `install.js` run `installGlobalBus(createBus())`.

  ```js
  const mine = createBus();
  if (installGlobalBus(mine) !== mine) console.warn('another bus was installed first');
  ```

  The slot it creates is read-only: assigning `globalThis.__NF_BUS__ = …` afterwards throws in strict mode and does nothing otherwise.

To read the installed bus with its types, use `busFrom(() => globalThis.__NF_BUS__)`, which is what `bus` is.

### <a id="bus-from"></a> `busFrom(getBus)`

Returns a frozen bus that calls `getBus()` on every call and forwards to the bus it returns, or to the [inert bus](#without-an-installed-bus) when it returns `undefined`. `protocol`, `version` and `tap` are looked up the same way, so the result has `tap` only while the bus behind it has one. `bus` itself is `busFrom(() => globalThis.__NF_BUS__)`. A `getBus` that is not a function throws at once (`busFrom's getBus must be a function, got …`).

Use it for a bus kept anywhere else, such as in an iframe or a DI container:

```js
const frameBus = busFrom(() => iframe.contentWindow?.__NF_BUS__);
frameBus.emit('cart:changed', { count: 3 }); // dropped, with the warning, until the iframe has a bus

const scopedBus = busFrom(() => container.resolve('bus')); // whatever the container holds now
```

Pass such a bus to `connectTransport` as `{ bus }`. While the iframe has no bus, the connection is refused with `options.bus has no tap`; connect once it has one:

```js
const connection = connectTransport(transport, ['cart:changed'], { bus: frameBus });
```

> [!WARNING] **Install a bus from `createBus()`, never `bus` or another `busFrom` bus that reads `__NF_BUS__`.** Such a bus would resolve to itself, and every call on it, from every copy of the package, throws a `TypeError`:
>
> ```text
> [native-federation-communication] This busFrom bus resolves to itself, e.g. the package's `bus` was given to installGlobalBus. Install a bus from createBus() instead.
> ```
>
> A `busFrom` bus whose getter reads something else, such as the [request bus for SSR](recipes.md#server-side-rendering), is fine to install.

## Without an installed bus

Until a bus is installed, `bus` is **inert**, and so is a `busFrom` bus while its getter returns `undefined`. The inert bus:

- checks `channel` on every method and `listener` on `on`, and throws the same `TypeError`s as a real bus; it doesn't check `signal` or other options;
- then drops the call: `emit` delivers nothing, `on` returns an `off` that does nothing, `peek` returns `undefined`, and `tap` is `undefined`;
- warns on the first dropped call, once per copy of the package, naming that call:

```text
[native-federation-communication] No bus is available here, so emit('cart:changed') and every later call until one is installed are dropped; listeners added now are lost. The host installs a bus with '@softarc/native-federation-communication/install'.
```

The method in the warning is `emit`, `on` or `peek`. Once a bus is installed, the next call goes to it. Listeners added to the inert bus are not moved over and never run. The fix is in the host: install the bus before any remote code runs. A remote doesn't install a bus of its own.

## Delivery rules

- **Order.** Every listener sees values in emit order, across channels. A value emitted inside a listener is delivered after the current value has reached every listener and tap, so that inner `emit` returns before its own delivery.
- **Who gets it.** The listeners subscribed and the taps open when `emit` was called. One that unsubscribes or closes before its turn is skipped.
- **Isolation.** A listener that throws doesn't stop the producer or the other listeners. The error goes to `reportError` (in a browser, the console shows it as an uncaught error), or to `console.error` where there is no `reportError`.
- **Same reference.** Listeners and `peek` get the producer's object. Nothing is copied or frozen, except values that cross a [transport](#transports).
- **No loop guard.** Two listeners that emit to each other's channels loop forever.

> [!TIP] To debug, run `__NF_BUS__.peek('cart:changed')` or `__NF_BUS__.version` in the browser console.

## Pitfalls

- **Inside the first call, `off` doesn't exist yet**, because the retained value arrives before `on` returns. To stop after one value, abort a `signal`, as [`firstValue`](recipes.md#firstvalue) does. There is no `{ once: true }` option.
- **Unsubscribe when your component goes away.** Otherwise the listener outlives its micro frontend and keeps running.
- **Emit a new object for every change.** A mutated object changes for every listener at once, and signals, stores and React state miss the change, because they compare references.
- **Keep a received value out of deep reactive proxies**, such as Vue's `ref`. A write through the proxy, such as `v-model`, mutates the object every listener and `peek` share, without an emit. Use `shallowRef`, and emit a new object instead.
- **Don't declare or assign `__NF_BUS__` on a page.** A `var __NF_BUS__` in a classic script makes it a plain variable that the next assignment replaces, which gives copies different buses. Install with `installGlobalBus`. Tests replace the bus as in [Testing](recipes.md#testing).
- **Don't delete `__NF_BUS__` on a live page.** Every copy turns inert, and the listeners on the old bus never hear from a new one.
- **Don't generate channel names.** A channel keeps its retained value for the life of the page. Put ids in the value: `bus.emit('order:selected', { id })`, not ``bus.emit(`order:${id}`, …)``.
