# Google Play — финальный релиз (AAB)

## Текущая версия в проекте

- **versionName:** `1.0.6`
- **versionCode:** `7` (каждый новый загруз в Play Console должен иметь **больший** `versionCode`)

### «0 поддерживаемых устройств» в отчёте о релизе

Часто это **артефакт сравнения черновика** с прошлым выпуском или **слишком новый `targetSdk`** в сгенерированном манифесте. В проекте через `expo-build-properties` зафиксированы **`compileSdkVersion` / `targetSdkVersion`: 35** (стабильнее для каталога Play, чем 36). Если предупреждение останется: откройте **App bundle explorer** → убедитесь, что есть сплиты по ABI; при ошибках **16 KB page size** обновите зависимости / NDK по [документации Google](https://developer.android.com/guide/practices/page-sizes).

## Где лежит AAB после локальной сборки

Сначала при необходимости сгенерируйте нативный проект (если папки `android/` ещё нет):

```bash
npx expo prebuild --platform android
```

Затем:

```bash
cd android && ./gradlew bundleRelease
```

Файл:

`android/app/build/outputs/bundle/release/app-release.aab`

**Примечание:** в этом репозитории папка `android/` в `.gitignore`. Версия для стора задаётся в `app.json` (`expo.version`, `expo.android.versionCode`); после `expo prebuild` они попадают в Gradle. Локальные правки в `android/app/build.gradle` (например, подпись через `keystore.properties`) при полном пересоздании нативки нужно проверить заново или собирать через **EAS** (`eas build --profile production`).

## Подпись для Play Console

Google Play **не принимает** релиз, подписанный **debug**-ключом.

1. **Рекомендуется:** настроить `android/keystore.properties` и положить keystore в `android/app/` — см. [ANDROID_RELEASE_SIGNING.md](./ANDROID_RELEASE_SIGNING.md) и `android/keystore.properties.example`.
2. **Альтернатива:** облачная сборка с подписью Expo:

   ```bash
   eas build --platform android --profile production
   ```

   Профиль `production` в `eas.json` собирает **app-bundle** (AAB).

## Тестовые покупки

Используйте **Internal / Closed testing** в Play Console, тестовые аккаунты в **License testing**, установку приложения **из Play** по ссылке трека (не через `adb install` обычного APK для полного цикла Billing).

Пошаговая настройка товара (Product ID `premium_lifetime`, разовая покупка): [GOOGLE_PLAY_IAP_PRODUCT.md](./GOOGLE_PLAY_IAP_PRODUCT.md).
