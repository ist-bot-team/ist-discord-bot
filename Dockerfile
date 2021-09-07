FROM node:16.6.1-alpine3.14
ARG DATABASE_URL
ENV DATABASE_URL ${DATABASE_URL}
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn
COPY ./src/prisma ./prisma
RUN yarn run prisma migrate deploy --schema=./prisma/schema.prisma
RUN yarn run prisma generate --schema=./prisma/schema.prisma
COPY ./dist ./dist
CMD [ "yarn", "start" ]
