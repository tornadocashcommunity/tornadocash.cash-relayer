FROM node:16
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn && yarn cache clean --force
COPY . .

EXPOSE 8000
ENTRYPOINT ["yarn"]
