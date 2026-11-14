# Getting Started

> Install the bus with a bundler or a script tag, then publish state that late listeners still receive and commands that happen once.

> [!INFO] **Beta — feedback wanted.** The communication package is in pre-release (`4.0.0-next.1`), and its API may still change before 4.0.0. Tried it? Tell us what works and what doesn't in the [GitHub issues](https://github.com/native-federation/communication/issues).

TypeScript is optional; to check channel values, see [Typing](typing.md).

## Install

### With a bundler

```bash
npm install @softarc/native-federation-communication
```

```js
import { bus } from '@softarc/native-federation-communication';
```

Every remote may bundle its own copy; they all share one bus (see [Multiple Copies](multiple-copies.md)).

### With a script tag

Load `init-bus.js` as a classic script, before any script that uses the bus:

```html
<script
  src="https://unpkg.com/@softarc/native-federation-communication@4.0.0-next.1/init-bus.js"
  integrity="sha384-HASH"
  crossorigin="anonymous"
></script>
```

- Replace `HASH` with the output of `openssl dgst -sha384 -binary init-bus.js | openssl base64 -A`.
  Serving the file from your own host is better still.
- Keep the exact version: a range such as `@4` never matches a prerelease.
- The bus is then `globalThis.__NF_BUS__`, with the same methods as `bus`. Code that must survive a
  failed load calls `globalThis.__NF_BUS__?.on(…)`.

A remote without a build step can still import `bus` by name when native federation shares the package.

## State

A state channel keeps its last value for listeners that come later: the user, the cart, the theme.

```js
// shell
bus.emit('shell:user', { id: 'u-42', name: 'Ada' });

// any remote, loaded before or after: called now if a value exists, and on every later emit
const off = bus.on('shell:user', user => renderGreeting(user.name));
off(); // when the remote is torn down
```

## Commands

A command should happen once, now, such as showing a toast. Emit it with `{ retain: false }`, through
one helper per channel, so no call site can forget the option:

```js
// toast.js: the only place that emits ui:toast
export const showToast = toast => bus.emit('ui:toast', toast, { retain: false });

// shell: { replay: false } ignores a stale command if a producer forgot retain: false
bus.on('ui:toast', ({ text }) => toaster.show(text), { replay: false });
```

> [!WARNING] Keep one kind per channel: state or commands. Values come from other deploys, so check them before you trust them.

## Next steps

- The [API](api.md) and its pitfalls.
- The [Recipes](recipes.md) for your framework.
