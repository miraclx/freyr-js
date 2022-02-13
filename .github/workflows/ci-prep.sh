RG_SRC="$(which rg)"
rg() {
  printf "rg: pattern: /$@/" > /dev/stderr
  $RG_SRC --fixed-strings --passthru "$@"
  if [[ $? == 0 ]]; then
    echo " (matched)" > /dev/stderr
  else
    echo " (failed to match)" > /dev/stderr
    return 1
  fi
}

freyr() {
  echo "::group::[$attempts/3] Downloading..."
  cmdline="freyr $@"
  script -qfc "$cmdline" /dev/null | tee .freyr_log
  echo "::endgroup::"
  i=$(cat .freyr_log | $RG_SRC -n '.' | $RG_SRC --fixed-strings '[•] Embedding Metadata' | cut -d':' -f1)
  if [[ $i ]]; then
    echo "::group::[$attempts/3] View Download Status"
    cat .freyr_log | tail +$i
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
  tree -sh $STAGE
  echo "::endgroup::"
}

validate() {
  echo "::group::[$attempts/3] Verifying..."
  res=$(cat .freyr_log)
  for arg in "[•] Collation Complete" "$@"; do
    res=$(echo "$res" | rg "$arg")
    if [[ $? != 0 ]]; then return 1; fi
  done > /dev/null
}
