# DevTools

> A read-only Chrome and Firefox DevTools panel that reads the negotiated state back out of a running Native Federation v4 application — every shared package, every remote, every chunk.

_Which version of `@angular/core` won? Who provided it? Why did that remote end up with its own copy?_

The negotiation happens once, at startup — then it disappears into the import map. Native Federation DevTools reads it back out of the running page and explains it.

<div class="btn-row">
  <a class="btn btn-primary" href="https://chromewebstore.google.com/detail/native-federation-devtool/knbodlnbljndbcbalndkflbhbegdghej">Install for Chrome</a>
  <a class="btn btn-primary" href="https://addons.mozilla.org/en-US/firefox/addon/native-federation-devtools/">Install for Firefox</a>
</div>

![The Graph tab: remotes on the left, the dependency copies they resolve to in the middle, and the chunk files those copies load on the right](/images/devtools/hero-graph.webp)

> [!NOTE] **Requires the v4 Orchestrator.** The panel reads the registry that `@softarc/native-federation-orchestrator` keeps in the page. Applications on the classic v3 runtime (`@softarc/native-federation-runtime`) are not supported — on such pages the panel shows _No Native Federation detected_.

> [!TIP] **Built for developers, not for agents.** The panel is made for a person to explore in the browser. A coding agent that has to debug a federated app gets further with the [`nf-debugging`](https://github.com/native-federation/skills/tree/main/nf-debugging) skill from [native-federation/skills](https://github.com/native-federation/skills): it walks the agent through the investigation step by step and ships console scripts and a headless capture script to collect the evidence — for v3 and v4, in the browser and during SSR. Install it with `npx skills add https://github.com/native-federation/skills`.

## Install

The extension is a public pre-release (currently **0.3.0**), developed as part of the Native Federation project — feedback and bug reports are welcome in the [GitHub repository](https://github.com/native-federation/devtools/issues). Both store listings are published under the official Native Federation presence and update automatically.

- **Chrome** (and other Chromium browsers): install from the **[Chrome Web Store](https://chromewebstore.google.com/detail/native-federation-devtool/knbodlnbljndbcbalndkflbhbegdghej)**.
- **Firefox** 140 or later: install from **[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/native-federation-devtools/)**.

Then open DevTools on an application that runs the v4 Orchestrator. The panel appears as a new **Native Federation** tab — if DevTools was already open, close and reopen it once.

To run a development build instead, see [Development & Architecture](https://github.com/native-federation/devtools/blob/main/docs/DEVELOPMENT.md) in the repository.

### Where the panel finds the registry

The panel finds the orchestrator's state under the default storage options, a custom `storageNamespace`, and `localStorage` / `sessionStorage` storage. From orchestrator 4.7 on it follows the [storage descriptor](orchestrator/configuration.md#storage-pointer) the orchestrator publishes on `globalThis.__NF_ORCHESTRATOR__`; on older versions it falls back to the default namespace in `window`, then `localStorage`, then `sessionStorage`. **Custom storage adapters are not supported.**

## Four questions it answers

### Which version won? — Packages

The **Packages** tab shows the negotiation per package and share scope: every version that resolves, which remote's build serves it, who ships it and who uses it. Open a version for its entrypoints and the files that serve them, SRI status included, and a compatibility matrix of which declared range accepts which version.

Filters narrow the list to the packages worth a look:

- **Multiple versions** — more than one version resolves in a share scope (strict copies excluded).
- **Out of range** — a non-strict remote resolves to a shared version its range rejects. The orchestrator only stores a plain skip for it; the panel flags it anyway.
- **Isolated** — a remote runs its own copy, because its range rejects the shared version or the build serving the package lacks an entrypoint it ships.

Pick a participant to show only the packages it is involved in; that combines with the filters.

![The Packages tab: @angular/core 22.0.8 shared from the host, shipped and used by all four remotes, with its six entrypoints and the files that serve them, SRI included](/images/devtools/packages.webp)

### Where does each package run from? — Remotes

The **Remotes** tab is the same data from one participant's point of view. One row per package: the version this remote runs, whose build it comes from — its own, another remote's, or a subpool — and, only when it is off the norm, a short reason, explained on hover. Open a row for its declared range, pool, entrypoints and the remotes it serves. A warning flags flat externals or flat chunking when the capture proves them.

![The Remotes tab: a remote runs two chart packages on its own build because its strict ^2.0.0 range rejects the global 1.1.0, and two form packages from another remote's build](/images/devtools/remotes.webp)

### Why did that remote end up with its own copy? — Graph

The **Graph** tab draws remotes, dependency copies and chunk files as one picture. Dashed nodes are isolated copies and dotted edges are served by another remote, so a remote that fell back to its own version stands out immediately. Hover a node to trace everything connected to it; tick remotes to include or exclude them; select dependencies to see only their build files. The dependency column can be grouped by provider, share scope, pool or build.

<picture>
  <source srcset="/images/devtools/hover-trace-static.webp" media="(prefers-reduced-motion: reduce)" />
  <img src="/images/devtools/hover-trace.webp" alt="Hovering nodes in the Graph tab: the trace lights up the hovered node's remotes, dependency copies and chunk files while everything else dims" width="1200" height="1014" />
</picture>

### Why did a remote leave the pool? — Pools

The **Pools** tab shows one matrix per explicit [pool](orchestrator/pooling.md) tag: which remotes run on the global map, in a subpool, or on their own build — and why. Select a pool and the warning under the matrix lists what keeps remotes off it, one line per problem: every range rejection and every entrypoint the global map lacks. Select a subpool or own build to see which remotes would fit that build instead. The reasons are recomputed from the stored records with the orchestrator's own rules, and checked against the cause it stored.

The tab appears only when the capture carries pool tags.

![The Pools tab: pool acme, with six remotes on the host's build, five in a subpool on contacts' build because the global map lacks two packages, and legacy on its own build because its ranges reject the global versions](/images/devtools/pools.webp)

### Also in the panel

- **Import Map** — the effective map, row by row, each entry attributed to its package, its provider and the chunk bundle that serves it. This is the raw evidence the other tabs are derived from.
- **Export JSON** — freezes the whole snapshot to a file. Attach it to a bug report and the maintainers see exactly what your browser saw.
- **Refresh** — the panel shows a snapshot taken at the timestamp in the toolbar. Re-capture after a dynamic init has added remotes.

## What it does not tell you

The panel reports what the runtime committed — nothing more. Keep three boundaries in mind when reading it:

- **Resolution is not execution.** _Mapped_ means the import map points a specifier at a file. It does not prove the file was loaded, let alone that its code ran — the Network panel answers that.
- **Failed remotes are invisible.** A remote whose `remoteEntry.json` could not be loaded never enters the registry, so it does not appear in the panel. Its error shows up in the browser console instead.
- **Declared is not used.** A participant's row shows the range it declared and where that resolved — not whether the remote actually imports the package at runtime.

The extension is strictly read-only: it requests no host permissions and injects no content scripts. It inspects the page; it never mutates it. The [repository](https://github.com/native-federation/devtools) documents the design constraints behind that.
