#!/usr/bin/env bash

RG_SRC="$(which rg)"
rg() {
  printf 'rg: pattern: %s' "/$*/" > /dev/stderr
  if $RG_SRC --fixed-strings --passthru "$@"; then
    echo " (matched)" > /dev/stderr
  else
    echo " (failed to match)" > /dev/stderr
    return 1
  fi
}

freyr() {
  echo "::group::[$attempts/3] Downloading..."
  script -qfc "freyr $*" /dev/null | tee .freyr_log
  echo "::endgroup::"
  i=$($RG_SRC -n '.' .freyr_log | $RG_SRC --fixed-strings '[•] Embedding Metadata' | cut -d':' -f1)
  if [[ $i ]]; then
    echo "::group::[$attempts/3] View Download Status"
    tail +"$i" .freyr_log
    echo "::endgroup::"
  fi
}

exec_retry() {
  cmd="$(cat)" && attempts=1
  until eval "$cmd"; do
    echo "::endgroup::"
    if (( attempts < 3 )); then
      echo "::warning::[$attempts/3] Download failed, retrying.."
      : $(( attempts += 1 ))
    else
      echo "::error::[$attempts/3] Download failed."
      return 1
    fi
  done
  echo "::endgroup::"
  echo "::group::View Files"
  STAGE=$(realpath --relative-to=../.. .) && cd ../..
  tree -sh "$STAGE"
  echo "::endgroup::"
}

validate() {
  echo "::group::[$attempts/3] Verifying..."
  res=$(<.freyr_log)
  for arg in "[•] Collation Complete" "$@"; do
    res=$(echo "$res" | rg "$arg") || return 1
  done > /dev/null
}
