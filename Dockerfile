FROM node:16.6.1-alpine3.14

# needed to build better-sqlite3
RUN apk add --update --no-cache python3 make gcc libc-dev g++
RUN ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn
COPY ./dist ./dist
CMD [ "yarn", "start" ]
