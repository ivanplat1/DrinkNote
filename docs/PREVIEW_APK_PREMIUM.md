# Локальная активация премиума (без Google Play)

Кнопка **«Активировать Premium (Preview)»** в настройках **убрана**: для тестов через **Google Play** (internal / closed / open testing) используйте реальные тестовые покупки.

Ниже — способы включить премиум **без магазина**, если нужно (например, APK «для друзей», установленный не из Play).

## Способ 1: Через AsyncStorage (программно)

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

await AsyncStorage.setItem('preview_premium_enabled', 'true');
await AsyncStorage.setItem('premium_status_v1', 'true');
```

См. также логику в `storage/premium.ts` (`PREVIEW_PREMIUM_KEY`).

## Способ 2: Через ADB (для разработчиков)

Если есть доступ к устройству через ADB — см. исторические команды в git или используйте `run-as` для записи ключей AsyncStorage (зависит от сборки).

## Важно

- Это **локальная** эмуляция премиума на устройстве.
- Для сборок из **Google Play** премиум проверяйте через **тестовые покупки** и **«Восстановить покупки»** на экране Премиум.
