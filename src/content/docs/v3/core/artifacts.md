# Build Artifacts

> remoteEntry.json and importmap.json — the two metadata files every federated build emits, field by field.

A federated build writes its bundles plus two JSON files into the output folder. `remoteEntry.json` is the contract between a build and any runtime; `importmap.json` is a convenience artifact for tooling.

```
dist/mfe1/browser/
├── remoteEntry.json
├── importmap.json
├── Component-KJH3F2.js       ← an exposed module
├── shared-lib-9A21BC.js      ← a shared mapping
├── _angular_core-A9B2C1.js   ← a shared package
└── ...
```

## `remoteEntry.json`

```json
{
  "name": "mfe1",
  "exposes": [
    { "key": "./Component", "outFileName": "Component-KJH3F2.js" }
  ],
  "shared": [
    {
      "packageName": "@angular/core",
      "outFileName": "_angular_core-A9B2C1.js",
      "requiredVersion": "^21.0.0",
      "version": "21.0.4",
      "singleton": true,
      "strictVersion": true
    },
    {
      "packageName": "shared-lib",
      "outFileName": "shared-lib-9A21BC.js",
      "requiredVersion": "",
      "version": "",
      "singleton": true,
      "strictVersion": false
    }
  ]
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | The config's `name`. Used as the remote's name when a host registers it without supplying one. |
| `exposes` | `ExposesInfo[]` | One entry per key under `exposes`. |
| `shared` | `SharedInfo[]` | One entry per shared package **and** per shared mapping — they share a shape. |
| `buildNotificationsEndpoint` | string? | Only present in dev builds with build notifications enabled. A host that sees it opens an `EventSource` on `<base URL><endpoint>` and reloads on a completed rebuild. |

### `ExposesInfo`

| Field | Meaning |
| --- | --- |
| `key` | The exposed key exactly as written in the config, e.g. `./Component`. The runtime maps it to the import-map key `<remoteName>/<key>`. |
| `outFileName` | The emitted file, relative to the folder holding `remoteEntry.json`. |
| `dev.entryPoint` | Dev builds only: the source path, for tooling. |

### `SharedInfo`

| Field | Meaning |
| --- | --- |
| `packageName` | The bare specifier consumers import — `@angular/core`, or a tsconfig alias for a shared mapping. |
| `outFileName` | The emitted file, relative to `remoteEntry.json`. |
| `requiredVersion` | The semver range this build expects. Empty for shared mappings. |
| `version` | The concrete version shipped. The v3 runtime deduplicates on `packageName@version`, so an empty or differing version means no reuse across remotes. |
| `singleton` | Whether only one instance may exist at runtime. Always `true` for shared mappings. |
| `strictVersion` | Whether a mismatch is an error rather than a warning. |
| `dev.entryPoint` | Dev builds only: the source path. |

Everything is relative. The host derives each URL by joining the directory of the `remoteEntry.json` it fetched with `outFileName`, which is what lets the same build be deployed under any path.

## `importmap.json`

```json
{
  "imports": {
    "@angular/core": "_angular_core-A9B2C1.js",
    "shared-lib": "shared-lib-9A21BC.js"
  }
}
```

A flat `packageName → outFileName` map derived from the same `shared` list, with no scopes and no exposed modules. The runtime does not read it — it builds its own map from `remoteEntry.json`, adding scopes and absolute URLs. `importmap.json` exists for tooling and for hosts that want the mapping without parsing the full entry.

## Related

- [Build Process](build-process.md) — the steps that produce these files.
- [The Import Map](../runtime/import-map.md) — what the runtime builds out of them.
- [Runtime → API Reference](../runtime/api-reference.md) — the `FederationInfo` and `SharedInfo` types as the runtime sees them.
