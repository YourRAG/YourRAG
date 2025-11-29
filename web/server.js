const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const httpProxy = require('http-proxy');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Proxy
const proxy = httpProxy.createProxyServer();

// Backend URL from environment or default
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://rag-app:8000';

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // Explicitly handle API routes proxying
      // This ensures proxying works even if Next.js rewrites fail in standalone mode
      if (pathname.startsWith('/api/') || pathname.startsWith('/auth/') || pathname === '/docs' || pathname === '/openapi.json') {
        proxy.web(req, res, { target: BACKEND_URL, changeOrigin: true }, (err) => {
          console.error('Proxy error:', err);
          res.statusCode = 502;
          res.end('Bad Gateway');
        });
      } else {
        // Let Next.js handle all other requests
        await handle(req, res, parsedUrl);
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Proxying API requests to ${BACKEND_URL}`);
    });
});