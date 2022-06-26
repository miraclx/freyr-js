FROM alpine:3.16.0
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
  cmake \
  gcc \
  g++ \
  make \
  linux-headers \
  && ln /usr/bin/python3 /usr/bin/python \
  && find /usr/lib/python3* -type d -name __pycache__ -exec rm -r {} \+

# install atomicparsley
# clones and checkouts to latest stable tag...
# ... then compiles and moves the binary to bins directory
RUN mkdir /bins \
  && git clone https://github.com/wez/atomicparsley \
  && cd atomicparsley \
  && git fetch --tags \
  && latestTag=$(git describe --tags `git rev-list --tags --max-count=1`) \
  && git checkout $latestTag \
  && cmake . \
  && cmake --build . --config Release \
  && mv AtomicParsley /bins \
  && cd .. \
  && rm -r atomicparsley
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
