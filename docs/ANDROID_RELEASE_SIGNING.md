# Подпись release AAB для Google Play

Google Play принимает только AAB/APK, подписанные **release-ключом**. Подпись отладкой (debug) не допускается.

## Вариант 1: EAS Build (платно)

Сборка в облаке Expo подписывает AAB вашим ключом. Если первый релиз собирали так, ключ хранится в аккаунте Expo.

## Скачать ключ из EAS и собирать локально (бесплатно)

Если первый AAB собирали через EAS, ключ уже есть в Expo. Его можно **один раз скачать** и дальше собирать AAB локально, без платных сборок.

1. **Скачать учётные данные с EAS:**
   ```bash
   eas credentials
   ```
   Выберите **Android** → **Credentials.json** → **Download credentials from EAS to credentials.json**. В проекте появится `credentials.json` и (при выборе скачивания keystore) файл keystore (например `keystore.jks`).

2. **Положить keystore в проект** (не коммитить): например `android/app/release.jks` или `android/app/upload-keystore.jks`.

3. **Настроить `android/keystore.properties`** по данным из `credentials.json`:
   - `storeFile` — имя файла keystore в `android/app/` (например `release.jks`)
   - `storePassword` и `keyPassword` — из credentials
   - `keyAlias` — из credentials (часто `upload` или `key0`)

4. **Собирать AAB локально:**
   ```bash
   cd android && ./gradlew bundleRelease
   ```
   AAB будет подписан тем же ключом, что и при первой загрузке в Play. Дальше можно не использовать EAS Build.

---

## Вариант 2: Локальная сборка AAB с своим ключом

Если вы собираете AAB локально (`./gradlew bundleRelease`), нужен свой keystore и конфиг.

### 1. Создать keystore (один раз)

Из папки проекта:

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias drinknote -keyalg RSA -keysize 2048 -validity 10000
```

Укажите пароли и данные (имя, организация и т.д.). **Пароли и файл `release.keystore` храните в надёжном месте** — без них нельзя обновлять приложение в Play.

### 2. Создать `android/keystore.properties`

Скопируйте пример и подставьте свои пароли:

```bash
cp android/keystore.properties.example android/keystore.properties
```

Отредактируйте `android/keystore.properties`:

```properties
storeFile=release.keystore
storePassword=ВАШ_ПАРОЛЬ_ХРАНИЛИЩА
keyAlias=drinknote
keyPassword=ВАШ_ПАРОЛЬ_КЛЮЧА
```

Файлы `keystore.properties` и `release.keystore` в репозиторий **не коммитить** (они уже в `.gitignore`).

### 3. Собрать AAB

```bash
cd android && ./gradlew bundleRelease
```

AAB будет в: `android/app/build/outputs/bundle/release/app-release.aab`. Его можно загружать в Google Play Console.

---

## Ошибка «подписан с помощью неправильного ключа»

Play Console показывает ожидаемый отпечаток ключа, например:
**SHA1: 55:13:89:20:96:2F:AA:CD:1D:1F:10:59:6B:31:17:52:99:67:B4:EB**

Это ключ, которым был подписан **первый** загруженный AAB. Все последующие релизы должны подписываться **тем же ключом**.

### Что делать

1. **Если первый AAB собирали через EAS Build** — собирайте и этот релиз через EAS, тогда подпись будет правильной:
   ```bash
   eas build --platform android --profile production
   ```
   Скачайте AAB с expo.dev и загрузите в Play.

2. **Если первый AAB подписывали своим keystore** — при локальной сборке в `android/keystore.properties` должен быть указан **тот же** файл keystore (и тот же alias). Проверить отпечаток своего ключа:
   ```bash
   keytool -list -v -keystore android/app/release.keystore -alias drinknote
   ```
   В выводе найдите **SHA1** — он должен совпадать с тем, что указывает Play (55:13:89:...). Если совпадает, сборка с этим keystore подойдёт. Если нет — нужен тот файл/ключ, которым подписывали самый первый релиз.

3. **Если правильный keystore потерян** — новый ключ Play не примет. Варианты: восстановить keystore из бэкапа или использовать EAS (если первый релиз был через EAS — ключ хранится в аккаунте Expo).

---

## Если уже загружали release AAB

После первой загрузки **release** AAB в Play Console включите **Google Play App Signing**. Все следующие обновления должны быть подписаны тем же ключом (или загруженным в Play ключом). Менять ключ после первой публикации нельзя без потери возможности обновлять приложение.

---

## Play Billing и Android 14

В проекте принудительно используется **Play Billing 5.2.1** (в `android/build.gradle`), так как `expo-in-app-purchases` по умолчанию тянет 4.0.0, что не принимает Google Play (Android 14 и новые требования к монетизации). Применяется патч `patches/expo-in-app-purchases+14.5.0.patch`, убирающий вызов `setVrPurchaseFlow`, удалённый в Billing 5.x.

---

## Предупреждение про файл деобфускации (mapping)

Если в консоли Play отображается предупреждение «С типом App Bundle не связан ни один файл деобфускации»:

- По умолчанию в проекте **R8 minify выключен** (`android.enableMinifyInReleaseBuilds=false`), поэтому mapping-файл не создаётся — предупреждение можно игнорировать.
- Если включите минификацию (в `gradle.properties`: `android.enableMinifyInReleaseBuilds=true`), после сборки AAB появится файл  
  `android/app/build/outputs/mapping/release/mapping.txt`.  
  Его нужно загрузить в Play Console: приложение → Релизы → выберите нужный релиз → вкладка «Сведения об приложении» / «App bundle explorer» → загрузить mapping file для данного AAB.
