FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Expose the backend port
EXPOSE 3000

# Run the app in production using node instead of nodemon
CMD ["node", "./src/index.js"]
