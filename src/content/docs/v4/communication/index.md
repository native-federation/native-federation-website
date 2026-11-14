# Communication

> `@softarc/native-federation-communication` is a tiny, page-wide channel bus for micro frontends that are built and deployed apart. A late listener still gets the last value, every copy of the package on the page shares one bus, and TypeScript is optional.

> [!INFO] **Beta — feedback wanted.** The communication package is in pre-release (`4.0.0-next.1`), and its API may still change before 4.0.0. Tried it? Tell us what works and what doesn't in the [GitHub issues](https://github.com/native-federation/communication/issues).

Micro frontends that ship on their own schedules can't hold references to each other, and they don't load in a predictable order. The bus solves both: a producer emits a value on a named **channel**, and every listener receives it, including one that subscribes long after the emit. It succeeds the orchestrator's [Event Registry](../orchestrator/event-registry.md), which is deprecated and removed in v5.

## Quick start

```bash
npm install @softarc/native-federation-communication
```

```js
import { bus } from '@softarc/native-federation-communication';

// checkout: publish state
bus.emit('cart:changed', { count: 3 });

// header, loaded at any time: gets { count: 3 } at once, then every later value
const off = bus.on('cart:changed', ({ count }) => (badge.textContent = String(count)));

// a command: only the listeners subscribed right now get it
bus.emit('ui:toast', { text: 'Added to cart' }, { retain: false });
```

No build step? Use the [script tag](getting-started.md#with-a-script-tag).

> [!TIP] **Keep communication rare.** Navigation state belongs in the URL, parent-to-child data in attributes. Reach for the bus when two micro frontends that don't know each other must share a value.

## What it gives you

- **Late listeners still get the value.** A channel retains its last value, and a new listener receives it before `on` returns. No race between whoever loads first.
- **One bus per page.** Bundle the package into every remote, share it through native federation, or load it from a script tag: every copy finds and uses the same bus on `globalThis.__NF_BUS__`.
- **State and commands.** State channels keep their last value; commands, emitted with `{ retain: false }`, reach only the listeners subscribed right now.
- **Optional typing.** Declare channels once in a `Channels` interface to check values in TypeScript, or in JavaScript with `// @ts-check`.
- **No framework adapters needed.** `on` returns the cleanup function every framework asks for, so Angular, React, RxJS and custom elements take a few lines each.

## In this section

- [Getting Started](getting-started.md) — install with a bundler or a script tag, state channels and commands.
- [API](api.md) — `emit`, `on`, `peek`, the delivery rules and the pitfalls.
- [Typing](typing.md) — checked channels in TypeScript and JavaScript, typed handles, evolving a channel.
- [Recipes](recipes.md) — Angular, React, RxJS, `firstValue`, custom elements, SSR and tests.
- [Multiple Copies](multiple-copies.md) — how every copy finds one bus, the protocol between them, and running outside a browser.
- [Migrating from the Registry](migrating-from-registry.md) — moving from the orchestrator's `__NF_REGISTRY__`.

## See also

- Source and issues: [native-federation/communication](https://github.com/native-federation/communication) on GitHub.
- [Orchestrator](../orchestrator/index.md) — the host runtime that loads the micro frontends talking over the bus.
