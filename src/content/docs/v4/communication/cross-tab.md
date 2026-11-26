# Cross-tab

> Share chosen channels between tabs of the same origin: the host connects the built-in `broadcastChannelTransport` to the bus, once.

To share channels between tabs of the same origin, the host connects `broadcastChannelTransport` to the bus, once, listing the channels to share:

```js
import '@softarc/native-federation-communication/install';
import { connectTransport } from '@softarc/native-federation-communication';
import { broadcastChannelTransport } from '@softarc/native-federation-communication/transport/broadcast-channel';

const connection = connectTransport(broadcastChannelTransport(), ['cart:changed', 'auth:user']);
```

An emit on `cart:changed` in one tab is then emitted on `cart:changed` in every other tab that made the same call. Channels you don't list stay in their tab. `broadcastChannelTransport` is a [transport](api.md#transports), and `connectTransport` is described in the [API](api.md#connect-transport).

## Connect once, in the host

- **Connect after the bus is installed**, as above. Without an installed bus, `connectTransport` warns `… is not connected: no bus is installed.` and returns `undefined`.
- **List every channel in this one call.** Every copy's `broadcastChannelTransport()` has the same name, `broadcast:native-federation-communication/1`, and a bus accepts a name once. A second `connectTransport` with it, from the host or a remote, warns `… is not connected: the name is already taken on this bus by a tap or transport.`, returns `undefined`, and bridges none of its channels.
- **After `connection.close()`, nothing is bridged** until the host calls `connectTransport` again.

> [!TIP] Sync source channels, not the channels derived from them. If a listener on `cart:changed` emits `cart:count` and both are listed, every other tab gets `cart:count` twice: once from its own listener and once from the tab that emitted.

## What crosses

```js
// tab A
bus.emit('cart:changed', { count: 3 });
// tab B, one task later: its cart:changed listeners get { count: 3 }, and it is retained there
```

- **Copies, not references.** Values are [structured-cloned](https://developer.mozilla.org/docs/Web/API/Web_Workers_API/Structured_clone_algorithm): the other tab gets a copy, and class instances arrive as plain objects.
- **One task later, in emit order.** The local `emit` still delivers synchronously.
- **`retain` crosses too.** A retained emit is retained in the other tab, a retained `undefined` included, and `{ retain: false }` clears the other tab's retained value.
- **Uncloneable values stay local.** For a value that holds a function or a DOM node, the local listeners get it, the error goes to `reportError` like a listener that throws, and other tabs keep their previous value.

## A new tab starts empty

The transport is live only: a tab that opens gets nothing until the next emit in another tab. Read the initial state from the server or the URL.

`connection?.replay()` sends this tab's retained values of the listed channels to the other tabs, overwriting theirs. It doesn't fetch theirs. Two tabs that emit on the same channel at the same moment can each end up with the other's value; nothing decides a winner.

## Wires

The **wire** is the name of the `BroadcastChannel` the transport opens. Every tab on the same wire hears every other. The default wire is `native-federation-communication/1`, and the transport name is `broadcast:` plus the wire.

A second bus on the default wire, such as a `createBus()` bus connected with `{ bus }` in a test, hears the page bus's tabs. Give it a wire of its own:

```js
connectTransport(broadcastChannelTransport('my-tests'), ['cart:changed'], { bus: testBus });
```

Use one transport instance per connection. Connecting an instance to a second bus while its first connection is open throws, where `BroadcastChannel` exists:

```text
[native-federation-communication] broadcastChannelTransport('native-federation-communication/1') is already listening; use one instance per connection.
```

## Scope

- Same origin and same storage partition only. Same-origin iframes are included.
- A tab kept in the back-forward cache is evicted when a message reaches it.
- Without `BroadcastChannel` (React Native, for one), the transport sends and receives nothing. For React Native, see [React Native and WebView](recipes.md#react-native-and-webview).
- In tests, call `connection?.close()`: an open `BroadcastChannel` keeps Node running.

## Why BroadcastChannel

A `CustomEvent` dispatched on `window` or `document` runs its listeners inside that one document. It never reaches another tab, popup or iframe, and inside one document the bus already does that job. `BroadcastChannel` crosses tabs, so the transport uses it.
