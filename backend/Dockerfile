FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies.
# `npm ci` installs exactly what package-lock.json pins, so a deploy can never
# pick up a different transitive version than the one that was tested.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy all source files
COPY . .

# Matches PORT in the deployed .env. Documentation only — the published port
# is decided by `docker run -p`.
EXPOSE 3000

# Run the app in production using node instead of nodemon
CMD ["node", "./src/index.js"]
