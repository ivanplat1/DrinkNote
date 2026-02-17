# Активация премиума в APK для друзей

## Способ 1: Через настройки приложения (рекомендуется)

После установки APK:

1. Откройте приложение
2. Перейдите в **Настройки** (иконка шестеренки)
3. Найдите кнопку **"Активировать Premium (Preview)"** под кнопкой "Премиум"
4. Нажмите на неё — премиум активируется сразу

## Способ 2: Через код (программно)

Если нужно активировать премиум программно (например, в скрипте установки):

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Активировать премиум
await AsyncStorage.setItem('preview_premium_enabled', 'true');
await AsyncStorage.setItem('premium_status_v1', 'true');
```

## Способ 3: Через ADB (для разработчиков)

Если у вас есть доступ к устройству через ADB:

```bash
adb shell "run-as com.drinknote.app sh -c 'echo -n true > /data/data/com.drinknote.app/files/preview_premium_enabled'"
```

Или через `adb shell` и затем:
```bash
run-as com.drinknote.app
echo -n true > /data/data/com.drinknote.app/files/preview_premium_enabled
```

## Важно

- Премиум активируется **локально** на устройстве
- При переустановке приложения премиум нужно активировать заново
- Это работает только в **preview сборках** (APK), не в production сборках из Google Play
- Для production сборок нужна реальная покупка через Google Play

## Проверка активации

После активации:
- В настройках должно быть написано **"Премиум активен"**
- Все премиум функции должны быть доступны
- Иконка короны должна быть золотой

## Отключение премиума

Если нужно отключить премиум:
- В настройках нажмите **"Отключить Premium (Preview)"**
- Или удалите данные приложения через настройки Android
