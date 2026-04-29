---
applies_to: [v3]
---

# Tutorial

> Step-by-step tutorial for setting up Native Federation with Angular — configure a host and remote, share dependencies, and load Micro Frontends at runtime.

Set up a complete Micro Frontend architecture with Native Federation from scratch. You'll create a host (shell) and a remote (Micro Frontend) that load shared dependencies at runtime.

## Prerequisites

- Angular CLI 16.1 or higher
- Node.js (LTS recommended)

## 1. Clone the Starter

Start with the prepared starter branch:

```bash
git clone https://github.com/manfredsteyer/module-federation-plugin-example.git --branch nf-standalone-starter

cd module-federation-plugin-example

npm i
```

This repository contains two Angular applications: a `shell` (the host) and a Micro Frontend called `mfe1` (the remote).

## 2. Install Native Federation

```bash
npm i @angular-architects/native-federation -D
```

## 3. Initialize the Remote

Configure `mfe1` as a remote that exposes components:

```bash
ng g @angular-architects/native-federation:init --project mfe1 --port 4201 --type remote
```

## 4. Initialize the Host

Configure the `shell` as a dynamic host that reads remote configuration at runtime:

```bash
ng g @angular-architects/native-federation:init --project shell --port 4200 --type dynamic-host
```

> **Note:** A dynamic host reads configuration from a `.json` file at runtime. This allows you to change which remotes are loaded without rebuilding the application.

## 5. Host Configuration

The generated host configuration at `projects/shell/federation.config.js`:

```js
const {
  withNativeFederation,
  shareAll,
} = require("@angular-architects/native-federation/config");

module.exports = withNativeFederation({
  name: "my-host",
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: "auto",
    }),
  },
  skip: [
    "rxjs/ajax",
    "rxjs/fetch",
    "rxjs/testing",
    "rxjs/webSocket",
  ],
});
```

## 6. Remote Configuration

The generated remote configuration at `projects/mfe1/federation.config.js`:

```js
const {
  withNativeFederation,
  shareAll,
} = require("@angular-architects/native-federation/config");

module.exports = withNativeFederation({
  name: "mfe1",
  exposes: {
    "./Component": "./projects/mfe1/src/app/app.component.ts",
  },
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: "auto",
    }),
  },
  skip: [
    "rxjs/ajax",
    "rxjs/fetch",
    "rxjs/testing",
    "rxjs/webSocket",
  ],
});
```

## 7. Host Bootstrap

The generated `projects/shell/src/main.ts` initializes Native Federation before loading Angular:

```ts
import { initFederation } from "@angular-architects/native-federation";

initFederation("/assets/federation.manifest.json")
  .catch((err) => console.error(err))
  .then((_) => import("./bootstrap"))
  .catch((err) => console.error(err));
```

## 8. Federation Manifest

The manifest at `projects/shell/src/assets/federation.manifest.json` maps remote names to their entry points:

```json
{
  "mfe1": "http://localhost:4201/remoteEntry.json"
}
```

> **Warning:** Make sure this entry points to port **4201**. Native Federation generates the `remoteEntry.json` automatically — it contains metadata about the remote.

## 9. Remote Bootstrap

The remote's `projects/mfe1/src/main.ts` also initializes federation:

```ts
import { initFederation } from "@angular-architects/native-federation";

initFederation()
  .catch((err) => console.error(err))
  .then((_) => import("./bootstrap"))
  .catch((err) => console.error(err));
```

## 10. Load the Remote

Add a lazy route to the shell's routing configuration at `projects/shell/src/app/app.routes.ts`:

```ts
import { loadRemoteModule } from "@angular-architects/native-federation";

export const APP_ROUTES: Routes = [
  {
    path: "",
    component: HomeComponent,
    pathMatch: "full",
  },
  {
    path: "flights",
    loadComponent: () =>
      loadRemoteModule("mfe1", "./Component").then(
        (m) => m.AppComponent
      ),
  },
  {
    path: "**",
    component: NotFoundComponent,
  },
];
```

## 11. Run the Application

Start the remote first:

```bash
ng serve mfe1 -o
```

Once it's running, start the shell in another terminal:

```bash
ng serve shell -o
```

Click the second menu item to load the remote component into the host. The Micro Frontend is loaded at runtime — the shell had no knowledge of it at build time.

## What's Next?

- [Set up SSR & Hydration](ssr-hydration.md)
- [Combine with Module Federation](native-and-module-federation.md)
- [Frequently Asked Questions](faq.md)
