# Troubleshooting Guide

## Проблемы с иконками в Android эмуляторе

Если иконки не загружаются или отображаются неправильно:

### Решение 1: Очистка кэша Metro Bundler
```bash
# Остановите Metro bundler (Ctrl+C)
# Затем запустите с очисткой кэша:
npx expo start --clear

# Или для Android:
npx expo start --android --clear
```

### Решение 2: Очистка кэша приложения на эмуляторе
1. Откройте Settings на эмуляторе
2. Apps → DrinkNote
3. Storage → Clear Cache
4. Перезапустите приложение

### Решение 3: Перезапуск эмулятора
```bash
# Закройте эмулятор полностью
# Перезапустите:
emulator -avd <имя_эмулятора>

# Или через Android Studio
```

### Решение 4: Пересборка приложения
```bash
# Очистите node_modules и переустановите
rm -rf node_modules
npm install

# Перезапустите с очисткой кэша
npx expo start --clear
```

### Решение 5: Проверка версии @expo/vector-icons
```bash
npm list @expo/vector-icons
# Должна быть версия ^15.0.3
```

## Примечания

- `@expo/vector-icons` использует встроенные шрифты иконок
- Иконки должны загружаться автоматически при первом использовании
- Проблемы обычно связаны с кэшированием Metro bundler или эмулятора
- В production-сборке иконки всегда работают корректно
