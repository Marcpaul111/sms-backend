FROM node:20
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["sh", "-c", "npm run migrate && npm run start"]
