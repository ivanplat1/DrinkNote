# Распространение приложения DrinkNote

## Android (APK)

### Вариант 1: EAS Build (рекомендуется)

1. **Установите EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Войдите в аккаунт Expo:**
   ```bash
   eas login
   ```

3. **Настройте проект:**
   ```bash
   eas build:configure
   ```

4. **Соберите APK для Android:**
   ```bash
   eas build --platform android --profile preview
   ```

5. **После сборки скачайте APK** и распространяйте напрямую:
   - Отправьте файл по email
   - Загрузите на свой сайт
   - Используйте QR-код для скачивания

### Вариант 2: Локальная сборка

1. **Установите Android Studio** и настройте Android SDK

2. **Соберите APK локально:**
   ```bash
   eas build --platform android --profile preview --local
   ```

3. **Или используйте Expo CLI:**
   ```bash
   npx expo build:android -t apk
   ```

## iOS (IPA)

⚠️ **Важно:** Для iOS нужен Apple Developer аккаунт ($99/год)

### Вариант 1: Ad Hoc Distribution

1. **Соберите IPA через EAS:**
   ```bash
   eas build --platform ios --profile preview
   ```

2. **Настройте app.json для Ad Hoc:**
   ```json
   {
     "expo": {
       "ios": {
         "bundleIdentifier": "com.yourcompany.drinknote"
       }
     }
   }
   ```

3. **Добавьте UDID устройств** в Apple Developer Portal

4. **Распространяйте IPA:**
   - Через TestFlight (до 10,000 тестеров)
   - Через прямую установку (до 100 устройств)

### Вариант 2: Enterprise Distribution

Требует Enterprise аккаунт ($299/год) - для корпоративного использования

## Настройка eas.json

Создайте файл `eas.json` в корне проекта:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": false
      }
    }
  }
}
```

## Обновление app.json

Добавьте в `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.drinknote"
    },
    "android": {
      "package": "com.yourcompany.drinknote",
      "permissions": []
    }
  }
}
```

## Распространение APK

После сборки APK можно:
- Загрузить на Google Drive/Dropbox и поделиться ссылкой
- Разместить на своем сайте
- Отправить по email
- Использовать QR-код для скачивания

⚠️ **Предупреждение:** Пользователям Android нужно разрешить установку из неизвестных источников

## Распространение IPA

Для iOS:
- TestFlight (бесплатно, до 10,000 тестеров)
- Прямая установка через Apple Configurator или через сайт с сертификатом

## Альтернативные способы

1. **F-Droid** (только Android, open-source)
2. **Sideloading** через ADB (Android)
3. **AltStore** (iOS, требует AltServer на компьютере)

