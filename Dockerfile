# Use the latest Node.js image as the base
FROM node:latest

# Install dependencies for canvas
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies with npm using cache directory
RUN npm install --prefer-offline --no-audit --cache /tmp/.npm --prefer-offline

# Copy the rest of the application code
COPY . .

# Rebuild native modules
RUN npm rebuild canvas

# Command to run the app
CMD ["npm", "start"]
