/* ==========================================================================
   Native Federation — Shared Components
   Renders header, footer, doc sidebar, and mobile navigation
   ========================================================================== */

(function () {
  'use strict';

  const isDocsPage = window.location.pathname.includes('/docs');
  const pathPrefix = isDocsPage ? '../' : '';

  function getActivePage() {
    const path = window.location.pathname;
    if (path.endsWith('/') || path.endsWith('index.html') || path.match(/\/nf-website\/?$/)) return 'home';
    if (path.includes('/docs')) return 'docs';
    if (path.includes('team')) return 'team';
    if (path.includes('resources')) return 'resources';
    return '';
  }

  function getActiveDoc() {
    const path = window.location.pathname;
    const file = path.split('/').pop().replace('.html', '');
    return file || '';
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
          <img src="${pathPrefix}images/logo.png" alt="" width="36" height="36">
          <span>Native Federation</span>
        </a>
        <nav class="header-nav" aria-label="Main navigation">
          <a href="${pathPrefix}index.html" class="${activePage === 'home' ? 'active' : ''}">Home</a>
          <a href="${pathPrefix}docs/tutorial.html" class="${activePage === 'docs' ? 'active' : ''}">Docs</a>
          <a href="${pathPrefix}team.html" class="${activePage === 'team' ? 'active' : ''}">Team</a>
          <a href="${pathPrefix}resources.html" class="${activePage === 'resources' ? 'active' : ''}">Resources</a>
        </nav>
        <a href="https://github.com/angular-architects/module-federation-plugin" target="_blank" rel="noopener" class="header-github" aria-label="View on GitHub">
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
      <a href="${pathPrefix}docs/tutorial.html" class="${activePage === 'docs' ? 'active' : ''}">Docs</a>
      <a href="${pathPrefix}team.html" class="${activePage === 'team' ? 'active' : ''}">Team</a>
      <a href="${pathPrefix}resources.html" class="${activePage === 'resources' ? 'active' : ''}">Resources</a>
      <a href="https://github.com/angular-architects/module-federation-plugin" target="_blank" rel="noopener">GitHub</a>
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
          <img src="${pathPrefix}images/logo.png" alt="" width="28" height="28">
          <span>Native Federation</span>
        </div>
        <div class="footer-links">
          <a href="${pathPrefix}index.html">Home</a>
          <a href="${pathPrefix}docs/tutorial.html">Docs</a>
          <a href="${pathPrefix}team.html">Team</a>
          <a href="${pathPrefix}resources.html">Resources</a>
          <a href="https://github.com/angular-architects/module-federation-plugin" target="_blank" rel="noopener">GitHub</a>
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
        { href: 'example.html', label: 'Example', id: 'example' },
        { href: 'tutorial.html', label: 'Tutorial', id: 'tutorial' },
      ]},
      { section: 'Guides', items: [
        { href: 'ssr-hydration.html', label: 'SSR & Hydration', id: 'ssr-hydration' },
        { href: 'native-and-module-federation.html', label: 'Native & Module Federation', id: 'native-and-module-federation' },
        { href: 'angular-i18n.html', label: 'Angular I18N', id: 'angular-i18n' },
        { href: 'angular-localization.html', label: 'Angular Localization', id: 'angular-localization' },
      ]},
      { section: 'Reference', items: [
        { href: 'faq.html', label: 'FAQ', id: 'faq' },
        { href: 'documentation.html', label: 'Documentation', id: 'documentation' },
      ]},
      { section: 'More', items: [
        { href: 'workshop.html', label: 'Architecture Workshop', id: 'workshop' },
      ]},
    ];

    sidebar.innerHTML = docs.map(function (group) {
      return `
        <div class="sidebar-section">
          <div class="sidebar-label">${group.section}</div>
          <nav class="sidebar-nav">
            ${group.items.map(function (item) {
              return `<a href="${item.href}" class="${activeDoc === item.id ? 'active' : ''}">${item.label}</a>`;
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
