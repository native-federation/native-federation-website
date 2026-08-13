# Schematics

> The v3 adapter's schematics — init / ng-add, appbuilder, remove, the update18 migration and the Nx generator.

The adapter registers its schematics in `collection.json`, so they are available through `ng generate` (and `ng add` for the initializer). All of them operate on `angular.json`, falling back to `workspace.json`; if neither exists in the current directory they throw.

| Schematic | Invocation |
| --- | --- |
| `ng-add` / `init` | `ng add @angular-architects/native-federation` |
| `appbuilder` | `ng g @angular-architects/native-federation:appbuilder` |
| `remove` | `ng g @angular-architects/native-federation:remove` |
| `update18` | runs automatically via `ng update` |

## <a id="init--ng-add"></a> init / ng-add

```bash
ng g @angular-architects/native-federation:init --project mfe1 --port 4201 --type remote
```

`ng-add` and `init` are the same factory, so `ng add @angular-architects/native-federation` and the explicit `init` call do the same work.

### Inputs

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `project` | string | the workspace's default project, else the first one | Which project to federate. Positional argument 0. |
| `port` | number | `4200` | Port for the project's serve target. Positional argument 1. |
| `type` | `host` \| `dynamic-host` \| `remote` | `remote` | The role the project plays — see the table in [Getting Started](getting-started.md#3-scaffold-a-host-shell). |
| `nxBuilders` | boolean | — | Declared in the schema but not read by this version of the schematic. |

### What it changes

**`angular.json`** — the original `build` target is moved to `esbuild` and switched to `@angular/build:application` if it was on an older builder (`main` becomes `browser`; `buildOptimizer`, `vendorChunk` and `commonChunk` are dropped). The original `serve` becomes `serve-original` with `port` set. New `build` and `serve` targets pointing at `@angular-architects/native-federation:build` take their place, and in an Nx workspace the new serve target is marked `continuous`. See [Builder → The `angular.json` Layout](builder.md#the-angularjson-layout) for the result.

**Polyfills** — `es-module-shims` is appended to the project's `polyfills` array, or `import 'es-module-shims';` is appended to the polyfills file when the project uses one.

**`federation.config.js`** — created in the project root, unless one already exists. It shares everything from `package.json`, skips the `rxjs` secondary entry points that have no place in a browser bundle, and turns on `features.ignoreUnusedDeps`. A `remote` also gets an `exposes` entry for its app component. See [Angular Config](configuration.md).

**`main.ts`** — the existing content is copied to `bootstrap.ts` and `main.ts` is replaced with a federation bootstrap. Which one depends on `--type`: no arguments for a remote, an inlined remote map for a host, the manifest path for a dynamic host. If `bootstrap.ts` already exists the step is skipped with a message.

**`federation.manifest.json`** — for `--type dynamic-host` only, written to the project's `public/` folder, or `src/assets/` when the project has no `public/`. It is generated from the other applications in the workspace.

**`package.json`** — adds `es-module-shims`, `@angular/animations` (matching the installed `@angular/core`), `@angular-devkit/build-angular` as a devDependency (matching `@angular/build`) and `@softarc/native-federation-node`. An install task is queued at the end.

**SSR projects** — if the referenced build target has an `ssr` option, the schematic also adds `cors`, sets `ssr: true` on the new build target, and rewrites the server entry point the same way it rewrote `main.ts`. See [SSR](ssr.md).

### What it does not do

It does not create a `tsconfig.federation.json` — the federation build reuses the target's own `tsConfig`. It does not touch `index.html`; the script tags are rewritten by the builder at build time. And it never overwrites an existing `federation.config.js` or `bootstrap.ts`, so re-running it on a configured project is close to a no-op.

## appbuilder

```bash
ng g @angular-architects/native-federation:appbuilder --project mfe1
```

Migrates a project that was set up against the older `browser-esbuild` builder onto Angular's Application Builder. It points the stored `esbuild` target at `@angular/build:application`, renames its `main` option to `browser`, rewrites the `serve-original` build targets from `:build:` to `:esbuild:`, and repoints the federation serve target at `serve-original`. The builder prints a reminder to run this when it detects the old setup.

Its only input is `project`, defaulting the same way `init` does.

## remove

```bash
ng g @angular-architects/native-federation:remove --project mfe1
```

The inverse of `init`, as far as the workspace file goes:

- `bootstrap.ts` is renamed back over `main.ts`, discarding the federation bootstrap.
- `es-module-shims` is removed from the polyfills.
- The `esbuild` target is restored as `build`, `serve-original` as `serve`, and the serve target's build references are rewritten from `:esbuild:` back to `:build:`.

`federation.config.js`, the manifest and the `package.json` dependencies are left behind — delete them by hand if you want a clean revert.

## update18

Registered in `migration-collection.json` for version 18, so it runs as part of `ng update @angular-architects/native-federation`. It removes the `postinstall` hook that older adapter versions added to `package.json`, and patches `node_modules/@angular/build` so its private entry point can be imported: the `exports` map is moved aside to `_exports`, `main`/`module`/`types` are pointed at `./src/index.js`, and a `private.js` re-export is written. There is nothing to configure.

## Nx Generator

For Nx workspaces the package also registers a generator that scaffolds a library pre-wired to the federation builder:

```bash
nx g @angular-architects/native-federation:native-federation my-lib --directory shared --tags scope:shared
```

| Option | Type | Meaning |
| --- | --- | --- |
| `name` | string | Required. Positional argument 0. |
| `directory` | string | Sub-directory under the workspace's `libsDir`. Alias `-d`. |
| `tags` | string | Comma-separated Nx tags for linting boundaries. Alias `-t`. |

The same builder is registered as an Nx executor under `@angular-architects/native-federation:build`, so `project.json`-based projects can use it directly.

## Related

- [Getting Started](getting-started.md) — the schematics in context.
- [Builder](builder.md) — the targets `init` writes.
- [Angular Config](configuration.md) — the `federation.config.js` it generates.
