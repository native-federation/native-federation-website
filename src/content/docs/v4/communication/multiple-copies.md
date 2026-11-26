# Multiple Copies

> Bundle the package into every remote, share it, or both: every copy on the page uses the one bus the host installed, through a small versioned protocol that every 4.x keeps.

Each remote can bundle its own copy of the package, get it shared through native federation, or both: every copy on the page uses the one installed bus. If you share it, leave `strictVersion` off (or `skip` the package), so that two versions on one page don't fail as a native federation version conflict. The bus doesn't need one version per page.

## How a copy finds the bus

The bus lives at `globalThis.__NF_BUS__`. Every copy's `bus` reads that slot on every call and uses whatever is there, whichever copy or version installed it. Importing the package itself never installs anything; only `/install`, `install.js` and `installGlobalBus` do.

| What is at `__NF_BUS__`         | What every copy's `bus` does                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| Nothing                         | It is [inert](api.md#without-an-installed-bus): drops every call and warns once per copy |
| A bus, from any copy or version | It forwards every call to that bus                                                       |
| Something that is not a bus     | It calls it anyway, and the call fails, typically with a `TypeError`. Fix the page       |

**The first install wins.** `/install`, `install.js` and `installGlobalBus` fill an empty slot only. A later install, from any copy or version, keeps the bus that is there; `installGlobalBus` returns it, so compare the result with yours. To control which version serves the page, install in the host, before any remote loads.

A copy never creates a bus of its own when the slot is empty or holds something else.

## The protocol

The frozen bus at `__NF_BUS__` is the contract between old and new copies. A copy uses it without checking it, so the contract changes only by these rules:

- **Feature checks use `protocol` (`1` in this release), never `version`.** The package major is a separate number.
- **Methods can be added, as optional members.** A copy checks that a method exists before it calls it. `tap` is such a member: a copy calls `bus.tap?.(…)`, and [`connectTransport`](api.md#a-refused-connection) refuses a bus without it.
- **An option or behaviour that an older bus would silently ignore needs a new protocol number**, and callers check `protocol >= N` before relying on it.
- **A member's type never changes**, because TypeScript merges every copy's declaration of the global.
- **A breaking change gets a new global name.**

Copies of the [cross-tab](cross-tab.md) transport share two more contracts. Changing either needs a new wire name:

- the `BroadcastChannel` name `native-federation-communication/1`, which also makes the transport name `broadcast:native-federation-communication/1`, so a bus connects it once;
- the envelope `{ channel: string, value: unknown, retain: boolean }`, which is also what a tap listener receives.

## Outside a browser

Node, Deno, Bun, workers and iframes each have their own global object, so each has its own `__NF_BUS__`:

- **An iframe** has its own bus. To bridge it to the page's bus, use a [transport](api.md#transports); [`broadcastChannelTransport`](cross-tab.md) also reaches same-origin iframes.
- **A process with one user** (a CLI, a worker, Electron's main process): import `/install` at startup.
- **A server that renders for many users**: never import `/install` in server code, or every request shares one bus. Install the request-scoped bus from [the SSR recipe](recipes.md#server-side-rendering) at boot. Without it, the bus on the server is inert.

## Compatibility

Every 4.x release keeps these promises:

- **Any 4.x copy works with a bus that any other 4.x copy installed**, older or newer. The bus behaves as the copy that installed it does, so code that needs behaviour added in a later 4.x checks [`protocol`](#the-protocol) first. `protocol` is `1` in 4.0.0.
- **The interfaces you implement, `Transport` and `TapListener`, only gain optional members.**
- **The cross-tab wire name and the envelope stay as they are**, and transports carry only `channel`, `value` and `retain`.
- **A refused `connectTransport` returns `undefined` and warns, and a taken `tap` name returns `undefined`.** Neither starts to throw.
- **Error and warning messages and `version` are for people, not code.** They can change in any release.

> [!INFO] **Coming from a 4.0.0-next prerelease?** Copies from next.0 and next.1 install a bus on their first call and have no `tap`, and next.2 delivers an emit to taps opened during it. Upgrade the host first and add the `/install` import there, then the remotes. The [4.0.0 release notes](https://github.com/native-federation/communication/releases/tag/v4.0.0) list every rename and the full upgrade path.
