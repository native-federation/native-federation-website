# Getting Started

> Install the bus once in the host, import `bus` everywhere, then publish state that late listeners still receive and commands that happen once.

Two roles, two steps:

1. **The host installs the bus once**, before any code uses it.
2. **The host and every remote import `bus`** and use it.

The **bus** is one object per page, kept at `globalThis.__NF_BUS__`. It carries values between micro frontends over named channels. TypeScript is optional; to check channel values, see [Typing](typing.md).

## Install

### With a bundler

```bash
npm install @softarc/native-federation-communication
```

**Host.** Make the `/install` import the first import of the module that `initFederation` loads, often `bootstrap.ts`. Not in `main.ts`: in a Native Federation host, shared packages such as this one resolve only after `initFederation` has run.

```js
// bootstrap.ts in the host
import '@softarc/native-federation-communication/install';
```

**Host and remotes.** Import `bus` from the package itself:

```js
import { bus } from '@softarc/native-federation-communication';
```

A remote doesn't import `/install`. It can bundle its own copy of the package or get the host's through native federation: every copy reads the bus from `globalThis.__NF_BUS__`, so all of them use the one bus the host installed (see [Multiple Copies](multiple-copies.md)). A second `/install` import, from any copy, keeps the bus that is already there. The one exception is a remote that also runs as a standalone app: there it is its own host, so its standalone entry imports `/install`.

### With a script tag

Without a build step, the host loads `install.js` as a classic script, before any script that uses the bus:

```html
<script
  src="https://unpkg.com/@softarc/native-federation-communication@4.0.0/install.js"
  integrity="sha384-HASH"
  crossorigin="anonymous"
></script>
```

- Replace `HASH` with the output of `openssl dgst -sha384 -binary install.js | openssl base64 -A`. Serving the file from your own host is better still.
- Keep the exact version: the hash only matches one file.
- Scripts without a bundler use the bus as `globalThis.__NF_BUS__`; it has the same methods as `bus`. Code that must keep running when the script failed to load calls `globalThis.__NF_BUS__?.on(…)`.

A remote module without a build step can still `import { bus } from '@softarc/native-federation-communication'` when native federation shares the package.

### Without an installed bus

If nothing has installed a bus, `bus` is **inert**: it drops every call and logs one warning per copy of the package, naming the first dropped call (the text is in the [API](api.md#without-an-installed-bus)). Once the host installs a bus, the next call goes to it, but what was dropped stays lost:

```js
// a remote that runs before the host has installed a bus
bus.emit('cart:changed', { count: 3 }); // dropped, and logs the warning
bus.on('cart:changed', render); // dropped: render never runs, not even after the install

// later, after the host's /install import has run
bus.peek('cart:changed'); // undefined: the emit above went nowhere
```

The fix is always the same: install the bus in the host, before any remote code runs.

## State

A **channel** is a string name, such as `'shell:user'`. Each `emit` sends a value to the channel's **listeners**, the functions subscribed with `on`. By default the channel also keeps the value as its **retained value**, and a listener that subscribes later gets it straight away. Use this for state: the user, the cart, the theme.

```js
// shell
bus.emit('shell:user', { id: 'u-42', name: 'Ada' });

// any remote, loaded before or after the emit: renderGreeting runs at once if a value is retained,
// then on every later emit
const off = bus.on('shell:user', user => renderGreeting(user.name));
off(); // when the remote is torn down

bus.peek('shell:user'); // { id: 'u-42', name: 'Ada' }, without subscribing
```

## Commands

A **command** is a value for whoever listens right now, such as "show this toast". Emit it with `{ retain: false }`: the current listeners get it, and the channel keeps nothing, so a listener that subscribes later doesn't replay an old toast. Put the option in one helper per channel, so no call site can forget it:

```js
// toast.js: the only place that emits ui:toast
export const showToast = toast => bus.emit('ui:toast', toast, { retain: false });

// shell: { replay: false } ignores a retained value, in case a producer emitted without retain: false
bus.on('ui:toast', ({ text }) => toaster.show(text), { replay: false });
```

> [!WARNING] Use each channel for one kind of value: state or commands, not both. Values come from other deploys, so validate them before you trust them.

## Next steps

- The [API](api.md) and its [pitfalls](api.md#pitfalls).
- The [Recipes](recipes.md) for your framework.
- [Cross-tab](cross-tab.md), to share channels between tabs.
