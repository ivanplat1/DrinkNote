# Авторизация GitHub CLI

## Способ 1: Через браузер (обычный)

```bash
gh auth login
```

Процесс:
1. Выберите `GitHub.com`
2. Выберите `HTTPS`
3. Выберите `Login with a web browser`
4. **Код появится в терминале** (не придет на устройство!)
5. Скопируйте код из терминала
6. Браузер откроется автоматически (или откройте ссылку вручную)
7. Введите код на странице GitHub

## Способ 2: Через токен (если браузер не работает)

1. **Создайте токен на GitHub:**
   - Перейдите: https://github.com/settings/tokens
   - Нажмите **"Generate new token"** → **"Generate new token (classic)"**
   - Название: `gh-cli`
   - Выберите права: `repo`, `read:org`, `workflow`
   - Нажмите **"Generate token"**
   - **Скопируйте токен** (он показывается только один раз!)

2. **Авторизуйтесь через токен:**
   ```bash
   echo "ВАШ_ТОКЕН" | gh auth login --with-token
   ```

   Или интерактивно:
   ```bash
   gh auth login --with-token
   # Вставьте токен и нажмите Enter
   ```

## Способ 3: Через переменную окружения

```bash
export GH_TOKEN="ваш_токен"
gh auth status
```

## Проверка авторизации

```bash
gh auth status
```

Должно показать:
```
✓ Logged in to github.com as YOUR_USERNAME
```

## Если код не виден в терминале

При `gh auth login --web` код показывается прямо в терминале, например:

```
! First copy your one-time code: ABCD-1234
Press Enter to open github.com in your browser...
```

Если код не виден:
1. Проверьте весь вывод в терминале
2. Попробуйте запустить с `--clipboard`:
   ```bash
   gh auth login --web --clipboard
   ```
   Код будет скопирован в буфер обмена

3. Или используйте токен (способ 2 выше)
