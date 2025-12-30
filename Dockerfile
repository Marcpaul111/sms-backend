FROM node:20
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV NODE_ENV=production
CMD ["sh", "-c", "npm run migrate && npm run start"]
