const path = require('path');
/** Standalone output keeps the Docker image small. Lint runs from the repo root (npm run lint). */
module.exports = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  experimental: { outputFileTracingRoot: path.join(__dirname, '../../') },
};
