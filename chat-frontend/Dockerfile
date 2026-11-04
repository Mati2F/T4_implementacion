# --- 1) Compilar con Node ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_GATEWAY_URL=/graphql
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
RUN npm run build

FROM nginx:1.27-alpine
ENV GATEWAY_UPSTREAM=http://chat-gateway:8000
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /etc/nginx/conf.d
USER nginx
EXPOSE 8080
