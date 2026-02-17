#!/bin/bash

# Скрипт для установки APK на все запущенные эмуляторы

APK_PATH="$1"

if [ -z "$APK_PATH" ]; then
  echo "Usage: ./scripts/test-apk-emulators.sh path/to/app.apk"
  echo ""
  echo "Available emulators:"
  emulator -list-avds
  exit 1
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
