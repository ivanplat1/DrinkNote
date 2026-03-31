#!/bin/bash

# Установка/обновление APK на все подключённые устройства (эмуляторы + реальный телефон).
# Если путь не указан — ищет последний APK в downloads/, в сборке android/, или в текущей папке.

set -e

APK_PATH="$1"

if [ -z "$APK_PATH" ]; then
  candidates=()
  for dir in "./downloads" "./android/app/build/outputs/apk/release" "."; do
    [ ! -d "$dir" ] && continue
    while IFS= read -r -d '' f; do candidates+=("$f"); done < <(find "$dir" -maxdepth 3 -name "*.apk" -type f -print0 2>/dev/null)
  done
  if [ ${#candidates[@]} -gt 0 ]; then
    APK_PATH=$(ls -t "${candidates[@]}" 2>/dev/null | head -1)
    echo "Using latest APK: $APK_PATH"
  fi
fi

if [ -z "$APK_PATH" ] || [ ! -f "$APK_PATH" ]; then
  echo "Usage: ./scripts/install-apk.sh [path/to/app.apk]"
  echo ""
  echo "If path is omitted, looks for .apk in:"
  echo "  ./downloads/"
  echo "  ./android/app/build/outputs/apk/release/"
  echo "  . (current directory)"
  echo ""
  echo "Connect your phone (e.g. Redmi 14c) via USB with USB debugging enabled, then run this script."
  exit 1
fi

exec "$(dirname "$0")/test-apk-emulators.sh" "$APK_PATH"
