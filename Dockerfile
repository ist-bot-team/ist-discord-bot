FROM node:lts-alpine3.13
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn
COPY ./dist ./dist
CMD [ "yarn", "start"]
