# API

> Every member of the bus — `emit`, `on` and `peek` — with the delivery rules that hold across channels and the pitfalls to avoid.

> [!INFO] **Beta — feedback wanted.** The communication package is in pre-release (`4.0.0-next.1`), and its API may still change before 4.0.0. Tried it? Tell us what works and what doesn't in the [GitHub issues](https://github.com/native-federation/communication/issues).

```js
import { bus, createBus } from '@softarc/native-federation-communication';
```

- `bus` is the page's bus, the same one every copy of the package and `globalThis.__NF_BUS__` use.
- `createBus()` returns a new bus that is installed nowhere: for code that takes the bus as a
  parameter, or to [install one outside a browser](multiple-copies.md#outside-a-browser).

Both have this shape, written as a TypeScript type. The methods never use `this`.

```ts
type Bus = {
  readonly protocol: number; // the contract between copies: 1
  readonly version: string; // the package version of the copy that serves the page
  emit(channel: string, value: unknown, options?: { retain?: boolean }): void;
  on(
    channel: string,
    listener: (value: unknown) => void,
    options?: { signal?: AbortSignal; replay?: boolean }
  ): () => void;
  peek(channel: string): unknown;
};
```

A channel is any string and exists from first use. A value can be anything, functions included.

**Options.** A missing or `undefined` option means its default; any other value is read as a boolean,
so `{ retain: 0 }` is `{ retain: false }`. Unknown options are ignored.

**Errors.** Every method throws a `TypeError` if `channel` is not a string, and `on` if `listener` is
not a function or `signal` is an `AbortController` instead of its `signal`.

## `emit(channel, value, options?)`

Delivers `value` to the channel's listeners, and the channel retains it in place of the previous value.
With `{ retain: false }` the value is a command: only current listeners get it, and the channel's
retained value is cleared.

## `on(channel, listener, options?)`

Subscribes `listener` and returns `off`, which unsubscribes it and is safe to call twice.

- A retained value is delivered before `on` returns, then every later emit.
- `{ replay: false }` skips the retained value.
- `{ signal }`: aborting it unsubscribes. An aborted signal subscribes nothing.

## `peek(channel)`

Returns the retained value, or `undefined`. A retained `undefined` looks the same as none.

## Delivery rules

- **Order.** Every listener sees values in emit order, across channels. A value emitted inside a
  listener waits until the current value has reached every listener, so that `emit` returns first.
- **Who gets it.** The listeners subscribed at the emit. One that unsubscribes before its turn is
  skipped.
- **Isolation.** A throwing listener doesn't stop the producer or the other listeners. The error goes to
  `reportError` (in a browser, reported like an uncaught error), or to `console.error` without it.
- **Same reference.** Listeners and `peek` get the producer's object. Nothing is copied or frozen.
- **No loop guard.** Two listeners that keep emitting to each other loop forever.

> [!TIP] To debug, run `__NF_BUS__.peek('cart:changed')` or `__NF_BUS__.version` in the browser console.

## Pitfalls

- **Inside the first call, `off` doesn't exist yet**, because the retained value arrives before `on`
  returns. To stop after one value, abort a `signal`, as [`firstValue`](recipes.md#firstvalue) does.
  `{ once: true }` is not an option.
- **Unsubscribe when your component goes away.** A listener outlives its micro frontend otherwise.
- **Emit a new object for every change.** A mutated object changes for every listener, and Angular
  signals and React miss the change, because they compare references.
- **Don't declare or assign `__NF_BUS__` on a page.** A `var __NF_BUS__` in a classic script makes it a
  plain variable that the next assignment replaces, which splits the page. Tests replace the bus as in
  [Testing](recipes.md#testing).
- **Don't delete `__NF_BUS__` on a live page.** The next call installs a new bus, and the old one's
  listeners never hear from it again.
- **Don't generate channel names.** Each name keeps its value for the life of the page. Put ids in the
  value.
