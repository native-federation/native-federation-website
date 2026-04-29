---
applies_to: [v3, v4]
---

# Native Federation & Module Federation

> Learn how to combine Native Federation and webpack Module Federation side-by-side, including migration strategies.

Native Federation can work alongside webpack Module Federation. This guide covers how to combine both technologies and how to migrate from Module Federation to Native Federation.

## Same API, Different Runtime

The package `@angular-architects/native-federation` uses the same API as `@angular-architects/module-federation`. To switch, simply change your imports to the native-federation package. Do not mix imports from both packages in the same application.

## Side-by-Side Usage

In some architectures, you might need to run both technologies simultaneously — for example, during a gradual migration or when integrating with legacy systems that still use webpack.

For a detailed guide on running both technologies side-by-side, read:

- [Combining Native Federation and Module Federation](https://www.angulararchitects.io/en/blog/combining-native-federation-and-module-federation/) — A practical guide to using both technologies in a single architecture, with configuration examples and common patterns.

## Migration from Module Federation

If you're currently using Angular with webpack Module Federation and want to migrate to Native Federation (and Angular's esbuild-based build system), follow the official migration guide:

- [Migration Guide](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/docs/migrate.md) — step-by-step instructions for switching from Module Federation to Native Federation.

## Key Differences

| Aspect | Module Federation | Native Federation |
| --- | --- | --- |
| Build Tool | webpack | esbuild (via Angular CLI) |
| Module Format | webpack modules | ESM + Import Maps |
| Configuration API | Identical | Identical |
| Build Speed | Standard webpack | Fast esbuild + caching |
| Future-Proof | Tied to webpack | Web standards-based |

## Updates

You can use `ng update` to update Native Federation to the latest version. For notes specific to upgrading to version 18, see the [Version 18 Update Guide](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/docs/update18.md).
