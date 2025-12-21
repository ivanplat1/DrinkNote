# Развертывание PWA на GitHub Pages

## Пошаговая инструкция

### Шаг 1: Соберите проект для продакшена

```bash
npm run build:web
```

Это создаст папку `dist` с готовыми файлами для продакшена.

### Шаг 2: Создайте репозиторий на GitHub

1. Перейдите на [GitHub.com](https://github.com)
2. Нажмите **"New repository"**
3. Назовите репозиторий (например, `drinknote-pwa`)
4. Выберите **Public** или **Private** (GitHub Pages работает с обоими типами)
   - **Public** — сайт будет доступен всем
   - **Private** — сайт будет доступен всем (но код репозитория приватный)
5. **НЕ** добавляйте README, .gitignore или лицензию
6. Нажмите **"Create repository"**

**Примечание:** GitHub Pages работает с приватными репозиториями. Разница только в том, что код репозитория будет приватным, но сам сайт все равно будет публично доступен по URL.

### Шаг 3: Инициализируйте Git в проекте (если еще не сделано)

```bash
# Если Git еще не инициализирован
git init

# Добавьте удаленный репозиторий
git remote add origin https://github.com/ВАШ_USERNAME/НАЗВАНИЕ_РЕПОЗИТОРИЯ.git
```

### Шаг 4: Настройте GitHub Pages

#### Вариант A: Репозиторий в корне (рекомендуется)

1. Создайте ветку `gh-pages`:
```bash
git checkout -b gh-pages
```

2. Скопируйте содержимое папки `dist` в корень проекта:
```bash
# Создайте временную папку
mkdir -p deploy-temp
cp -r dist/* deploy-temp/

# Переместите файлы в корень
mv deploy-temp/* .
rm -rf deploy-temp dist
```

3. Создайте `.gitignore` (если его нет):
```bash
echo "node_modules/" >> .gitignore
echo ".expo/" >> .gitignore
echo "dist/" >> .gitignore
```

4. Закоммитьте и отправьте:
```bash
git add .
git commit -m "Deploy PWA to GitHub Pages"
git push -u origin gh-pages
```

#### Вариант B: Использовать папку `dist` (альтернатива)

1. Создайте файл `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build:web
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

2. Закоммитьте и отправьте:
```bash
git add .
git commit -m "Add GitHub Pages deployment"
git push origin main
```

### Шаг 5: Включите GitHub Pages в настройках

1. Перейдите в репозиторий на GitHub
2. Нажмите **Settings** → **Pages**
3. В разделе **Source** выберите:
   - **Branch: gh-pages** (если использовали Вариант A)
   - Или **GitHub Actions** (если использовали Вариант B)
4. Нажмите **Save**

### Шаг 6: Дождитесь развертывания

GitHub Pages обычно развертывается за 1-2 минуты. После этого ваше приложение будет доступно по адресу:

```
https://ВАШ_USERNAME.github.io/НАЗВАНИЕ_РЕПОЗИТОРИЯ/
```

## Важные замечания

### Если репозиторий не в корне

Если ваш репозиторий называется `drinknote-pwa`, то URL будет:
```
https://ВАШ_USERNAME.github.io/drinknote-pwa/
```

В этом случае нужно обновить `start_url` в `manifest.json`:

```json
{
  "start_url": "/drinknote-pwa/",
  "scope": "/drinknote-pwa/"
}
```

И обновить скрипт `scripts/add-pwa-files.js` для автоматической подстановки правильного пути.

### Проверка PWA

После развертывания проверьте:
1. Откройте сайт в браузере
2. DevTools → Application → Manifest — должен быть виден манифест
3. DevTools → Application → Service Workers — должен быть зарегистрирован
4. Lighthouse → PWA — запустите аудит

## Обновление приложения

После изменений в коде:

```bash
# Соберите проект
npm run build:web

# Если используете Вариант A (ветка gh-pages)
git checkout gh-pages
cp -r dist/* .
git add .
git commit -m "Update PWA"
git push

# Если используете Вариант B (GitHub Actions)
git checkout main
git add .
git commit -m "Update PWA"
git push  # GitHub Actions автоматически развернет
```

## Проблемы и решения

### Проблема: Страница не загружается
- Проверьте, что ветка `gh-pages` существует
- Убедитесь, что GitHub Pages включен в настройках
- Подождите несколько минут (развертывание может занять время)

### Проблема: PWA не работает
- Убедитесь, что сайт открывается через HTTPS (GitHub Pages автоматически использует HTTPS)
- Проверьте, что `manifest.json` и `sw.js` доступны
- Проверьте консоль браузера на ошибки

### Проблема: Иконки не загружаются
- Проверьте пути к иконкам в `manifest.json`
- Убедитесь, что файлы иконок загружены в репозиторий

## Альтернатива: Использовать GitHub Actions (рекомендуется)

GitHub Actions автоматизирует процесс развертывания. Создайте файл `.github/workflows/deploy.yml` как показано выше в Варианте B.

