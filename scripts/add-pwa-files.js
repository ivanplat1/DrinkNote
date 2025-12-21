#!/usr/bin/env node

/**
 * Скрипт для добавления PWA файлов (manifest.json и sw.js) после сборки
 * Запускать после: npx expo export --platform web
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(distDir)) {
  console.error('❌ Папка dist не найдена. Сначала выполните: npx expo export --platform web');
  process.exit(1);
}

// Копируем иконки для PWA
const assetsDir = path.join(__dirname, '..', 'assets');
const distAssetsDir = path.join(distDir, 'assets');
const iconPath = path.join(assetsDir, 'icon.png');
const faviconPath = path.join(assetsDir, 'favicon.png');

// Создаем папку для иконок если её нет
if (!fs.existsSync(distAssetsDir)) {
  fs.mkdirSync(distAssetsDir, { recursive: true });
}

// Копируем иконки
const icons = [];
if (fs.existsSync(iconPath)) {
  // Копируем основную иконку
  const icon192Path = path.join(distAssetsDir, 'icon-192.png');
  const icon512Path = path.join(distAssetsDir, 'icon-512.png');
  
  // Используем sips (macOS) или convert (ImageMagick) для изменения размера
  const { execSync } = require('child_process');
  
  try {
    // Пробуем использовать sips (macOS)
    execSync(`sips -z 192 192 "${iconPath}" --out "${icon192Path}"`, { stdio: 'ignore' });
    execSync(`sips -z 512 512 "${iconPath}" --out "${icon512Path}"`, { stdio: 'ignore' });
  } catch (e) {
    // Если sips не работает, пробуем ImageMagick
    try {
      execSync(`convert "${iconPath}" -resize 192x192 "${icon192Path}"`, { stdio: 'ignore' });
      execSync(`convert "${iconPath}" -resize 512x512 "${icon512Path}"`, { stdio: 'ignore' });
    } catch (e2) {
      // Если ничего не работает, просто копируем
      fs.copyFileSync(iconPath, icon192Path);
      fs.copyFileSync(iconPath, icon512Path);
    }
  }
  
  icons.push(
    {
      src: '/assets/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: '/assets/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any'
    }
  );
}

// Добавляем favicon если есть
if (fs.existsSync(faviconPath)) {
  const faviconDest = path.join(distAssetsDir, 'favicon.png');
  fs.copyFileSync(faviconPath, faviconDest);
  icons.push({
    src: '/assets/favicon.png',
    sizes: '48x48',
    type: 'image/png'
  });
}

// Создаем manifest.json
const manifest = {
  name: 'DrinkNote',
  short_name: 'DrinkNote',
  description: 'Трекер потребления алкоголя',
  start_url: '/',
  display: 'standalone',
  background_color: '#000000',
  theme_color: '#1a1a1a',
  orientation: 'portrait',
  scope: '/',
  icons: icons.length > 0 ? icons : [
    {
      src: '/favicon.ico',
      sizes: '64x64 32x32 24x24 16x16',
      type: 'image/x-icon'
    }
  ]
};

fs.writeFileSync(
  path.join(distDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);
console.log('✅ Создан manifest.json');

// Создаем Service Worker
const swContent = `// Service Worker для DrinkNote PWA
const CACHE_NAME = 'drinknote-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache).catch((err) => {
          console.log('Cache addAll failed:', err);
        });
      })
  );
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Перехват запросов для офлайн-режима
self.addEventListener('fetch', (event) => {
  // Пропускаем не-GET запросы
  if (event.request.method !== 'GET') {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // Пропускаем запросы к Service Worker и манифесту
  if (url.pathname.includes('/sw.js') || url.pathname.includes('/manifest.json')) {
    return;
  }
  
  // Пропускаем запросы к статическим ресурсам (шрифты, изображения) - пусть проходят напрямую
  // Это предотвращает ошибки 503/404 для файлов, которые могут не существовать
  const staticExtensions = ['.ttf', '.woff', '.woff2', '.eot', '.otf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];
  const isStaticResource = staticExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext));
  
  if (isStaticResource) {
    // Для статических ресурсов НЕ перехватываем запросы - пусть проходят напрямую к серверу
    // Это позволяет браузеру обрабатывать 404 естественным образом
    return;
  }
  
  // Для остальных запросов используем стратегию "сеть сначала, потом кэш"
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если запрос успешен, кэшируем его
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {
              // Игнорируем ошибки кэширования
            });
          });
        }
        return response;
      })
      .catch(() => {
        // Если сеть недоступна, пробуем кэш
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Если это запрос документа и нет в кэше, возвращаем index.html
          if (event.request.destination === 'document' || event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          
          // Для других запросов возвращаем пустой ответ
          return new Response('', { status: 404 });
        });
      })
  );
});
`;

fs.writeFileSync(path.join(distDir, 'sw.js'), swContent);
console.log('✅ Создан sw.js');

// Обновляем index.html
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Исправляем абсолютные пути для GitHub Pages с префиксом /DrinkNote/
  // Заменяем пути к ресурсам, начинающиеся с "/" на пути с префиксом /DrinkNote/
  html = html.replace(/href="\/([^\/"][^"]*)"/g, (match, path) => {
    return `href="/DrinkNote/${path}"`;
  });
  html = html.replace(/src="\/([^\/"][^"]*)"/g, (match, path) => {
    return `src="/DrinkNote/${path}"`;
  });
  
  // Проверяем, не добавлены ли уже теги
  if (!html.includes('manifest.json')) {
    // Добавляем ссылку на манифест перед закрывающим тегом head
    html = html.replace(
      /<\/head>/,
      '  <link rel="manifest" href="/DrinkNote/manifest.json" />\n</head>'
    );
  }
  
  if (!html.includes('sw.js')) {
    // Добавляем регистрацию Service Worker и исправление путей перед закрывающим тегом body
    const swScript = `
<script>
  // Исправляем пути к ресурсам для GitHub Pages
  (function() {
    function fixPath(url) {
      if (typeof url !== 'string') return url;
      // Исправляем полные URL (разные варианты)
      url = url.replace(/https:\\/\\/ivanplat1\\.github\\.io\\/assets\\/node_modules\\//g, 'https://ivanplat1.github.io/DrinkNote/_expo/static/');
      url = url.replace(/https:\\/\\/ivanplat1\\.github\\.io\\/assets\\//g, 'https://ivanplat1.github.io/DrinkNote/_expo/static/');
      // Исправляем относительные пути
      url = url.replace(/\\/assets\\/node_modules\\//g, '/DrinkNote/_expo/static/');
      url = url.replace(/\\/assets\\//g, '/DrinkNote/_expo/static/');
      return url;
    }
    
    // Перехватываем fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      if (typeof args[0] === 'string') {
        args[0] = fixPath(args[0]);
      } else if (args[0] && args[0].url) {
        args[0] = { ...args[0], url: fixPath(args[0].url) };
      }
      return originalFetch.apply(this, args);
    };
    
    // Перехватываем создание элементов link для шрифтов
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName, options) {
      const element = originalCreateElement.call(this, tagName, options);
      if (tagName === 'link') {
        const originalSetAttribute = element.setAttribute;
        element.setAttribute = function(name, value) {
          if (name === 'href' && typeof value === 'string') {
            value = fixPath(value);
          }
          return originalSetAttribute.call(this, name, value);
        };
        // Также перехватываем прямое присваивание href
        try {
          Object.defineProperty(element, 'href', {
            set: function(value) {
              this.setAttribute('href', fixPath(value));
            },
            get: function() {
              return this.getAttribute('href');
            },
            configurable: true
          });
        } catch (e) {
          // Игнорируем ошибки определения свойства
        }
      }
      return element;
    };
    
    // Перехватываем добавление стилей для исправления путей в CSS
    const originalInsertRule = CSSStyleSheet.prototype.insertRule;
    CSSStyleSheet.prototype.insertRule = function(rule, index) {
      if (typeof rule === 'string') {
        rule = rule.replace(/url\\(["']?https:\\/\\/ivanplat1\\.github\\.io\\/assets\\//g, 'url("https://ivanplat1.github.io/DrinkNote/_expo/static/');
        rule = rule.replace(/url\\(["']?\\/assets\\//g, 'url("/DrinkNote/_expo/static/');
      }
      return originalInsertRule.call(this, rule, index);
    };
  })();
  
  // Регистрация Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/DrinkNote/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
</script>`;
    html = html.replace('</body>', `${swScript}\n</body>`);
  }
  
  fs.writeFileSync(indexPath, html);
  console.log('✅ Обновлен index.html');
}

// Исправляем пути в JavaScript бандле
const jsDir = path.join(distDir, '_expo', 'static', 'js', 'web');
if (fs.existsSync(jsDir)) {
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  jsFiles.forEach(jsFile => {
    const jsPath = path.join(jsDir, jsFile);
    let jsContent = fs.readFileSync(jsPath, 'utf8');
    
    // Заменяем полные URL к ресурсам (разные варианты)
    jsContent = jsContent.replace(/https:\/\/ivanplat1\.github\.io\/assets\/node_modules\//g, 'https://ivanplat1.github.io/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/https:\/\/ivanplat1\.github\.io\/assets\//g, 'https://ivanplat1.github.io/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/https:\/\/ivanplat1\.github\.io\/DrinkNote\/assets\/node_modules\//g, 'https://ivanplat1.github.io/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/https:\/\/ivanplat1\.github\.io\/DrinkNote\/assets\//g, 'https://ivanplat1.github.io/DrinkNote/_expo/static/');
    
    // Заменяем относительные пути к ресурсам
    jsContent = jsContent.replace(/\/assets\/node_modules\//g, '/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/\/DrinkNote\/assets\/node_modules\//g, '/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/\/assets\//g, '/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/\/DrinkNote\/assets\//g, '/DrinkNote/_expo/static/');
    
    // Заменяем пути в url() функциях (включая кавычки)
    jsContent = jsContent.replace(/url\(["']?\/(assets|node_modules)/g, (match) => {
      return match.replace(/^\//, '/DrinkNote/_expo/static/');
    });
    
    // Заменяем пути в строках (включая полные URL и разные форматы кавычек)
    jsContent = jsContent.replace(/"https:\/\/ivanplat1\.github\.io\/assets\/node_modules\//g, '"https://ivanplat1.github.io/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/'https:\/\/ivanplat1\.github\.io\/assets\/node_modules\//g, "'https://ivanplat1.github.io/DrinkNote/_expo/static/");
    jsContent = jsContent.replace(/"\/assets\/node_modules\//g, '"/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/'\/assets\/node_modules\//g, "'/DrinkNote/_expo/static/");
    jsContent = jsContent.replace(/"\/assets\//g, '"/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/'\/assets\//g, "'/DrinkNote/_expo/static/");
    
    // Также заменяем пути без кавычек (если они есть в коде)
    // Это должно быть последним, чтобы не конфликтовать с предыдущими заменами
    const beforeReplace = jsContent;
    jsContent = jsContent.replace(/\/assets\/node_modules\//g, '/DrinkNote/_expo/static/');
    jsContent = jsContent.replace(/\/assets\//g, '/DrinkNote/_expo/static/');
    
    // Проверяем, были ли замены
    if (beforeReplace !== jsContent) {
      console.log(`   Заменены пути в ${jsFile}`);
    }
    
    fs.writeFileSync(jsPath, jsContent);
    console.log(`✅ Обновлен ${jsFile}`);
  });
}

console.log('✅ PWA файлы успешно добавлены!');

