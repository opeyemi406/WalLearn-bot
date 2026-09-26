FROM node:20-slim

# Install Python 3 for slide parsing script
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install pypdf for slide document extraction
RUN pip3 install --no-cache-dir --break-system-packages pypdf || pip3 install --no-cache-dir pypdf

WORKDIR /app

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci || npm install

# Copy application source
COPY . .

# Build TypeScript
RUN npm run build

# Start the WalLearn Telegram Bot
CMD ["npm", "start"]
