FROM node:16.6.1-alpine3.14
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn
COPY ./src/prisma/schema.prisma .
RUN yarn run prisma-gen
RUN yarn run prisma-mig
COPY ./dist ./dist
CMD [ "yarn", "start" ]
