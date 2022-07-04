FROM node:alpine as installer

RUN echo "$(printf '#!/usr/bin/env sh\necho "Python 3.0.0"')" > /usr/bin/python && chmod +x /usr/bin/python
# ^-- Workaround to bypass youtube-dl-exec's postinstall check for a supported python installation
COPY . /freyr
WORKDIR /freyr
RUN npm ci --only=production

FROM golang:alpine as prep

WORKDIR /
RUN apk add --no-cache git
RUN apk add --no-cache cmake
RUN apk add --no-cache g++
RUN apk add --no-cache make
RUN apk add --no-cache linux-headers

COPY --from=installer /freyr/node_modules /freyr/node_modules
RUN go install github.com/tj/node-prune@1159d4c
RUN node-prune /freyr/node_modules

RUN git clone --branch 20210715.151551.e7ad03a --depth 1 https://github.com/wez/atomicparsley
RUN cmake -S atomicparsley -B atomicparsley
RUN cmake --build atomicparsley --config Release

FROM node:alpine as base
COPY --from=installer /freyr /freyr
RUN rm -rf /freyr/node_modules
COPY --from=prep /freyr/node_modules /freyr/node_modules
COPY --from=prep atomicparsley/AtomicParsley /bin/AtomicParsley

RUN apk add --no-cache ffmpeg
RUN apk add --no-cache python3
RUN apk add --no-cache libstdc++

RUN addgroup -g 1001 freyr
RUN adduser -DG freyr freyr
RUN echo freyr:freyr | chpasswd

RUN mkdir /data
RUN chown -R freyr:freyr /freyr /data
WORKDIR /freyr
RUN npm link
USER freyr

WORKDIR /data
VOLUME /data

ENTRYPOINT ["freyr"]
CMD ["--help"]
