# Тестирование APK на Android эмуляторах с разными размерами экранов

## Быстрый старт

У вас уже есть эмуляторы:
- `Medium_Phone_API_36.1` - средний телефон
- `Pixel_7` - современный телефон

### Автоматическое скачивание и тестирование APK:

**Вариант 1: Полностью автоматически (рекомендуется)**

```bash
# Скачать APK из GitHub Actions и установить на эмуляторы
./scripts/download-and-test-apk.sh feature/preview-premium-activation
```

Этот скрипт:
1. Скачает последний APK из GitHub Actions в `./downloads/`
2. Запустит эмуляторы (если не запущены)
3. Установит APK на все эмуляторы

**Вариант 2: Только скачать APK**

```bash
# Скачать APK из GitHub Actions
./scripts/download-apk-from-github.sh feature/preview-premium-activation
```

APK будет сохранен в `./downloads/`

**Вариант 3: Пошагово вручную**

1. **Запустить эмуляторы:**
   ```bash
   ./scripts/start-emulators.sh
   ```
   Или вручную:
   ```bash
   emulator -avd Medium_Phone_API_36.1 &
   emulator -avd Pixel_7 &
   ```

2. **Дождаться загрузки** (проверить: `adb devices`)

3. **Установить APK на все эмуляторы:**
   ```bash
   ./scripts/test-apk-emulators.sh path/to/app-release-unsigned.apk
   ```

## Шаг 1: Проверка доступных эмуляторов

```bash
emulator -list-avds
```

Если эмуляторов нет, создайте их через Android Studio или командной строкой.

## Шаг 2: Создание эмуляторов с разными размерами экранов

### Вариант A: Через Android Studio (проще)

1. Откройте **Android Studio**
2. **Tools** → **Device Manager**
3. Нажмите **"Create Device"**
4. Выберите устройства с разными размерами:

   **Маленький экран (Phone):**
   - Pixel 3a (5.6", 1080x2220)
   - Или создайте кастомный: 4.7", 720x1280

   **Средний экран (Phone):**
   - Pixel 5 (6.0", 1080x2340)
   - Или Pixel 6 (6.4", 1080x2400)

   **Большой экран (Tablet):**
   - Pixel Tablet (10.95", 2560x1600)
   - Или Nexus 10 (10.1", 2560x1600)

5. Выберите **System Image** (рекомендуется API 33 или 34)
6. Завершите создание

### Вариант B: Через командную строку

```bash
# Список доступных системных образов
sdkmanager --list | grep "system-images"

# Создать эмулятор для маленького экрана
avdmanager create avd -n "phone_small" -k "system-images;android-33;google_apis;arm64-v8a" -d "pixel_3a"

# Создать эмулятор для среднего экрана
avdmanager create avd -n "phone_medium" -k "system-images;android-33;google_apis;arm64-v8a" -d "pixel_5"

# Создать эмулятор для большого экрана (планшет)
avdmanager create avd -n "tablet_large" -k "system-images;android-33;google_apis;arm64-v8a" -d "pixel_tablet"
```

## Шаг 3: Запуск эмулятора

```bash
# Запустить конкретный эмулятор
emulator -avd phone_small &

# Или через Android Studio: Device Manager → Play button
```

## Шаг 4: Установка APK на эмулятор

### Способ 1: Через ADB (рекомендуется)

```bash
# Проверить подключенные устройства
adb devices

# Установить APK
adb install path/to/app-release-unsigned.apk

# Или если нужно переустановить
adb install -r path/to/app-release-unsigned.apk
```

### Способ 2: Перетащить APK в эмулятор

1. Запустите эмулятор
2. Перетащите APK файл в окно эмулятора
3. Следуйте инструкциям на экране

## Шаг 5: Тестирование на разных эмуляторах

### Быстрое переключение между эмуляторами

```bash
# Список запущенных эмуляторов
adb devices

# Установить APK на все подключенные устройства
for device in $(adb devices | grep "device$" | cut -f1); do
  echo "Installing on $device..."
  adb -s $device install -r path/to/app-release-unsigned.apk
done
```

## Шаг 6: Проверка на разных размерах экранов

После установки проверьте:

1. **Иконка приложения** — отображается ли на рабочем столе
2. **Череп в календаре** — правильно ли центрирован
3. **Названия месяцев** — влазят ли в базовой статистике
4. **Адаптивность UI** — все элементы видны на разных размерах
5. **Премиум активация** — работает ли кнопка в настройках

## Полезные команды

```bash
# Перезапустить приложение
adb shell am force-stop com.drinknote.app
adb shell am start -n com.drinknote.app/.MainActivity

# Очистить данные приложения (для тестирования премиума)
adb shell pm clear com.drinknote.app

# Сделать скриншот
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png

# Посмотреть логи
adb logcat | grep -i drinknote
```

## Рекомендуемые размеры экранов для тестирования

| Устройство | Размер экрана | Разрешение | Плотность |
|------------|---------------|------------|-----------|
| Pixel 3a | 5.6" | 1080x2220 | 440 dpi |
| Pixel 5 | 6.0" | 1080x2340 | 432 dpi |
| Pixel 6 Pro | 6.7" | 1440x3120 | 512 dpi |
| Pixel Tablet | 10.95" | 2560x1600 | 320 dpi |

## Автоматизация тестирования

Создайте скрипт `test-apk.sh`:

```bash
#!/bin/bash
APK_PATH="$1"

if [ -z "$APK_PATH" ]; then
  echo "Usage: ./test-apk.sh path/to/app.apk"
  exit 1
fi

echo "Installing APK on all connected devices..."
for device in $(adb devices | grep "device$" | cut -f1); do
  echo "Installing on $device..."
  adb -s $device install -r "$APK_PATH"
done

echo "Done! Check all emulators for the app."
```

Использование:
```bash
chmod +x test-apk.sh
./test-apk.sh app-release-unsigned.apk
```
