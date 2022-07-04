FROM node:alpine as installer

RUN printf '#!/usr/bin/env sh\necho "Python 3.0.0"\n' > /usr/bin/python && chmod +x /usr/bin/python
# ^-- Workaround to bypass youtube-dl-exec's postinstall check for a supported python installation
COPY . /freyr
RUN cd /freyr && npm ci --only=production

FROM golang:alpine as prep

WORKDIR /
RUN apk add --no-cache git g++ make cmake linux-headers
COPY --from=installer /freyr/node_modules /freyr/node_modules
RUN go install github.com/tj/node-prune@1159d4c \
  && node-prune /freyr/node_modules \
  && git clone --branch 20210715.151551.e7ad03a --depth 1 https://github.com/wez/atomicparsley \
  && cmake -S atomicparsley -B atomicparsley \
  && cmake --build atomicparsley --config Release

FROM node:alpine as base

RUN apk add --no-cache ffmpeg python3 libstdc++
COPY --from=installer /freyr /freyr
RUN rm -rf /freyr/node_modules
COPY --from=prep /freyr/node_modules /freyr/node_modules
COPY --from=prep /atomicparsley/AtomicParsley /bin/AtomicParsley

WORKDIR /freyr
RUN addgroup -g 1001 freyr \
  && adduser -DG freyr freyr \
  && echo freyr:freyr | chpasswd \
  && npm link \
  && mkdir /data \
  && chown -R freyr:freyr /freyr /data
USER freyr

WORKDIR /data
VOLUME /data

ENTRYPOINT ["freyr"]
CMD ["--help"]
