#!/bin/bash

# Скрипт для запуска эмуляторов с разными размерами экранов

echo "Available emulators:"
emulator -list-avds
echo ""

# Запустить средний телефон
echo "Starting Medium_Phone_API_36.1..."
emulator -avd Medium_Phone_API_36.1 &
sleep 5

# Запустить Pixel 7
echo "Starting Pixel_7..."
emulator -avd Pixel_7 &
sleep 5

echo ""
echo "Waiting for emulators to boot..."
echo "Check status with: adb devices"
echo ""
echo "Once booted, install APK with:"
echo "  ./scripts/test-apk-emulators.sh path/to/app.apk"
