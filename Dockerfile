FROM alpine:3.15.0
LABEL maintainer="Miraculous Owonubi <omiraculous@gmail.com>" \
  name="freyrcli" \
  version="latest" \
  tag="alpine"

# Install dependencies and clean cache
# hadolint ignore=DL3018
RUN apk add \
  --no-cache \
  git \
  libstdc++ \
  npm \
  nodejs \
  python3 \
  ffmpeg \
  bash \
  which \
  && ln /usr/bin/python3 /usr/bin/python \
  && find /usr/lib/python3* -type d -name __pycache__ -exec rm -r {} \+

# install atomicparsley
RUN mkdir /bins \
  && wget -nv https://github.com/wez/atomicparsley/releases/download/20210715.151551.e7ad03a/AtomicParsleyAlpine.zip \
  && unzip -j AtomicParsleyAlpine.zip AtomicParsley -d /bins \
  && rm -v AtomicParsleyAlpine.zip
ENV PATH "/bins:$PATH"

# Create freyr user and group
# hadolint ignore=DL4006
RUN addgroup -g 1000 freyr \
  && adduser -DG freyr freyr \
  && echo freyr:freyr | chpasswd

# Stage and install freyr
COPY . /freyr
WORKDIR /freyr
RUN npm ci \
  && npm link \
  && npm cache clean --force \
  && mkdir /data \
  && chown -R freyr:freyr /freyr /data

# Set and mount workdir
USER freyr
WORKDIR /data
VOLUME /data

# Set entrypoint and default cmd
ENTRYPOINT ["freyr"]
CMD ["--help"]

# BUILD
# > git clone https://github.com/miraclx/freyr-js freyr
# > docker build -t freyr:alpine freyr

# LAUNCH (freyr)
# > docker run --rm -v $PWD:/data freyr:alpine
# LAUNCH (bash)
# > docker run -itv $PWD:/data --entrypoint bash freyr:alpine
