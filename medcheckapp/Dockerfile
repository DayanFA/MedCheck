FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package*.json ./
RUN npm pkg delete devDependencies || true
EXPOSE 3000
CMD ["node", "dist/medcheckapp/server/server.mjs"]