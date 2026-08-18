# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=${VITE_GEMINI_API_KEY}
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# Production stage
FROM nginx:alpine
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
