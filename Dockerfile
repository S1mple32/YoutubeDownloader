FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache ca-certificates ffmpeg curl \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp

COPY package.json ./
COPY server.js ./
COPY public ./public
RUN mkdir -p downloads data secrets

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "server.js"]
