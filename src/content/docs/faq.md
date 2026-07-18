---
applies_to: [v3, v4]
---

# FAQ

> Frequently asked questions about Native Federation — when to use it, how to troubleshoot shared packages, CommonJS handling, and more.

Answers to common questions about Native Federation — from when to use it, to troubleshooting shared packages and CommonJS handling.

## When should I use this package?

If you like the idea of webpack Module Federation but want to switch to Angular's new esbuild builder, Native Federation is the right choice. It provides the same mental model and API while being built on web standards (ESM and Import Maps), making it independent of any specific build tool.

## I get an error when preparing shared packages. What should I do?

Native Federation needs to prepare all shared packages as EcmaScript modules. This happens once for development and once for production builds, and results are cached.

If preparation fails, it's typically because:

- **Node-only package:** You're trying to share a package intended for Node.js that can't be converted to ESM. If you use `shareAll` and the package is in your `dependencies`, move it to `devDependencies` or add it to the `skip` section of your `federation.config.(m)js`.
- **Incompatible code:** The package contains code that esbuild can't convert to ESM. This shouldn't happen with packages built using the Angular CLI or Nx (ng-packagr). If it does, please report the specific package.

## How do I deal with CommonJS packages?

The official Angular Package Format has used ESM for years, and all packages created with the Angular CLI follow this standard. Native Federation is built on ESM.

For older CommonJS packages, Native Federation automatically converts them to ESM. Depending on the package, some details may change.

## How do I manually define a package's entry point?

Usually, entry points are auto-detected. If a package doesn't follow standard conventions, you can provide the entry point manually:

```js
export default withNativeFederation({
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
    'test-pkg': {
      packageInfo: {
        entryPoint: '/path/to/test-pkg/entry.mjs',
        version: '1.0.0',
        esm: true,
      },
    },
  },
});
```

When specifying a manual entry point, you also need to provide the `version` and `esm` flag since there may not be a `package.json` nearby.

## How can I speed up package preparation during builds?

Prepared packages are cached in `node_modules/.cache`. Make sure this folder is preserved and reused across subsequent builds — for example, in your CI/CD pipeline. This avoids re-preparing packages that haven't changed.

## How does Native Federation work under the hood?

At runtime, Native Federation uses **Import Maps** — a web standard for mapping module specifiers to URLs. In addition, it uses code at both build time and runtime to provide the full mental model of Module Federation, including shared dependency negotiation and version mismatch handling.
