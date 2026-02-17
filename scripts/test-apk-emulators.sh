#!/bin/bash

# Скрипт для установки APK на все запущенные эмуляторы

APK_PATH="$1"

# Если путь не указан, попробовать найти APK автоматически
if [ -z "$APK_PATH" ]; then
  # Проверить downloads папку
  if [ -d "./downloads" ] && [ -n "$(find ./downloads -name "*.apk" -type f 2>/dev/null | head -1)" ]; then
    APK_PATH=$(find ./downloads -name "*.apk" -type f | head -1)
    echo "Found APK in downloads: $APK_PATH"
  # Проверить локальную сборку (release)
  elif [ -f "./android/app/build/outputs/apk/release/app-release.apk" ]; then
    APK_PATH="./android/app/build/outputs/apk/release/app-release.apk"
    echo "Found local release APK: $APK_PATH"
  # Проверить локальную сборку (debug)
  elif [ -f "./android/app/build/outputs/apk/debug/app-debug.apk" ]; then
    APK_PATH="./android/app/build/outputs/apk/debug/app-debug.apk"
    echo "Found local debug APK: $APK_PATH"
  else
    echo "Usage: ./scripts/test-apk-emulators.sh [path/to/app.apk]"
    echo ""
    echo "No APK found. Options:"
    echo "  1. Download from GitHub: ./scripts/download-apk-from-github.sh"
    echo "  2. Build locally: eas build --platform android --profile preview --local"
    echo "  3. Specify path manually: ./scripts/test-apk-emulators.sh path/to/app.apk"
    echo ""
    echo "Available emulators:"
    emulator -list-avds
    exit 1
  fi
fi

if [ ! -f "$APK_PATH" ]; then
  echo "Error: APK file not found: $APK_PATH"
  exit 1
fi

echo "Checking connected devices..."
DEVICES=$(adb devices | grep "device$" | cut -f1)

if [ -z "$DEVICES" ]; then
  echo "No devices connected. Starting emulators..."
  echo ""
  echo "Available emulators:"
  emulator -list-avds
  echo ""
  echo "To start an emulator, run:"
  echo "  emulator -avd Medium_Phone_API_36.1 &"
  echo "  emulator -avd Pixel_7 &"
  echo ""
  echo "Or start them from Android Studio: Device Manager → Play button"
  exit 1
fi

echo "Found devices:"
echo "$DEVICES"
echo ""

for device in $DEVICES; do
  echo "Installing APK on $device..."
  adb -s $device install -r "$APK_PATH"
  if [ $? -eq 0 ]; then
    echo "✓ Successfully installed on $device"
  else
    echo "✗ Failed to install on $device"
  fi
  echo ""
done

echo "Done! Check all emulators for the app."
echo ""
echo "To launch the app:"
echo "  adb shell am start -n com.drinknote.app/.MainActivity"
