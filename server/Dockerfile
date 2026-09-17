FROM node:22-bookworm-slim

# LibreOffice headless is used for .docx -> .pdf export conversion
# (convertDocxToPdf.js); Render's default Node runtime has no system
# binaries at all, so this must be a Docker deploy. fonts-crosextra-carlito
# provides the open-source metric-compatible substitute LibreOffice uses for
# the exported document's declared "Calibri" font, matching local dev.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer \
      fonts-crosextra-carlito \
      fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

# Render injects its own PORT and routes to it regardless of EXPOSE; the app
# itself reads process.env.PORT (index.js), so no hardcoded port here.
CMD ["node", "src/index.js"]
