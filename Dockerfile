FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build: generate Prisma client + Next.js (skip db push and template-db — done at runtime)
RUN npx prisma generate && npx next build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/buildverse.db

RUN addgroup -S buildverse && adduser -S buildverse -G buildverse

COPY --from=builder --chown=buildverse:buildverse /app/.next/standalone ./
COPY --from=builder --chown=buildverse:buildverse /app/.next/static ./.next/static
COPY --from=builder --chown=buildverse:buildverse /app/public ./public
COPY --from=builder --chown=buildverse:buildverse /app/prisma ./prisma
COPY --from=builder --chown=buildverse:buildverse /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=buildverse:buildverse /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=buildverse:buildverse /app/node_modules/prisma ./node_modules/prisma

RUN mkdir -p /data && chown buildverse:buildverse /data

USER buildverse
EXPOSE 3000

# Apply schema then start the server (prisma CLI lives at node_modules/prisma/build/index.js)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]
