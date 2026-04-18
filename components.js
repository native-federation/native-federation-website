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

  function getDocsDepth() {
    if (!docsMatch) return 0;
    const parts = docsMatch[1].split('/').filter(Boolean);
    return Math.max(parts.length - 1, 0);
  }

  const docsDepth = getDocsDepth();
  const docsPrefix = '../'.repeat(docsDepth);
  const pathPrefix = isDocsPage ? '../'.repeat(docsDepth + 1) : '';

  function getActivePage() {
    const path = window.location.pathname;
    if (path.includes('/docs')) return 'docs';
    if (path.endsWith('/') || path.endsWith('index.html') || path.match(/\/nf-website\/?$/)) return 'home';
    if (path.includes('team')) return 'team';
    if (path.includes('resources')) return 'resources';
    return '';
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
        <a href="${pathPrefix}index.html" class="header-logo" aria-label="Native Federation Home">
          <img src="${pathPrefix}images/logo-neu3.png" alt="" width="36" height="36">
          <span>Native Federation</span>
        </a>
        <nav class="header-nav" aria-label="Main navigation">
          <a href="${pathPrefix}index.html" class="${activePage === 'home' ? 'active' : ''}">Home</a>
          <a href="${pathPrefix}docs/example.html" class="${activePage === 'docs' ? 'active' : ''}">Docs</a>
          <a href="${pathPrefix}team.html" class="${activePage === 'team' ? 'active' : ''}">Team</a>
          <a href="${pathPrefix}resources.html" class="${activePage === 'resources' ? 'active' : ''}">Resources</a>
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
      <a href="${pathPrefix}index.html" class="${activePage === 'home' ? 'active' : ''}">Home</a>
      <a href="${pathPrefix}docs/example.html" class="${activePage === 'docs' ? 'active' : ''}">Docs</a>
      <a href="${pathPrefix}team.html" class="${activePage === 'team' ? 'active' : ''}">Team</a>
      <a href="${pathPrefix}resources.html" class="${activePage === 'resources' ? 'active' : ''}">Resources</a>
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
          <a href="${pathPrefix}index.html">Home</a>
          <a href="${pathPrefix}docs/example.html">Docs</a>
          <a href="${pathPrefix}team.html">Team</a>
          <a href="${pathPrefix}resources.html">Resources</a>
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

    const docs = [
      { section: 'Getting Started', items: [
        { href: 'architecture.html', label: 'Architecture Overview', id: 'architecture' },
        { href: 'mental-model.html', label: 'The Mental Model', id: 'mental-model' },
        { href: 'terminology.html', label: 'Terminology', id: 'terminology' },
        { href: 'tutorial.html', label: 'Tutorial (v3)', id: 'tutorial' },
        { href: 'example.html', label: 'Example Repo (v3)', id: 'example' },
        { href: 'migration.html', label: 'Migration to v4', id: 'migration' },
      ]},
      { section: 'Orchestrator', items: [
        { href: 'orchestrator/index.html', label: 'Overview', id: 'orchestrator' },
      ]},
      { section: 'Core', items: [
        { href: 'core/index.html', label: 'Overview', id: 'core' },
        { href: 'core/getting-started.html', label: 'Getting Started', id: 'core/getting-started' },
        { href: 'core/configuration.html', label: 'federation.config.js', id: 'core/configuration' },
        { href: 'core/sharing.html', label: 'Sharing Dependencies', id: 'core/sharing' },
        { href: 'core/build-process.html', label: 'Build Process', id: 'core/build-process' },
        { href: 'core/caching.html', label: 'Caching', id: 'core/caching' },
        { href: 'core/build-adapters.html', label: 'Build Adapters', id: 'core/build-adapters' },
        { href: 'core/artifacts.html', label: 'Build Artifacts', id: 'core/artifacts' },
        { href: 'core/api-reference.html', label: 'API Reference', id: 'core/api-reference' },
      ]},
      { section: 'Runtime', items: [
        { href: 'runtime/index.html', label: 'Overview', id: 'runtime' },
      ]},
      { section: 'Adapters', items: [
        { href: 'adapters/index.html', label: 'Overview', id: 'adapters' },
        { href: 'adapters/esbuild/index.html', label: 'esbuild (React)', id: 'adapters/esbuild' },
        { href: 'adapters/build-your-own.html', label: 'Build Your Own', id: 'adapters/build-your-own' },
      ]},
      { section: 'Angular Adapter', items: [
        { href: 'angular-adapter/index.html', label: 'Overview', id: 'angular-adapter' },
        { href: 'angular-adapter/getting-started.html', label: 'Getting Started', id: 'angular-adapter/getting-started' },
        { href: 'angular-adapter/builder.html', label: 'Builder', id: 'angular-adapter/builder' },
        { href: 'angular-adapter/schematics.html', label: 'Schematics', id: 'angular-adapter/schematics' },
        { href: 'angular-adapter/configuration.html', label: 'Angular Config', id: 'angular-adapter/configuration' },
        { href: 'angular-adapter/runtime.html', label: 'Runtime', id: 'angular-adapter/runtime' },
        { href: 'angular-adapter/ssr.html', label: 'SSR & Hydration', id: 'angular-adapter/ssr' },
        { href: 'angular-adapter/i18n.html', label: 'I18N', id: 'angular-adapter/i18n' },
        { href: 'angular-adapter/localization.html', label: 'Localization', id: 'angular-adapter/localization' },
        { href: 'angular-adapter/custom-builder.html', label: 'Custom Builder', id: 'angular-adapter/custom-builder' },
        { href: 'angular-adapter/migration-v4.html', label: 'Migration to v4', id: 'angular-adapter/migration-v4' },
      ]},
      { section: 'Guides', items: [
        { href: 'ssr-hydration.html', label: 'SSR & Hydration', id: 'ssr-hydration' },
        { href: 'native-and-module-federation.html', label: 'Native & Module Federation', id: 'native-and-module-federation' },
        { href: 'component-libs.html', label: 'Component Libs', id: 'component-libs' },
      ]},
      { section: 'Reference', items: [
        { href: 'faq.html', label: 'FAQ', id: 'faq' },
        { href: 'documentation.html', label: 'Blog Series', id: 'documentation' },
        { href: 'workshop.html', label: 'Architecture Workshop', id: 'workshop' },
      ]},
    ];

    const versionBadge = `
      <div class="sidebar-version">
        <span class="version-pill">v4</span>
        <span class="version-text">Docs for Native Federation 4.x</span>
      </div>
    `;

    sidebar.innerHTML = versionBadge + docs.map(function (group) {
      return `
        <div class="sidebar-section">
          <div class="sidebar-label">${group.section}</div>
          <nav class="sidebar-nav">
            ${group.items.map(function (item) {
              return `<a href="${docsPrefix}${item.href}" class="${activeDoc === item.id ? 'active' : ''}">${item.label}</a>`;
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

  /* --- Init --- */
  renderHeader();
  renderDocsSidebar();
  renderFooter();
})();
