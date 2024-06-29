FROM node:latest

# Install dependencies for canvas
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev

COPY . /usr/src/app

WORKDIR /usr/src/app

RUN npm install

# Rebuild native modules
RUN npm rebuild canvas

CMD ["npm", "start"]
