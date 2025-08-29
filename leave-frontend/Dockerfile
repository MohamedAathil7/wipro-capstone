# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# ---------- runtime stage ----------
FROM nginx:alpine

# use the file we created instead of an inline heredoc
COPY nginx.conf /etc/nginx/conf.d/default.conf

# make sure the path matches your Angular output folder name
COPY --from=build /app/dist/leave-frontend /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
