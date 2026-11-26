# Typing

> Declare each channel once in the `Channels` interface to check values in TypeScript or in JavaScript with `// @ts-check`, then add typed handles or strict channel names where you want them.

Types are optional: plain JavaScript gets the full API. To have TypeScript check what is emitted on a channel and what its listeners receive, declare the channel once in the package's `Channels` interface:

```ts
// channels.d.ts
export {}; // keeps the file a module, so this adds to the package's types instead of replacing them

declare module '@softarc/native-federation-communication' {
  interface Channels {
    'cart:changed': { count: number };
    // command: emit with { retain: false }
    'ui:toast': { text: string };
  }
}
```

```ts
bus.emit('cart:changed', { count: 3 }); // ok
bus.emit('cart:changed', { cnt: 3 }); // error
bus.on('cart:changed', ({ count }) => {}); // count: number
```

The declarations type `bus` and every bus from `createBus()` and `busFrom()`, all of type `Bus`. `globalThis.__NF_BUS__` stays untyped (`NativeFederationBus`), because every copy of the package declares it and the declarations must agree. Write code against `bus` or `Bus`, not the global.

The types are tested with TypeScript 6.0 and use `AbortSignal`, so the project needs the `DOM` lib or `@types/node`.

## In JavaScript

Keep the same `channels.d.ts` and start each `.js` file with `// @ts-check` (or set `checkJs` in `jsconfig.json`). Your editor then completes channel names and flags wrong values. In JSDoc, name a channel's value type as `import('@softarc/native-federation-communication').ChannelValue<'cart:changed'>`.

## What the types don't catch

- **A misspelt name is just another channel.** `bus.on('cart:chnaged', …)` compiles, with an `unknown` value, and never receives anything. Export the names as constants from your contracts module, or use [strict channel names](#strict-channel-names).
- **An undeclared channel is `unknown`**, not `any`: narrow the value before you use it, or cast it where you can see it: `bus.peek('legacy:cart') as Cart | undefined`.
- **A union of names takes a union of values.** With `name: 'cart:changed' | 'ui:toast'`, `bus.emit(name, value)` accepts either channel's value. Emit with a literal name.
- **Commands.** The types can't require `{ retain: false }`. Mark commands in the declaration, as above, and emit them through one typed helper:

  ```ts
  export const showToast = (toast: ChannelValue<'ui:toast'>): void =>
    bus.emit('ui:toast', toast, { retain: false });
  ```

- **Other deploys.** Types are checked per build. A producer deployed with a newer declaration can still send a shape that an older consumer doesn't expect, so validate values at runtime where it matters.

## Typed handles

To name a channel once and get its value type from `Channels`, wrap it in a handle:

```ts
import {
  bus,
  type ChannelName,
  type ChannelValue,
  type EmitOptions,
  type OnOptions,
} from '@softarc/native-federation-communication';

export const channel = <K extends ChannelName>(name: K) => ({
  emit: (value: ChannelValue<K>, options?: EmitOptions) => bus.emit(name, value, options),
  on: (listener: (value: ChannelValue<K>) => void, options?: OnOptions) =>
    bus.on(name, listener, options),
  peek: () => bus.peek(name),
});
```

```ts
export const cartChanged = channel('cart:changed');
cartChanged.emit({ count: 3 });
cartChanged.on(({ count }) => {});
```

## Strict channel names

`bus` accepts any name, so a typo becomes a new channel. To make a typo a compile error, use a view that only takes declared names:

```ts
import {
  bus,
  type Channels,
  type EmitOptions,
  type OnOptions,
  type Unsubscribe,
} from '@softarc/native-federation-communication';

// Accepts declared channels only, so a misspelt name is a compile error.
export type StrictBus = {
  emit<K extends keyof Channels>(channel: K, value: Channels[K], options?: EmitOptions): void;
  on<K extends keyof Channels>(
    channel: K,
    listener: (value: Channels[K]) => void,
    options?: OnOptions
  ): Unsubscribe;
  peek<K extends keyof Channels>(channel: K): Channels[K] | undefined;
};

export const strictBus = bus as StrictBus;
```

## Sharing the declarations

Every producer and consumer must see the declaration. Either put it in a types-only contracts package that each remote installs, or copy the `.d.ts` into each repo, which is simpler but drifts. A contracts package that needs the package's types imports them with `import type`, which leaves no runtime import behind.

If one build sees two different types for one channel, TypeScript reports an error, so drift between packages shows up at build time.

## Evolving a channel

- Name channels `team:subject:verb`, such as `checkout:cart:changed`, so ownership is clear.
- Use object values, even for one field, so you can add fields later.
- Make a breaking change under a new name, such as `cart:changed.v2`, and emit both until every consumer has moved.
