FROM node:20 AS builder
ARG ENV=dev
ENV PUPPETEER_SKIP_DOWNLOAD=1
# Create app in specific folder
WORKDIR /app
COPY . /app
RUN npm install -g bower gulp

# Installed packages & build
RUN yarn install && \
    if [ "$ENV" = "prod" ]; then \
        gulp build; \
    else \
        gulp build --env=development; \
    fi && \
    rm -rf node_modules
# Serve it from Nginx
FROM nginxinc/nginx-unprivileged:alpine3.23
COPY ./docker-assets/nginx.conf /etc/nginx/conf.d/default.conf

### Copy compiled app output to Nginx
COPY --from=builder /app/build /usr/share/nginx/html/lro-guidelines
USER 101
