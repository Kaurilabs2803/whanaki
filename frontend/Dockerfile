FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Dev: run with hot reload
CMD ["npm", "run", "dev"]
