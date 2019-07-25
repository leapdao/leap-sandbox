FROM node:lts-alpine
ARG BUILD_DEPS="git g++ cmake make python2 bash"

WORKDIR /opt/leap-local-env

COPY . /opt/leap-local-env

RUN apk add --no-cache --update --virtual build_deps $BUILD_DEPS
RUN yarn
RUN yarn build

EXPOSE 7000
EXPOSE 8545

ENTRYPOINT ["yarn", "start"]
