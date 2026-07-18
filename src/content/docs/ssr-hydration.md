---
applies_to: [v3, v4]
---

# SSR & Hydration

> Learn how to use Angular Server-Side Rendering and Incremental Hydration with Native Federation for better performance and SEO.

Native Federation supports Angular's Server-Side Rendering and Incremental Hydration, enabling better performance, faster initial page loads, and improved SEO for your Micro Frontend applications.

## Overview

Since version 18 (`18@latest`), Native Federation for Angular fully supports:

- **Server-Side Rendering (SSR):** Pre-render your application on the server for faster initial paint and improved search engine indexing.
- **Incremental Hydration:** Progressively hydrate components on the client side, reducing time to interactive while maintaining the full SSR benefits.

## Benefits

- Faster First Contentful Paint (FCP)
- Improved SEO with pre-rendered HTML
- Progressive hydration reduces JavaScript execution on initial load
- Works seamlessly with the host/remote architecture

## Learn More

For a comprehensive guide on setting up SSR and Hydration with Native Federation, including configuration examples and best practices, read the detailed article:

- [SSR and Hydration with Native Federation for Angular](https://www.angulararchitects.io/blog/ssr-and-hydration-with-native-federation-for-angular/) — A complete walkthrough covering server configuration, hydration strategies, and production deployment considerations.
