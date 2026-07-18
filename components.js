/* ==========================================================================
   Native Federation — Shared Components
   Renders header, footer, doc sidebar, and mobile navigation
   ========================================================================== */

(function () {
  'use strict';

  const docsMatch = window.location.pathname.match(/\/docs\/(.*)$/);
  const isDocsPage = !!docsMatch;

  function getDocsRelativePath() {
    if (!docsMatch) return '';
    return docsMatch[1].replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');
  }

  /* Every page now serves at a clean directory URL (.../index.html), so the
     pathname is a directory. Depth = its segment count, ignoring any trailing
     filename (e.g. a directly-hit index.html). */
  const dirSegments = (function () {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length && parts[parts.length - 1].includes('.')) parts.pop();
    return parts;
  })();

  const pathPrefix = '../'.repeat(dirSegments.length); // -> site root
  const docsPrefix = '../'.repeat(Math.max(dirSegments.length - 1, 0)); // -> /docs/
  const rootHref = pathPrefix || './';

  function getActivePage() {
    const path = window.location.pathname;
    if (path.includes('/docs')) return 'docs';
    if (path.includes('/team')) return 'team';
    if (path.includes('/resources')) return 'resources';
    return 'home';
  }

  function getActiveDoc() {
    return getDocsRelativePath();
  }

  const activePage = getActivePage();

  /* --- Header --- */
  function renderHeader() {
    const header = document.createElement('header');
    header.className = 'site-header';
    header.setAttribute('role', 'banner');
    header.innerHTML = `
      <div class="header-inner">
        <a href="${rootHref}" class="header-logo" aria-label="Native Federation Home">
          <img src="${pathPrefix}images/logo-neu3.png" alt="" width="36" height="36">
          <span>Native Federation</span>
        </a>
        <nav class="header-nav" aria-label="Main navigation">
          <a href="${rootHref}" class="${activePage === 'home' ? 'active' : ''}">Home</a>
          <a href="${pathPrefix}docs/getting-started/" class="${activePage === 'docs' ? 'active' : ''}">Docs</a>
          <a href="${pathPrefix}team/" class="${activePage === 'team' ? 'active' : ''}">Team</a>
          <a href="${pathPrefix}resources/" class="${activePage === 'resources' ? 'active' : ''}">Resources</a>
        </nav>
        <a href="https://github.com/native-federation" target="_blank" rel="noopener" class="header-github" aria-label="View on GitHub">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          <span>GitHub</span>
        </a>
        <button class="mobile-menu-btn" aria-label="Open menu" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    `;
    document.body.prepend(header);

    const mobileNav = document.createElement('nav');
    mobileNav.className = 'mobile-nav';
    mobileNav.setAttribute('aria-label', 'Mobile navigation');
    mobileNav.innerHTML = `
      <a href="${rootHref}" class="${activePage === 'home' ? 'active' : ''}">Home</a>
      <a href="${pathPrefix}docs/getting-started/" class="${activePage === 'docs' ? 'active' : ''}">Docs</a>
      <a href="${pathPrefix}team/" class="${activePage === 'team' ? 'active' : ''}">Team</a>
      <a href="${pathPrefix}resources/" class="${activePage === 'resources' ? 'active' : ''}">Resources</a>
      <a href="https://github.com/native-federation" target="_blank" rel="noopener">GitHub</a>
    `;
    header.after(mobileNav);

    const menuBtn = header.querySelector('.mobile-menu-btn');
    menuBtn.addEventListener('click', function () {
      const isOpen = mobileNav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', isOpen);
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* --- Footer --- */
  function renderFooter() {
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.setAttribute('role', 'contentinfo');
    footer.innerHTML = `
      <div class="footer-inner">
        <div class="footer-brand">
          <img src="${pathPrefix}images/logo-neu3.png" alt="" width="28" height="28">
          <span>Native Federation</span>
        </div>
        <div class="footer-links">
          <a href="${rootHref}">Home</a>
          <a href="${pathPrefix}docs/getting-started/">Docs</a>
          <a href="${pathPrefix}team/">Team</a>
          <a href="${pathPrefix}resources/">Resources</a>
          <a href="https://github.com/native-federation" target="_blank" rel="noopener">GitHub</a>
        </div>
        <p class="footer-copy">&copy; ${new Date().getFullYear()} Native Federation. All rights reserved.</p>
      </div>
    `;
    document.body.appendChild(footer);
  }

  /* --- Docs Sidebar --- */
  function renderDocsSidebar() {
    if (!isDocsPage) return;

    const activeDoc = getActiveDoc();
    const sidebar = document.querySelector('.docs-sidebar');
    if (!sidebar) return;

    // `id` doubles as the clean URL relative to /docs/ (rendered as `${id}/`).
    const docs = [
      { section: 'Getting Started', items: [
        { label: 'Overview', id: 'getting-started' },
        { label: 'Architecture Overview', id: 'architecture' },
        { label: 'The Mental Model', id: 'mental-model' },
        { label: 'Terminology', id: 'terminology' },
        { label: 'Tutorial', id: 'tutorial' },
        { label: 'Coming from Module Federation?', id: 'example' },
        { label: 'v3 vs v4', id: 'v3-vs-v4' },
        { label: 'Migration to v4', id: 'migration' },
      ]},
      { section: 'Orchestrator', items: [
        { label: 'Overview', id: 'orchestrator' },
        { label: 'Getting Started', id: 'orchestrator/getting-started' },
        { label: 'Architecture', id: 'orchestrator/architecture' },
        { label: 'Configuration', id: 'orchestrator/configuration' },
        { label: 'Version Resolver', id: 'orchestrator/version-resolver' },
        { label: 'Event Registry', id: 'orchestrator/event-registry' },
        { label: 'Node.js / SSR', id: 'orchestrator/node' },
        { label: 'Module Federation', id: 'orchestrator/module-federation' },
        { label: 'Security & SRI', id: 'orchestrator/security' },
      ]},
      { section: 'Core', items: [
        { label: 'Overview', id: 'core' },
        { label: 'Getting Started', id: 'core/getting-started' },
        { label: 'federation.config.mjs', id: 'core/configuration' },
        { label: 'Sharing Dependencies', id: 'core/sharing' },
        { label: 'Build Process', id: 'core/build-process' },
        { label: 'Caching', id: 'core/caching' },
        { label: 'Build Adapters', id: 'core/build-adapters' },
        { label: 'Build Artifacts', id: 'core/artifacts' },
        { label: 'API Reference', id: 'core/api-reference' },
      ]},
      { section: 'Runtime', items: [
        { label: 'Overview', id: 'runtime' },
        { label: 'Getting Started', id: 'runtime/getting-started' },
        { label: 'initFederation', id: 'runtime/init-federation' },
        { label: 'loadRemoteModule', id: 'runtime/load-remote-module' },
        { label: 'The Import Map', id: 'runtime/import-map' },
        { label: 'API Reference', id: 'runtime/api-reference' },
      ]},
      { section: 'Adapters', items: [
        { label: 'Overview', id: 'adapters' },
        { label: 'Build Your Own', id: 'adapters/build-your-own' },
      ]},
      { section: 'esbuild Adapter', items: [
        { label: 'Overview', id: 'adapters/esbuild' },
        { label: 'Getting Started', id: 'adapters/esbuild/getting-started' },
        { label: 'Builder', id: 'adapters/esbuild/builder' },
        { label: 'Adapter Configuration', id: 'adapters/esbuild/configuration' },
        { label: 'React & CJS Interop', id: 'adapters/esbuild/react-interop' },
      ]},
      { section: 'Angular Adapter', items: [
        { label: 'Overview', id: 'angular-adapter' },
        { label: 'Getting Started', id: 'angular-adapter/getting-started' },
        { label: 'Builder', id: 'angular-adapter/builder' },
        { label: 'Schematics', id: 'angular-adapter/schematics' },
        { label: 'Angular Config', id: 'angular-adapter/configuration' },
        { label: 'Runtime', id: 'angular-adapter/runtime' },
        { label: 'SSR & Hydration', id: 'angular-adapter/ssr' },
        { label: 'I18N', id: 'angular-adapter/i18n' },
        { label: 'Localization', id: 'angular-adapter/localization' },
        { label: 'Custom Builder', id: 'angular-adapter/custom-builder' },
        { label: 'Migration to v4', id: 'angular-adapter/migration-v4' },
      ]},
      { section: 'Guides', items: [
        { label: 'SSR & Hydration', id: 'ssr-hydration' },
        { label: 'Native & Module Federation', id: 'native-and-module-federation' },
        { label: 'Component Libs', id: 'component-libs' },
      ]},
      { section: 'Reference', items: [
        { label: 'FAQ', id: 'faq' },
        { label: 'Blog Series', id: 'documentation' },
        { label: 'Architecture Workshop', id: 'workshop' },
      ]},
    ];

    sidebar.innerHTML = docs.map(function (group) {
      return `
        <div class="sidebar-section">
          <div class="sidebar-label">${group.section}</div>
          <nav class="sidebar-nav">
            ${group.items.map(function (item) {
              return `<a href="${docsPrefix}${item.id}/" class="${activeDoc === item.id ? 'active' : ''}">${item.label}</a>`;
            }).join('')}
          </nav>
        </div>
      `;
    }).join('');

    const toggle = document.querySelector('.sidebar-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        sidebar.classList.toggle('open');
      });

      document.addEventListener('click', function (e) {
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      });
    }
  }

  /* Highlight the current section in the right-hand "On this page" rail. */
  function initTocScrollSpy() {
    const links = Array.prototype.slice.call(
      document.querySelectorAll('.docs-toc__link')
    );
    if (!links.length) return;

    const byId = {};
    const headings = [];
    links.forEach(function (link) {
      const id = decodeURIComponent((link.getAttribute('href') || '').slice(1));
      const heading = id && document.getElementById(id);
      if (!heading) return;
      byId[id] = link;
      headings.push(heading);
    });
    if (!headings.length) return;

    function setActive(id) {
      links.forEach(function (l) { l.classList.remove('active'); });
      if (byId[id]) byId[id].classList.add('active');
    }

    const observer = new IntersectionObserver(
      function () {
        // Pick the last heading whose top has scrolled past the header line.
        const line = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--header-height')
        ) || 64;
        let current = headings[0];
        headings.forEach(function (h) {
          if (h.getBoundingClientRect().top <= line + 24) current = h;
        });
        setActive(current.id);
      },
      { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] }
    );
    headings.forEach(function (h) { observer.observe(h); });
  }

  /* --- Init --- */
  renderHeader();
  renderDocsSidebar();
  renderFooter();
  initTocScrollSpy();
})();
