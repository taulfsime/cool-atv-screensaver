# build stage
FROM node:20-alpine AS builder

WORKDIR /app

# install all dependencies (including dev for typescript)
COPY package*.json ./
RUN npm ci

# copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# production stage
FROM node:20-alpine

# install runtime dependencies for sharp
RUN apk add --no-cache \
    vips-dev \
    fftw-dev \
    && rm -rf /var/cache/apk/*

# create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# copy built application from builder
COPY --from=builder /app/dist ./dist

# copy public files (not compiled by typescript)
COPY src/public ./dist/public

# create directories for volumes
RUN mkdir -p /certs /logs /srv/photos/processed && \
    chown -R appuser:appgroup /app /certs /logs /srv/photos/processed

# switch to non-root user
USER appuser

# expose HTTPS port
EXPOSE 8443

# health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:8443/login || exit 1

# start server
CMD ["node", "dist/server.js"]
