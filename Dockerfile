FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache ca-certificates ffmpeg python3 py3-pip \
  && pip3 install --no-cache-dir --break-system-packages yt-dlp

COPY package.json ./
COPY server.js ./
COPY public ./public
RUN mkdir -p downloads data secrets && chmod 777 secrets data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "server.js"]
