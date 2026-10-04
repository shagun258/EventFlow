# docker build -f infrastructure/docker/frontend.Dockerfile -t eventflow/frontend .
FROM node:20-slim AS build
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FETCH_RETRIES=5 NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 NPM_CONFIG_FETCH_TIMEOUT=300000
# NEXT_PUBLIC_* is baked in at build time. The BROWSER (not the container) calls the gateway, so use a host-reachable URL.
ARG NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
ENV NEXT_PUBLIC_GRAPHQL_URL=${NEXT_PUBLIC_GRAPHQL_URL} NEXT_TELEMETRY_DISABLED=1

# Cached dependency layer: only package.json files + lockfile (npm ci installs just the frontend workspace)
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/kafka-events/package.json packages/kafka-events/
COPY packages/service-common/package.json packages/service-common/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/frontend/package.json apps/frontend/
COPY services/auth-service/package.json services/auth-service/
COPY services/product-service/package.json services/product-service/
COPY services/cart-service/package.json services/cart-service/
COPY services/order-service/package.json services/order-service/
COPY services/inventory-service/package.json services/inventory-service/
COPY services/payment-service/package.json services/payment-service/
COPY services/notification-service/package.json services/notification-service/
COPY services/analytics-service/package.json services/analytics-service/
RUN npm ci -w apps/frontend

COPY apps/frontend ./apps/frontend
RUN npm run build -w apps/frontend

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
