FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y openssl libssl-dev
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-slim AS build
RUN apt-get update && apt-get install -y openssl libssl-dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:seed && node dist/main.js"]
