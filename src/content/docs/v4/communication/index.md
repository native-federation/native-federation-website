# Communication

> `@softarc/native-federation-communication` is a tiny, page-wide channel bus for micro frontends that are built and deployed apart. A late listener still gets the last value, every copy of the package on the page shares one bus, and TypeScript is optional.

Micro frontends that ship on their own schedules can't hold references to each other, and they don't load in a predictable order. The bus solves both: a producer emits a value on a named **channel**, and every listener receives it, including one that subscribes long after the emit. It succeeds the orchestrator's [Event Registry](../orchestrator/event-registry.md), which is deprecated and removed in v5.

## Quick start

```bash
npm install @softarc/native-federation-communication
```

There are two roles:

1. **The host installs the bus, once.** Make this the first import of the module that `initFederation` loads, often `bootstrap.ts`. `main.ts` is too early: shared packages resolve only after `initFederation`. Without a build step, load the [`install.js` script tag](getting-started.md#with-a-script-tag) instead.

   ```js
   import '@softarc/native-federation-communication/install';
   ```

2. **The host and every remote import `bus`** and talk over named channels:

   ```js
   import { bus } from '@softarc/native-federation-communication';

   // checkout: publish state on the 'cart:changed' channel
   bus.emit('cart:changed', { count: 3 });

   // header, loaded before or after: called with { count: 3 } at once, then with every later value
   const off = bus.on('cart:changed', ({ count }) => (badge.textContent = String(count)));
   off(); // when the header is torn down

   // a command: only the listeners subscribed right now get it, and nothing is kept for later ones
   bus.emit('ui:toast', { text: 'Added to cart' }, { retain: false });
   ```

A remote never installs a bus. If the host hasn't installed one, `bus` drops every call and logs a [warning](api.md#without-an-installed-bus).

> [!TIP] **Keep communication rare.** Navigation state belongs in the URL, data from a parent to a child component in attributes. Reach for the bus when two micro frontends that don't know each other must share a value.

## What it gives you

- **Late listeners still get the value.** A channel retains its last value, and a new listener receives it before `on` returns. No race between whoever loads first.
- **One bus per page.** The host installs it at `globalThis.__NF_BUS__`. Bundle the package into every remote, share it through native federation, or both: every copy uses that one bus.
- **State and commands.** State channels keep their last value; commands, emitted with `{ retain: false }`, reach only the listeners subscribed right now.
- **Across tabs and apps.** Bridge chosen channels to other tabs with the built-in `BroadcastChannel` transport, or to a React Native app or WebView with a transport of your own.
- **Optional typing.** Declare channels once in a `Channels` interface to check values in TypeScript, or in JavaScript with `// @ts-check`.
- **No framework adapters needed.** `on` returns the cleanup function every framework asks for, so Angular, Lit, React, Solid, Svelte, Vue and RxJS take a line or a few each.
- **Stable across 4.x.** Any 4.x copy works with a bus that any other 4.x copy installed; see [Compatibility](multiple-copies.md#compatibility).

## In this section

- [Getting Started](getting-started.md) — install the bus in the host, then publish state and send commands.
- [API](api.md) — every export, option, error and warning: `emit`, `on`, `peek`, `tap`, `connectTransport` and the setup functions.
- [Typing](typing.md) — checked channels in TypeScript and JavaScript, typed handles, strict names, evolving a channel.
- [Recipes](recipes.md) — any framework, custom elements, RxJS, `firstValue`, `values`, SSR, React Native and tests.
- [Multiple Copies](multiple-copies.md) — mixing versions on one page, the protocol, running outside a browser, and what 4.x promises.
- [Cross-tab](cross-tab.md) — sharing channels between tabs of the same origin.
- [Migrating from the Registry](migrating-from-registry.md) — moving from the orchestrator's `__NF_REGISTRY__`.

## See also

- Source and issues: [native-federation/communication](https://github.com/native-federation/communication) on GitHub.
- [Orchestrator](../orchestrator/index.md) — the host runtime that loads the micro frontends talking over the bus.
