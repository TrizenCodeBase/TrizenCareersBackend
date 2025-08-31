# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Define build arguments
ARG NODE_ENV=production
ARG PORT=5000
ARG MONGODB_URI
ARG JWT_SECRET
ARG JWT_EXPIRES_IN
ARG ALLOWED_ORIGINS
ARG FRONTEND_URL
ARG API_PREFIX
ARG API_VERSION
ARG CAPROVER_GIT_COMMIT_SHA

# Set environment variables
ENV NODE_ENV=$NODE_ENV
ENV PORT=$PORT
ENV MONGODB_URI=$MONGODB_URI
ENV JWT_SECRET=$JWT_SECRET
ENV JWT_EXPIRES_IN=$JWT_EXPIRES_IN
ENV ALLOWED_ORIGINS=$ALLOWED_ORIGINS
ENV FRONTEND_URL=$FRONTEND_URL
ENV API_PREFIX=$API_PREFIX
ENV API_VERSION=$API_VERSION
ENV CAPROVER_GIT_COMMIT_SHA=$CAPROVER_GIT_COMMIT_SHA

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["npm", "run", "start:simple"]
