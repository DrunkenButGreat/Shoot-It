FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Keep the locked production dependencies, including the migration CLI.
FROM deps AS production-deps
RUN npm prune --omit=dev

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create uploads directory
RUN mkdir -p /app/uploads /app/local_media
RUN chown -R nextjs:nodejs /app/uploads

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=production-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy prisma schema for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/admin.cjs ./scripts/admin.cjs
COPY --from=builder /app/scripts/migrate.cjs /app/scripts/healthcheck.cjs ./scripts/

HEALTHCHECK --interval=10s --timeout=6s --start-period=30s --retries=6 CMD ["node", "scripts/healthcheck.cjs"]

# Automatic updates run migrations separately before starting this command.
CMD ["sh", "-c", "node scripts/migrate.cjs deploy && exec node server.js"]
