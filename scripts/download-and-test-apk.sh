#!/bin/bash

# Комбинированный скрипт: скачать APK и установить на эмуляторы

BRANCH="${1:-feature/preview-premium-activation}"

echo "=== Step 1: Downloading APK from GitHub ==="
./scripts/download-apk-from-github.sh "$BRANCH"

if [ $? -ne 0 ]; then
  echo "Failed to download APK"
  exit 1
fi

echo ""
echo "=== Step 2: Checking emulators ==="
DEVICES=$(adb devices | grep "device$" | cut -f1)

if [ -z "$DEVICES" ]; then
  echo "No emulators running. Starting emulators..."
  ./scripts/start-emulators.sh
  
  echo ""
  echo "Waiting for emulators to boot (30 seconds)..."
  sleep 30
  
  DEVICES=$(adb devices | grep "device$" | cut -f1)
  if [ -z "$DEVICES" ]; then
    echo "Emulators not ready yet. Please wait and run:"
    echo "  ./scripts/test-apk-emulators.sh ./downloads/*.apk"
    exit 1
  fi
fi

echo ""
echo "=== Step 3: Installing APK on emulators ==="
APK_FILE=$(find ./downloads -name "*.apk" -type f | head -1)

if [ -z "$APK_FILE" ]; then
  echo "APK file not found in downloads folder"
  exit 1
fi

./scripts/test-apk-emulators.sh "$APK_FILE"

echo ""
echo "=== Done! ==="
echo "APK installed on all emulators. Check them now!"
