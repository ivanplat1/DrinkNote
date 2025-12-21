# Решение проблемы с манифестом и Service Worker

## Проблема
В режиме разработки (`expo start --web`) манифест и Service Worker **не генерируются автоматически**. Они создаются только при сборке для продакшена.

## Решение

### Для разработки (локальное тестирование):

1. **Соберите проект для продакшена:**
```bash
npx expo export --platform web
```

2. **Добавьте PWA файлы автоматически:**
```bash
node scripts/add-pwa-files.js
```

Или используйте команду из package.json:
```bash
npm run build:web
```

3. **Запустите локальный сервер:**
```bash
cd dist
python3 -m http.server 8082
```

4. **Откройте в браузере:**
```
http://localhost:8082
```

### Проверка PWA:

1. Откройте Chrome DevTools (F12)
2. **Application → Manifest** — должен быть виден манифест
3. **Application → Service Workers** — должен быть зарегистрирован Service Worker
4. **Lighthouse → PWA** — запустите аудит

### Для продакшена:

После сборки (`npm run build:web`) папка `dist` будет содержать:
- ✅ `manifest.json` — манифест PWA
- ✅ `sw.js` — Service Worker
- ✅ `index.html` — с ссылками на манифест и регистрацией SW

Загрузите содержимое папки `dist` на любой веб-хостинг (Netlify, Vercel, GitHub Pages и т.д.)

## Важно:

- **HTTPS обязателен** для PWA (кроме localhost)
- Манифест и Service Worker работают только в собранной версии
- В режиме разработки (`expo start --web`) они недоступны

