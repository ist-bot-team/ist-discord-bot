FROM node:16.6.1-alpine3.14 as ts-compiler
ARG DATABASE_URL
ENV DATABASE_URL ${DATABASE_URL}
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile
COPY ./ ./
RUN yarn run prisma generate
RUN yarn build

FROM node:16.6.1-alpine3.14
ARG DATABASE_URL
ENV DATABASE_URL ${DATABASE_URL}
WORKDIR /app
COPY --from=ts-compiler /app/package.json .
COPY --from=ts-compiler /app/yarn.lock .
COPY --from=ts-compiler /app/src/prisma ./src/prisma
COPY --from=ts-compiler /app/dist ./dist
RUN yarn install --prod --frozen-lockfile
RUN yarn run prisma generate
CMD [ "yarn", "start:docker" ]
