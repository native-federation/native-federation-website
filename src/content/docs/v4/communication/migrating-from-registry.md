# Migrating from the Registry

> Move from the orchestrator's `__NF_REGISTRY__` to the bus one channel at a time: install the bus in the host, port each channel's producer and consumers together, then remove `init-registry.mjs`.

The orchestrator's [event registry](../orchestrator/event-registry.md) (`init-registry.mjs`, `window.__NF_REGISTRY__`, the `/registry` subpath) is deprecated in favour of this package. It keeps working, so you can move one channel at a time:

1. **Install the bus in the host**, with the `/install` import or `install.js`, before any code uses it (see [Getting Started](getting-started.md#install)). Until then the bus drops every call and warns.
2. **Port each channel's producer and consumers together**, using the [mapping](#mapping) below. Where that isn't possible, emit on both meanwhile, as in [Pages with both](#pages-with-both).
3. **Remove `init-registry.mjs`** once nothing uses `__NF_REGISTRY__`.

The registry had resources (`register` / `onReady`) and streams (`emit` / `on`). The bus has only channels, and a channel keeps its last value as its retained value, so it covers both: a resource and a stream with the same name become one channel.

## Mapping

| Registry                                                        | Bus                                                                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `<script src="…/init-registry.mjs">`                            | `<script src="…/install.js">`, see [Getting Started](getting-started.md#with-a-script-tag)         |
| `window.__NF_REGISTRY__ ??= createRegistry(options)()` in code  | `import '@softarc/native-federation-communication/install'`, in the host only                      |
| `declare global { interface Window { __NF_REGISTRY__ … } }`     | delete it: the package declares `__NF_BUS__`                                                       |
| `window.__NF_REGISTRY__`                                        | `import { bus } from '@softarc/native-federation-communication'`, or `globalThis.__NF_BUS__`       |
| `emit<Events['x']>('x', …)`, `on<Events['x']>(…)`               | `emit('x', …)`, `on('x', …)`, see [Typing](#typing)                                                |
| `await register(name, value)`                                   | `emit(name, value)`: it returns nothing, so drop the `await`                                       |
| `register(name, load)`                                          | `emit(name, await load())`: a function is now a value, not called                                  |
| `register(name, () => fn)`, to publish `fn`                     | `emit(name, fn)`, without the wrapper                                                              |
| `onReady(name, callback)`                                       | `on(name, callback)`, or [`firstValue`](recipes.md#firstvalue) for a promise                       |
| `on(name, ({ data }) => …)`                                     | `on(name, value => …)`: listeners get the value itself                                             |
| `on(name, callback, { replay: 0 })`                             | `on(name, callback, { replay: false })` (`0` still works); producers emit with `{ retain: false }` |
| `on(name, callback, { replay: n })` with `n > 1`                | not supported: keep a list in the value                                                            |
| `update(name, fn)`                                              | `emit(name, fn(bus.peek(name)))`                                                                   |
| `clear(name)` / `clear()`                                       | not supported; tests get a fresh bus, see [Testing](recipes.md#testing)                            |
| `data-max-streams`, `data-max-events`, `data-remove-percentage` | not needed: a channel keeps one value                                                              |
| `{ data, timestamp }`                                           | put a timestamp in the value if a consumer needs one                                               |

A script that emits on the bus without importing the package, such as the orchestrator's `orch.init-ready` announcement, needs `install.js` to run first: put the `install.js` tag before that script. An `/install` import in the host's code runs too late for it.

> [!WARNING] `register(name, () => fn)` published `fn`, because `register` called functions. `emit` doesn't: ported literally, `emit(name, () => fn)` publishes the wrapper. Only TypeScript, on a [declared channel](typing.md), reports that.

## Typing

Move your `Events` interface into `Channels` (see [Typing](typing.md)):

```ts
// before
export interface Events {
  'store:selected': { id: string };
}
window.__NF_REGISTRY__!.emit<Events['store:selected']>('store:selected', { id });

// after
declare module '@softarc/native-federation-communication' {
  interface Channels {
    'store:selected': { id: string };
  }
}
bus.emit('store:selected', { id });
```

Drop the type arguments. Where you used `Events['x']` as a type, use `ChannelValue<'x'>`.

## Behaviour changes

- **No copy.** The registry cloned values, which dropped functions. Listeners on the bus get the producer's object, so emit a new object instead of mutating it.
- **`on` keeps firing.** `onReady` called back once; `on` calls back for every value. For the first value only, use [`firstValue`](recipes.md#firstvalue) or abort a `signal` in the first call.
- **`update` gets the producer's object.** The registry passed `update`'s function a clone; `bus.peek` doesn't. Return a new object from the function, never a mutated `peek` result.
- **Synchronous replay.** The retained value arrives before `on` returns.
- **Isolated listeners.** A throwing listener no longer stops the others or the producer.

## Pages with both

`init-registry.mjs` and `install.js` run side by side as two separate buses: a value emitted on one never reaches the other. Move a channel's producer and consumers together, or emit on both meanwhile:

```js
const cart = { count: 3 };
globalThis.__NF_REGISTRY__?.emit('cart.changed', cart);
bus.emit('cart.changed', cart);
```
