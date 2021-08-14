FROM node:16.6.1-alpine3.14
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn
COPY ./dist ./dist
CMD [ "yarn", "start"]
