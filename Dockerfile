FROM node:18.5.0-alpine3.16 as installer

RUN printf '#!/usr/bin/env sh\necho "Python 3.0.0"\n' > /usr/bin/python && chmod +x /usr/bin/python
# ^-- Workaround to bypass youtube-dl-exec's postinstall check for a supported python installation
COPY . /freyr
WORKDIR /freyr
RUN yarn install --prod --frozen-lockfile \
  && rm -r media

FROM golang:1.18.3-alpine3.16 as prep

# hadolint ignore=DL3018
RUN apk add --no-cache git g++ make cmake linux-headers
COPY --from=installer /freyr/node_modules /freyr/node_modules
RUN go install github.com/tj/node-prune@1159d4c \
  && node-prune --include '*.map' /freyr/node_modules \
  && node-prune /freyr/node_modules \
  && git clone --branch 20210715.151551.e7ad03a --depth 1 https://github.com/wez/atomicparsley /atomicparsley \
  && cmake -S /atomicparsley -B /atomicparsley \
  && cmake --build /atomicparsley --config Release

FROM alpine:3.16.0 as base

# hadolint ignore=DL3018
RUN apk add --no-cache nodejs ffmpeg python3 libstdc++ \
  && ln /usr/bin/python3 /usr/bin/python \
  && find /usr/lib/python3* \
      \( -type d -name __pycache__ -o -type f -name '*.whl' \) \
      -exec rm -r {} \+
COPY --from=installer /freyr /freyr
RUN rm -rf /freyr/node_modules
COPY --from=prep /freyr/node_modules /freyr/node_modules
COPY --from=prep /atomicparsley/AtomicParsley /bin/AtomicParsley

# hadolint ignore=DL4006
RUN addgroup -g 1000 freyr \
  && adduser -DG freyr freyr \
  && echo freyr:freyr | chpasswd \
  && ln -s /freyr/cli.js /bin/freyr \
  && mkdir /data \
  && chown -R freyr:freyr /freyr /data
WORKDIR /freyr
USER freyr

WORKDIR /data
VOLUME /data

ENTRYPOINT ["freyr"]
CMD ["--help"]
