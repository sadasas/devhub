FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
RUN npm ci --workspace=server --include-workspace-root
COPY server/tsconfig.json server/tsconfig.json
COPY server/src server/src
RUN npm run build --workspace=server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
RUN npm ci --workspace=server --include-workspace-root --omit=dev
COPY --from=build /app/server/dist server/dist
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
