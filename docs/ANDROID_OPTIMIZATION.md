# Оптимизация размера Android APK

После `expo prebuild --platform android` примените эти настройки, чтобы уменьшить размер приложения (R8, удаление неиспользуемых ресурсов, только ARM).

### 1. `android/gradle.properties`

Добавьте или измените:

```properties
# R8 minification and resource shrinking
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true

# Only ARM (drop x86/x86_64 for emulator) — saves ~40–50% native lib size
reactNativeArchitectures=arm64-v8a,armeabi-v7a
```

### 2. `android/app/proguard-rules.pro`

Добавьте перед «Add any project specific keep options»:

```pro
# React Native / Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.** { *; }

# Expo
-keep class expo.modules.** { *; }
```

После этого пересоберите: `cd android && ./gradlew assembleRelease`.
