#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
export NIXOS_OZONE_WL=1
exec "$DIR/src-tauri/target/debug/streaming-app"
