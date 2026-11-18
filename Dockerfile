FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json server.js ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts
ENV NODE_ENV=production PORT=1337 DATA_DIR=/app/data
VOLUME /app/data
EXPOSE 1337
USER node
CMD ["node", "server.js"]
