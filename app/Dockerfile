# Use official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all application files
COPY . .

# Use Docker-specific configuration file
RUN cp config.docker.json config.json

# Build Vite frontend
RUN npm run build

# Expose ports
EXPOSE 3001

# Start application in production mode
CMD ["npm", "start"]
