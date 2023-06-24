FROM node:19.8.1-alpine3.16 as installer

COPY package.json yarn.lock /freyr/
WORKDIR /freyr
ARG YOUTUBE_DL_SKIP_PYTHON_CHECK=1
RUN yarn install --prod --frozen-lockfile

FROM golang:1.20.4-alpine3.16 as prep

# hadolint ignore=DL3018
RUN apk add --no-cache git g++ make cmake linux-headers
COPY --from=installer /freyr/node_modules /freyr/node_modules
RUN go install github.com/tj/node-prune@1159d4c \
  && node-prune --include '*.map' /freyr/node_modules \
  && node-prune /freyr/node_modules \
  # todo! revert to upstream when https://github.com/wez/atomicparsley/pull/63 is merged and a release is cut
  && git clone --branch 20230114.175602.21bde60 --depth 1 https://github.com/miraclx/atomicparsley /atomicparsley \
  && cmake -S /atomicparsley -B /atomicparsley \
  && cmake --build /atomicparsley --config Release

FROM alpine:3.17.3 as base

# hadolint ignore=DL3018
RUN apk add --no-cache bash nodejs python3 \
  && find /usr/lib/python3* \
  \( -type d -name __pycache__ -o -type f -name '*.whl' \) \
  -exec rm -r {} \+
COPY --from=prep /atomicparsley/AtomicParsley /bin/AtomicParsley

COPY . /freyr
COPY --from=prep /freyr/node_modules /freyr/node_modules

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

ENTRYPOINT ["/freyr/freyr.sh"]
CMD ["--help"]
