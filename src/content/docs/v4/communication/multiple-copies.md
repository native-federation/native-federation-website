# Multiple Copies

> Bundle the package into every remote, share it, or load it from a script tag: every copy on the page finds the same bus, through a small versioned protocol.

> [!INFO] **Beta — feedback wanted.** The communication package is in pre-release (`4.0.0-next.1`), and its API may still change before 4.0.0. Tried it? Tell us what works and what doesn't in the [GitHub issues](https://github.com/native-federation/communication/issues).

Bundle the package into every remote, share it with native federation, or both: every copy on the page
uses the same bus. If you share it, leave `strictVersion` off (or `skip` the package), so two versions
don't become a native federation version conflict that this package doesn't need.

## How a copy finds the bus

The bus lives in `globalThis.__NF_BUS__`. On its first use (never at import), a copy takes the first
case that applies:

1. **A bus is installed** (`protocol >= 1`, and `emit`, `on` and `peek` are functions): use it, in any
   runtime, whichever copy installed it.
2. **Something else is there**: leave it, warn once and use a private bus, which the rest of the page
   never hears. Fix the page.
3. **A browser page** (`window` is the global object): install a new bus there.
4. **Anywhere else**: use an inert bus that drops every call and warns once. See
   [Outside a browser](#outside-a-browser).

`init-bus.js` runs these steps at once; loading it twice is harmless. The first copy to install serves
the page, so a host that wants a known version loads `init-bus.js` first.

## The protocol

The frozen object in `__NF_BUS__` is the contract between old and new copies:

- Copies check `protocol` (1), never `version`. The package major is a separate number.
- Methods may be added. A copy checks that one exists before calling it, and the types mark it optional.
- An option or behaviour an older bus would silently ignore needs a new protocol number, and callers
  check `protocol >= N` first.
- A member's type never changes, since TypeScript merges every copy's declaration of the global.
- A breaking change gets a new global name.

## Outside a browser

Node, Deno, Bun, workers and iframes:

- **An iframe** has its own global object, so its own bus. Bridge with `postMessage` if needed.
- **One user per process** (a CLI, a worker, Electron's main process): run
  `globalThis.__NF_BUS__ ??= createBus();` at startup. Never on a server that serves many users.
- **Server-side rendering**: install the request-scoped bus from
  [the SSR recipe](recipes.md#server-side-rendering) at boot.
- **A server that sets `global.window = global`** (some DOM shims), and Deno 1.x, look like a browser
  page, so the first copy would install one bus for all requests. The SSR recipe's bus, installed at
  boot, prevents that.
