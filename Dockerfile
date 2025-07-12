# Stage 1: Build the React app
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set default command to rebuild app at startup - ensures latest env vars to be used in static UI code
CMD ["sh", "-c", "npm run build && npx serve -s dist -l 80"]