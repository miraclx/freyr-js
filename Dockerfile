FROM alpine:3.12.0
LABEL maintainer="Miraculous Owonubi <omiraculous@gmail.com>" \
  name="freyrcli" \
  version="latest" \
  tag="alpine"

# Install dependencies and clean cache
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

# bootstrap
RUN mkdir /bins && \
  # install atomicparsley
  wget -nv https://github.com/wez/atomicparsley/releases/download/20210715.151551.e7ad03a/AtomicParsleyAlpine.zip && \
  unzip -j AtomicParsleyAlpine.zip AtomicParsley -d /bins

ENV PATH "/bins:$PATH"

# Create freyr group. Then add root to freyr group.
RUN addgroup -g 1000 freyr \
  && addgroup root freyr \
  && mkdir /freyr \
  && chown :freyr /freyr

# Stage and install freyr
COPY . /freyr
RUN npm install --global --unsafe-perm /freyr \
  && npm cache clean --force

# Set and mount workdir
WORKDIR /data
VOLUME ["/data"]

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
