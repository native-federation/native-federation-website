---
applies_to: [v3]
---

# Example

> A working example of Native Federation loading a Micro Frontend into a shell application using Angular.

A ready-to-run example showing Native Federation in action — loading a Micro Frontend into a shell application.

We migrated the original webpack Module Federation example to Native Federation. The example demonstrates a host (shell) application dynamically loading a remote Micro Frontend at runtime.

## Get the Example

Clone the example repository and install dependencies:

```bash
git clone https://github.com/manfredsteyer/module-federation-plugin-example.git --branch nf-standalone-solution

cd module-federation-plugin-example

npm i
```

## Run It

Start the Micro Frontend first:

```bash
ng serve mfe1 -o
```

Wait until the Micro Frontend is running, then open a second terminal and start the shell:

```bash
ng serve shell -o
```

The shell will load the Micro Frontend at runtime. Navigate to the second menu item to see the remote component rendered inside the host.

> **Note:** Looking for UI library compatibility? Check the [Component Libs](component-libs.md) page for our demo repository that tests Native Federation with popular Angular UI libraries.
