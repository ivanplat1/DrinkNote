># Решение проблемы "There isn't a GitHub Pages site here"

## Возможные причины и решения

### 1. GitHub Pages не включен в настройках

**Решение:**
1. Перейдите в репозиторий на GitHub
2. Нажмите **Settings** → **Pages**
3. В разделе **Source** выберите:
   - **Deploy from a branch** → выберите ветку `gh-pages` и папку `/ (root)`
   - ИЛИ **GitHub Actions** (если используете автоматическое развертывание)
4. Нажмите **Save**

### 2. GitHub Actions workflow не запустился

**Проверьте:**
1. Перейдите в репозиторий → вкладка **Actions**
2. Если видите workflow "Deploy PWA to GitHub Pages" — проверьте его статус
3. Если workflow не запустился — возможно, нужно сделать push в ветку `main` или `master`

**Решение:**
```bash
# Убедитесь, что вы в правильной ветке
git branch

# Если не в main/master, переключитесь
git checkout main

# Сделайте push
git push origin main
```

### 3. Ветка gh-pages не создана (для ручного развертывания)

**Решение:**
```bash
# Соберите проект
npm run build:web

# Создайте ветку gh-pages
git checkout -b gh-pages

# Скопируйте файлы из dist в корень
cp -r dist/* .

# Удалите папку dist (чтобы не загружать ее)
rm -rf dist

# Закоммитьте
git add .
git commit -m "Deploy to GitHub Pages"

# Отправьте ветку
git push -u origin gh-pages

# Вернитесь в main
git checkout main
```

### 4. Файлы не загружены в репозиторий

**Проверьте:**
```bash
# Проверьте, что файлы закоммичены
git status

# Если есть незакоммиченные изменения
git add .
git commit -m "Add files for GitHub Pages"
git push
```

### 5. Неправильная структура файлов

**Для GitHub Actions:**
- Файлы должны быть в папке `dist/`
- Workflow должен публиковать из `./dist`

**Для ручного развертывания:**
- Файлы должны быть в корне ветки `gh-pages`
- Должны быть: `index.html`, `manifest.json`, `sw.js`, папка `_expo/`, папка `assets/`

## Пошаговая проверка

### Шаг 1: Проверьте настройки GitHub Pages

1. Откройте репозиторий на GitHub
2. Settings → Pages
3. Убедитесь, что выбрана правильная ветка/источник

### Шаг 2: Проверьте Actions (если используете автоматическое развертывание)

1. Вкладка **Actions** в репозитории
2. Найдите workflow "Deploy PWA to GitHub Pages"
3. Проверьте, что он завершился успешно (зеленая галочка)

### Шаг 3: Проверьте ветку gh-pages (если используете ручное развертывание)

1. Перейдите в репозиторий → вкладка **Branches**
2. Убедитесь, что ветка `gh-pages` существует
3. Переключитесь на ветку `gh-pages` и проверьте наличие файлов

### Шаг 4: Подождите

GitHub Pages может развертываться до 10 минут. Подождите и обновите страницу.

## Быстрое решение

Если ничего не помогает, попробуйте полный сброс:

```bash
# 1. Соберите проект
npm run build:web

# 2. Создайте/переключитесь на gh-pages
git checkout -b gh-pages 2>/dev/null || git checkout gh-pages

# 3. Удалите все файлы (кроме .git)
git rm -rf . --ignore-unmatch

# 4. Скопируйте файлы из dist
cp -r dist/* .

# 5. Закоммитьте
git add .
git commit -m "Deploy PWA to GitHub Pages"
git push -u origin gh-pages --force

# 6. Вернитесь в main
git checkout main
```

Затем в настройках GitHub Pages выберите ветку `gh-pages` и папку `/ (root)`.

## Проверка после развертывания

После настройки подождите 1-2 минуты и проверьте:
- URL: `https://ВАШ_USERNAME.github.io/НАЗВАНИЕ_РЕПОЗИТОРИЯ/`
- Должен открываться сайт, а не страница ошибки


