#!/bin/sh

if [ "$DOCKER_DESKTOP" = "true" ]; then
  COLS=$(stty size 2>&- | cut -d" " -f2)
  (
    echo
    echo
    echo
    echo "┌────────────────────────────────────────────────────────────┐"
    echo "│      You are running freyr from inside Docker Desktop      │"
    echo "│  Click on the CLI button at the top right to access a CLI  │"
    echo "└────────────────────────────────────────────────────────────┘"
  ) | (
    while read -r line; do
      printf "%*s" "$(((COLS - ${#line}) / 2))" ""
      echo "$line"
    done
  )

  tail -f /dev/null
fi

node ${FREYR_NODE_ARGS[@]} -- "$(dirname "$0")"/cli.js "$@"
