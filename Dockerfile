# --- ETAP 1: Baza systemowa ---
FROM node:24-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# --- ETAP 2: Budowanie (Kompilacja TypeScript i Vite) ---
FROM base AS build
# Narzędzia systemowe przydatne przy kompilacji niektórych paczek npm (np. bcrypt)
RUN apk add --no-cache make gcc g++ python3 pkgconfig

COPY package-lock.json package.json ./
RUN npm ci --include=dev

COPY . .

# Budowanie frontendu oraz kompilacja TS dla backendu
RUN npm run build

# Usuwamy deweloperskie zależności, by odchudzić obraz produkcyjny
RUN npm prune --omit=dev


# --- ETAP 3: Obraz produkcyjny ---
FROM base

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app /app

# Ustawienie portu zgodnie z fly.toml
ENV PORT=8080
EXPOSE 8080

# Komenda uruchamiająca Twój produkcyjny backend serwujący również frontend
CMD [ "npm", "run", "start" ]