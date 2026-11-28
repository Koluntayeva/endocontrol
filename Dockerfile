FROM node:22-alpine
RUN apk add --no-cache su-exec
WORKDIR /app
COPY package.json package-lock.json server.js ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts
ENV NODE_ENV=production PORT=1337 DATA_DIR=/app/data
EXPOSE 1337
# The entrypoint starts as root only to fix the data folder's owner, then runs the server as "node".
CMD ["/app/scripts/docker-entrypoint.sh"]
