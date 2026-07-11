---
applies_to: [v3, v4]
---

# Event Registry

> An in-page event bus exposed as `window.__NF_REGISTRY__`. Resolves the orchestrator's ready promise retroactively and gives micro frontends a typed channel for cross-MFE communication.

The orchestrator ships a small event bus that lives on `window.__NF_REGISTRY__`. It is what `init-registry.mjs` boots up before the orchestrator runtime arrives, and it covers two jobs:

1. **Resolving init promises retroactively.** A subscriber that arrives after the orchestrator has finished initializing still receives `orch.init-ready` — no race condition window like plain `window.addEventListener` events.
2. **Robust cross-MFE communication.** Micro frontends can publish and subscribe to typed streams without holding direct references to each other.

> **Opt-in feature — it does not exist until you load it.**
> `window.__NF_REGISTRY__` is **only** created when the registry has been initialized. For a quickstart host that means adding the `init-registry.mjs` script (see [Installation](#installation) below) before any consumer code runs. For a custom orchestrator host it means calling `createRegistry({ ... })` from `@softarc/native-federation-orchestrator/registry` and assigning the result to `window.__NF_REGISTRY__` yourself. If you skip both, the quickstart silently falls back to the legacy `mfe-loader-available` custom event and consumer code that calls `window.__NF_REGISTRY__.onReady(...)` will throw `Cannot read properties of undefined`.

The registry distinguishes two concepts:

- **Resources** — fire-and-latch values, delivered through `register` / `onReady`. Once registered, every future `onReady` consumer fires immediately. Use these for one-shot readiness signals (the orchestrator itself uses this for `orch.init-ready`).
- **Event streams** — append-only buffers, delivered through `emit` / `update` / `on`. Streams are bounded by `maxEvents` and (optionally) `maxStreams`, and subscribers get configurable history replay.

## Installation

There are two supported ways to make `window.__NF_REGISTRY__` available; pick the one that matches how you ship the orchestrator.

### Option A — quickstart hosts: load `init-registry.mjs`

Include `init-registry.mjs` **before** the rest of your scripts (including the orchestrator's `quickstart.mjs` and any consumer code). Optionally tune the bus via `data-*` attributes on the script tag:

```html
<script
  src="https://unpkg.com/@softarc/native-federation-orchestrator@4.5.0/init-registry.mjs"
  data-max-streams="50"
  data-max-events="50"
  data-remove-percentage="50"
></script>
```

After this script runs, `window.__NF_REGISTRY__` is a frozen `NFEventRegistry` instance. The orchestrator's quickstart bundle detects it at the end of init and publishes `orch.init-ready` on it (see [What the orchestrator publishes](#what-the-orchestrator-publishes)).

### Option B — custom orchestrator hosts: create it yourself

If you bundle your own orchestrator script (calling `initFederation` directly), `init-registry.mjs` is the wrong shape — you don't load random `unpkg` scripts in a bundled host. Instantiate the registry from the `/registry` subpath and assign it to `window` yourself, *before* `initFederation` resolves:

```ts
import { createRegistry } from '@softarc/native-federation-orchestrator/registry';
import { initFederation } from '@softarc/native-federation-orchestrator';

// Same options as init-registry.mjs accepts via data-* attributes.
// removePercentage is a fraction here (0.5), not a percent (50).
window.__NF_REGISTRY__ = Object.freeze(
  createRegistry({ maxEvents: 50, maxStreams: 50, removePercentage: 0.5 })()
);

initFederation(manifest, options).then(loaders => {
  window.__NF_REGISTRY__.register('orch.init-ready', { ...loaders });
});
```

> **If neither option runs, the registry doesn't exist.** `window.__NF_REGISTRY__` is `undefined` and the orchestrator silently falls back to the legacy `mfe-loader-available` `CustomEvent`. Consumer code that calls `window.__NF_REGISTRY__.onReady(...)` will throw — guard with `window.__NF_REGISTRY__?.onReady(...)` if both wirings must work side by side.

## Configuration

| Attribute                 | Default (no attribute set)         | Effect                                                                                                                                            |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-max-streams`        | unbounded (no LRU eviction)        | Maximum number of distinct stream types the registry will retain. When exceeded, the least-recently-emitted stream (and its history) is evicted. |
| `data-max-events`         | `1` (latest-only)                  | Per-stream history depth. When exceeded, the oldest events are dropped — see [Trimming](#trimming) below.                                         |
| `data-remove-percentage`  | `1` event removed per trim         | When trimming kicks in, this percentage of `maxEvents` is evicted in one batch (so subsequent emits don't slice on every call). Expressed in %.   |

> **Note:** Without `data-max-events`, the registry only keeps the most recent event per stream — fine for state-channels (BehaviorSubject-style) but probably too aggressive for log-style streams. Set `data-max-events` explicitly when you want history.

If you instantiate the registry yourself via `createRegistry({ ... })` rather than the script, the equivalent options are `maxStreams`, `maxEvents`, and `removePercentage`. **`removePercentage` is a fraction here, not a percent** — pass `0.5`, not `50`. The script tag divides the data-attribute value by 100 before forwarding it.

### <a id="trimming"></a> Trimming

The trim policy is "batch eviction." When a stream's history exceeds `maxEvents`, the registry drops `min(maxEvents - 1, ceil(maxEvents * removePercentage))` of the oldest events at once, leaving the most recent `maxEvents - removed` events. This avoids slicing on every emit at the cost of a brief overshoot.

At least one event is always retained — even with `removePercentage: 1.0` or `maxEvents: 1`, the most recent event stays available for new subscribers.

## API

The full type is `NFEventRegistry`:

```ts
type NFEventRegistry = {
  // Resources (one-shot readiness)
  register<T>(type: string, resource: T | (() => Promise<T> | T)): Promise<void>;
  onReady<T>(type: string, callback: (value: T) => void): NFEventUnsubscribe;

  // Event streams
  emit<T>(type: string, data: T): void;
  update<T>(type: string, reducer: (current: T | undefined) => T): void;
  on<T>(
    type: string,
    callback: (event: { data: T; timestamp: number }) => void,
    opts?: { replay?: number }
  ): NFEventUnsubscribe;

  // Maintenance
  clear(type?: string): void;
};
```

### Resources

#### `register(type, resource)`

Stores `resource` under `type`. If `resource` is a function, it is invoked (and awaited) and the result is stored. Any consumers waiting via `onReady(type, …)` are notified.

```js
__NF_REGISTRY__.register('app-config', async () =>
  fetch('/config.json').then(r => r.json())
);
```

#### `onReady(type, callback)`

If `type` is already registered, `callback` fires **synchronously** with the value. Otherwise it is queued and fires the moment `register(type, …)` runs.

```js
__NF_REGISTRY__.onReady('orch.init-ready', ({ loadRemoteModule }) => {
  loadRemoteModule('team/mfe1', './Button');
});
```

Returns an unsubscribe function. When `type` was already registered at subscribe time, the returned function is a no-op (the callback has already fired).

### Event streams

#### `emit(type, data)`

Publishes an event on `type`. The event is wrapped with a `timestamp`, appended to the stream's history, and delivered synchronously to every current subscriber.

```js
__NF_REGISTRY__.emit('cart.changed', { itemCount: 3 });
```

#### `update(type, reducer)`

Publishes a new event whose value is derived from the previous one — useful when the next state depends on the last (counters, accumulating buffers, toggles).

The reducer receives a **structured clone** of the last value (or `undefined` if the stream is empty), so it cannot accidentally mutate stored history.

```js
__NF_REGISTRY__.update('cart.itemCount', current => (current ?? 0) + 1);
```

> Values passed through `update` must be structured-clone-able when the stream is non-empty (no functions, DOM nodes, or class instances).

#### `on(type, callback, opts?)`

Subscribes `callback` to `type` for every future event. On subscribe, the most recent `opts.replay` events from history are delivered via a microtask (so the unsubscribe handle is returned synchronously, and the replay fires after the current task completes).

| `opts.replay` | Behavior                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1` (default) | Deliver only the most recent event — matches the "BehaviorSubject" pattern, where a fresh subscriber always sees the current state. Right default for state-channels.                                                |
| `0`           | Suppress replay entirely. The subscriber only sees events emitted after it subscribes — right for one-shot signals where past history is irrelevant.                                                                 |
| `N`           | Deliver up to the last `N` events in chronological order. Capped implicitly by `maxEvents`. Right for late-joining consumers that need recent context (e.g. a debug panel that wants the last 10 navigation events). |

Replay payloads are structured-cloned, so mutating them in the callback never affects what later subscribers will see.

```js
// Default: get the latest cart state immediately, then every future change.
__NF_REGISTRY__.on('cart.changed', ({ data, timestamp }) => render(data));

// Subscribe without backfill.
__NF_REGISTRY__.on('user.clicked', ({ data }) => track(data), { replay: 0 });

// Backfill the last 10 navigation events.
__NF_REGISTRY__.on('nav.route', ({ data }) => log(data), { replay: 10 });
```

Returns an unsubscribe function that removes the listener.

### Maintenance

#### `clear(type?)`

With a `type`, drops the stream's history, listeners, registered resource, and pending `onReady` callbacks for that key. Without a `type`, wipes the entire registry. Useful in tests; rarely needed in production.

## What the orchestrator publishes

When the orchestrator's quickstart bundle finishes initializing, it calls `register('orch.init-ready', { … })` with the entire `NativeFederationResult` payload — `loadRemoteModule`, `load`, `as`, `config`, `adapters`, `initRemoteEntry`. Subscribers can destructure whichever pieces they need:

```js
__NF_REGISTRY__.onReady('orch.init-ready', ({ loadRemoteModule, initRemoteEntry }) => {
  loadRemoteModule('team/mfe1', './Button');
});
```

For a fully custom orchestrator script (you call `initFederation` yourself), wire the registry the same way the quickstart does:

```js
import { initFederation } from '@softarc/native-federation-orchestrator';

initFederation(manifest, options).then(loaders => {
  window.__NF_REGISTRY__?.register('orch.init-ready', { ...loaders });
});
```

## Patterns

### State channel (BehaviorSubject-style)

```js
// Producer
__NF_REGISTRY__.update('cart.itemCount', n => (n ?? 0) + 1);

// Consumer — gets the current count on subscribe + every change after
__NF_REGISTRY__.on('cart.itemCount', ({ data }) => {
  document.querySelector('#cart-badge').textContent = data;
});
```

### Event log (multiple subscribers, no backfill)

```js
// Producer
__NF_REGISTRY__.emit('analytics.click', { id: 'cta-1' });

// Consumer — only sees events after subscribe
__NF_REGISTRY__.on('analytics.click', ({ data }) => track(data), { replay: 0 });
```

### Late-joining diagnostic (bounded backfill)

```js
__NF_REGISTRY__.on(
  'orch.module-loaded',
  ({ data, timestamp }) => debugPanel.append({ ...data, at: timestamp }),
  { replay: 50 }
);
```

## See also

- [The orchestrator event-registry docs](https://github.com/native-federation/orchestrator/blob/main/docs/event-registry.md) — the upstream version of this page.
- [Getting Started — Avoiding race conditions](getting-started.md#2-avoiding-race-conditions--the-event-registry) — how the registry plugs into the HTML quickstart.
- [Configuration](configuration.md) — every option on `initFederation`.
