# Сборка приложения с виджетом (Android)

Виджет на главный экран работает только в нативной сборке (не в Expo Go). Ниже — как собрать приложение.

## Требование: Java 17

Android Gradle Plugin требует **Java 17**. Если сборка падает с ошибкой «You are currently using Java 13»:

1. **Установи JDK 17** (macOS, Homebrew):
   ```bash
   brew install openjdk@17
   sudo ln -sfn $(brew --prefix)/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
   ```

2. **Укажи Java 17 для сборки** (один из способов):
   - В терминале перед сборкой:
     ```bash
     export JAVA_HOME=$(/usr/libexec/java_home -v 17)
     npx expo run:android
     ```
   - Либо в `android/gradle.properties` раскомментируй строку с `org.gradle.java.home` и при необходимости поправь путь к JDK 17.

## Через EAS Build (рекомендуется)

1. Установи EAS CLI (если ещё нет):
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Собери Android-сборку. Плагин виджета подтянется при сборке (prebuild выполняется автоматически).

   **APK для установки вручную (проще для теста):**
   ```bash
   eas build --platform android --profile preview
   ```

   **Development build (с Expo Dev Client для отладки):**
   ```bash
   eas build --platform android --profile development
   ```

3. Скачай артефакт из [expo.dev](https://expo.dev) и установи на устройство или эмулятор.

4. Добавь виджет на главный экран: долгое нажатие по рабочему столу → Виджеты → DrinkNote → «Серия без алкоголя».

---

## Локальная сборка

1. Сгенерируй нативный проект (один раз или после смены плагинов):
   ```bash
   npx expo prebuild --platform android --clean
   ```

2. Собери и запусти через Android Studio или CLI:
   ```bash
   npx expo run:android
   ```
   Либо открой `android/` в Android Studio и собери проект оттуда.

Виджет будет доступен в списке виджетов после установки такого билда.
