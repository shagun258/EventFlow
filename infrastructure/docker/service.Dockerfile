# Builds ANY backend service or the gateway:
#   docker build --build-arg SERVICE=auth-service -f infrastructure/docker/service.Dockerfile .
#   docker build --build-arg SERVICE=api-gateway --build-arg DIR=apps -f infrastructure/docker/service.Dockerfile .
#
# Speed: the "deps" stage depends only on package.json files + package-lock.json, so Docker builds it ONCE
# (npm ci from the lockfile, no dependency resolution) and every service image reuses the cached layer.
FROM node:20-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FETCH_RETRIES=5 NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 NPM_CONFIG_FETCH_TIMEOUT=300000

# ---- shared, cached layer: dependencies for all backend workspaces (frontend excluded) ----
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
RUN npm ci -w packages/kafka-events -w packages/service-common -w apps/api-gateway \
    -w services/auth-service -w services/product-service -w services/cart-service -w services/order-service \
    -w services/inventory-service -w services/payment-service -w services/notification-service -w services/analytics-service

# ---- per-service layer: only source code changes invalidate from here ----
ARG SERVICE
ARG DIR=services
ENV SERVICE=${SERVICE} DIR=${DIR}
COPY packages ./packages
COPY ${DIR}/${SERVICE} ./${DIR}/${SERVICE}
RUN npm run build -w packages/kafka-events -w packages/service-common && npm run build -w ${DIR}/${SERVICE}
CMD npm run start:prod -w $DIR/$SERVICE
