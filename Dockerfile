FROM node:16.6.1-alpine3.14
ARG DATABASE_URL
ENV DATABASE_URL ${DATABASE_URL}
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn
COPY ./src/prisma/schema.prisma .
RUN yarn run prisma migrate deploy --schema=./schema.prisma
RUN yarn run prisma generate --schema=./schema.prisma
COPY ./dist ./dist
CMD [ "yarn", "start" ]
