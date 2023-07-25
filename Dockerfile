FROM node:20-alpine as dev

ENV NODE_ENV=development

WORKDIR /usr/app

COPY yarn.lock .
COPY package.json .
RUN apk update && apk add --no-cache g++ make python3 && rm -rf /var/cache/apk/*
RUN yarn install
COPY . ./

RUN yarn build

FROM node:20-alpine as prod
ENV NODE_ENV=production

WORKDIR /app

RUN apk update && apk add --no-cache g++ make python3 && rm -rf /var/cache/apk/*

COPY --from=dev /usr/app/ /app
COPY --from=dev /usr/app/package.json /app/
COPY --from=dev /usr/app/yarn.lock /app/

RUN yarn install && yarn cache clean -f

ENTRYPOINT ["yarn"]
