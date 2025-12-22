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
      src: '/DrinkNote/assets/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: '/DrinkNote/assets/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any'
    }
  );
  
  console.log('✅ Созданы иконки: icon-192.png, icon-512.png');
} else {
  console.warn('⚠️  Иконка не найдена:', iconPath);
}

// Добавляем favicon если есть
if (fs.existsSync(faviconPath)) {
  const faviconDest = path.join(distAssetsDir, 'favicon.png');
  fs.copyFileSync(faviconPath, faviconDest);
  icons.push({
      src: '/DrinkNote/assets/favicon.png',
    sizes: '48x48',
    type: 'image/png'
  });
}

// Создаем manifest.json
const manifest = {
  name: 'DrinkNote',
  short_name: 'DrinkNote',
  description: 'Трекер потребления алкоголя',
  start_url: '/DrinkNote/',
  display: 'standalone',
  background_color: '#000000',
  theme_color: '#1a1a1a',
  orientation: 'portrait',
  scope: '/DrinkNote/',
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
  
  // Обновляем viewport meta tag для поддержки safe area на iOS
  html = html.replace(
    /<meta name="viewport"[^>]*>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />'
  );
  
  // Добавляем apple-touch-icon для iOS
  if (fs.existsSync(iconPath)) {
    const appleTouchIconPath = path.join(distAssetsDir, 'apple-touch-icon.png');
    // Создаем apple-touch-icon (180x180 для iOS)
    try {
      const { execSync } = require('child_process');
      execSync(`sips -z 180 180 "${iconPath}" --out "${appleTouchIconPath}"`, { stdio: 'ignore' });
      console.log('✅ Создан apple-touch-icon.png');
    } catch (e) {
      try {
        execSync(`convert "${iconPath}" -resize 180x180 "${appleTouchIconPath}"`, { stdio: 'ignore' });
        console.log('✅ Создан apple-touch-icon.png (через ImageMagick)');
      } catch (e2) {
        fs.copyFileSync(iconPath, appleTouchIconPath);
        console.log('✅ Скопирован apple-touch-icon.png');
      }
    }
    
    if (!html.includes('apple-touch-icon')) {
      html = html.replace(
        /<\/head>/,
        `  <link rel="apple-touch-icon" href="/DrinkNote/assets/apple-touch-icon.png" />
</head>`
      );
    }
  }
  
  // Добавляем мета-теги для iOS PWA
  if (!html.includes('apple-mobile-web-app-status-bar-style')) {
    html = html.replace(
      /<\/head>/,
      `  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="DrinkNote" />
  <link rel="manifest" href="/DrinkNote/manifest.json" />
</head>`
    );
  } else if (!html.includes('manifest.json')) {
    // Добавляем ссылку на манифест перед закрывающим тегом head
    html = html.replace(
      /<\/head>/,
      '  <link rel="manifest" href="/DrinkNote/manifest.json" />\n</head>'
    );
  }
  
  // Добавляем CSS для safe area insets на iOS
  if (!html.includes('safe-area-inset')) {
    const safeAreaCSS = `
    <style>
      /* Safe area insets для iOS */
      :root {
        --safe-area-inset-top: env(safe-area-inset-top);
        --safe-area-inset-right: env(safe-area-inset-right);
        --safe-area-inset-bottom: env(safe-area-inset-bottom);
        --safe-area-inset-left: env(safe-area-inset-left);
      }
      
      /* Применяем safe area к body */
      /* Для black-translucent статус-бара контент должен быть под ним без дополнительного padding */
      /* Фон должен быть черным, чтобы статус-бар выглядел правильно */
      /* НЕ добавляем padding-bottom к body - применяем только к таб-бару */
      body {
        background-color: #000000;
        margin: 0;
        padding: 0;
      }
      
      /* В standalone режиме расширяем body до низа экрана, чтобы покрыть home indicator */
      @media (display-mode: standalone) {
        body {
          min-height: calc(100vh + env(safe-area-inset-bottom));
        }
      }
      
      /* Убеждаемся, что статус-бар имеет правильный цвет фона */
      html {
        background-color: #000000;
        margin: 0;
        padding: 0;
      }
      
      /* Для black-translucent НЕ добавляем padding-top к root - контент должен быть под статус-баром */
      #root {
        margin: 0;
        padding: 0;
      }
      
      /* Применяем safe area к таб-бару React Navigation только в standalone режиме */
      @media (display-mode: standalone) {
        /* НЕ расширяем #root - это создает перекрытие с панелью вкладок */
        /* Вместо этого расширяем body для покрытия home indicator */
        
        nav[role="tablist"],
        [data-testid="tab-bar"],
        .tab-bar,
        div[style*="position: fixed"][style*="bottom: 0"],
        div[style*="bottom: 0px"],
        div[style*="bottom:0px"] {
          padding-bottom: env(safe-area-inset-bottom) !important;
          margin-bottom: 0 !important;
          /* Увеличиваем минимальную высоту панели вкладок, чтобы она была достаточно высокой */
          /* Увеличиваем базовую высоту с 49px до 70px для лучшего размещения текста */
          min-height: calc(70px + env(safe-area-inset-bottom)) !important;
        }
        
        /* Увеличиваем высоту элементов внутри панели вкладок */
        nav[role="tablist"] > *,
        [data-testid="tab-bar"] > *,
        .tab-bar > * {
          min-height: calc(70px + env(safe-area-inset-bottom)) !important;
        }
        
        /* Увеличиваем высоту кнопок вкладок и их контейнеров */
        nav[role="tablist"] button,
        nav[role="tablist"] a,
        [data-testid="tab-bar"] button,
        [data-testid="tab-bar"] a,
        .tab-bar button,
        .tab-bar a {
          min-height: 70px !important;
          padding-top: 8px !important;
          padding-bottom: calc(8px + env(safe-area-inset-bottom)) !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
        }
        
        /* Агрессивное скрытие всех текстовых элементов в панели вкладок */
        nav[role="tablist"] button *,
        nav[role="tablist"] a *,
        [data-testid="tab-bar"] button *,
        [data-testid="tab-bar"] a *,
        .tab-bar button *,
        .tab-bar a * {
          font-size: 0 !important;
          line-height: 0 !important;
          color: transparent !important;
        }
        
        /* Показываем только иконки (SVG и элементы с классами icon) */
        nav[role="tablist"] button svg,
        nav[role="tablist"] a svg,
        [data-testid="tab-bar"] button svg,
        [data-testid="tab-bar"] a svg,
        .tab-bar button svg,
        .tab-bar a svg {
          display: block !important;
          font-size: 24px !important;
          width: 24px !important;
          height: 24px !important;
          color: inherit !important;
        }
        
        nav[role="tablist"] button [class*="icon"],
        nav[role="tablist"] a [class*="icon"],
        [data-testid="tab-bar"] button [class*="icon"],
        [data-testid="tab-bar"] a [class*="icon"],
        .tab-bar button [class*="icon"],
        .tab-bar a [class*="icon"] {
          display: block !important;
          font-size: 24px !important;
          color: inherit !important;
        }
        
        /* Скрываем все span, label, div, p, text элементы, которые не являются иконками */
        nav[role="tablist"] button span,
        nav[role="tablist"] a span,
        [data-testid="tab-bar"] button span,
        [data-testid="tab-bar"] a span,
        .tab-bar button span,
        .tab-bar a span,
        nav[role="tablist"] button label,
        nav[role="tablist"] a label,
        [data-testid="tab-bar"] button label,
        [data-testid="tab-bar"] a label,
        .tab-bar button label,
        .tab-bar a label,
        nav[role="tablist"] button div,
        nav[role="tablist"] a div,
        [data-testid="tab-bar"] button div,
        [data-testid="tab-bar"] a div,
        .tab-bar button div,
        .tab-bar a div,
        nav[role="tablist"] button p,
        nav[role="tablist"] a p,
        [data-testid="tab-bar"] button p,
        [data-testid="tab-bar"] a p,
        .tab-bar button p,
        .tab-bar a p {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
        }
        
        /* Исключаем SVG и иконки из скрытия */
        nav[role="tablist"] button svg,
        nav[role="tablist"] a svg,
        [data-testid="tab-bar"] button svg,
        [data-testid="tab-bar"] a svg,
        .tab-bar button svg,
        .tab-bar a svg,
        nav[role="tablist"] button [class*="icon"],
        nav[role="tablist"] a [class*="icon"],
        [data-testid="tab-bar"] button [class*="icon"],
        [data-testid="tab-bar"] a [class*="icon"],
        .tab-bar button [class*="icon"],
        .tab-bar a [class*="icon"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          height: auto !important;
          width: auto !important;
          overflow: visible !important;
        }
      }
      
      /* Альтернативный подход: применяем через JavaScript после загрузки */
      /* Это будет добавлено в runtime скрипт ниже */
    </style>
`;
    html = html.replace('</head>', safeAreaCSS + '</head>');
  }
  
  // Добавляем исправление путей в <head> ДО загрузки основного скрипта
  if (!html.includes('fixPath')) {
    const pathFixScript = `
<script>
  // Исправляем пути к ресурсам для GitHub Pages (выполняется немедленно)
  (function() {
    function fixPath(url) {
      if (typeof url !== 'string') return url;
      
      // Сначала убираем все дублирования /DrinkNote/DrinkNote/...
      url = url.replace(/\/DrinkNote\/DrinkNote\/+/g, '/DrinkNote/');
      
      // Если путь уже содержит /DrinkNote/ перед /assets/, не трогаем его
      if (url.match(/\/DrinkNote\/assets\//) || url.match(/\/DrinkNote\/_expo\//)) {
        return url;
      }
      
      // Исправляем полные URL (разные варианты)
      // Файлы находятся в /assets/node_modules/, а не в _expo/static/
      if (url.startsWith('https://ivanplat1.github.io/assets/')) {
        url = url.replace('https://ivanplat1.github.io/assets/', 'https://ivanplat1.github.io/DrinkNote/assets/');
        return url;
      }
      
      // Исправляем относительные пути (только если они начинаются с /assets/ и не содержат /DrinkNote/)
      if (url.startsWith('/assets/') && !url.startsWith('/DrinkNote/')) {
        url = '/DrinkNote' + url;
        return url;
      }
      
      return url;
    }
    
    // Перехватываем fetch ДО загрузки основного скрипта
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
    
    // Перехватываем загрузку CSS файлов и исправляем пути в них
    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function(child) {
      if (child && child.tagName === 'LINK' && child.rel === 'stylesheet') {
        const originalHref = child.href;
        // Исправляем href ДО добавления элемента
        if (originalHref) {
          child.href = fixPath(originalHref);
        }
        const originalSetAttribute = child.setAttribute;
        child.setAttribute = function(name, value) {
          if (name === 'href') {
            value = fixPath(value);
          }
          return originalSetAttribute.call(this, name, value);
        };
        // Также перехватываем onload для исправления путей в @font-face после загрузки
        const originalOnLoad = child.onload;
        child.onload = function() {
          // После загрузки CSS исправляем пути в @font-face
          try {
            const sheets = document.styleSheets;
            for (let i = 0; i < sheets.length; i++) {
              try {
                const rules = sheets[i].cssRules || sheets[i].rules;
                for (let j = 0; j < rules.length; j++) {
                  if (rules[j].type === CSSRule.FONT_FACE_RULE) {
                    const src = rules[j].style.src;
                    if (src) {
                      rules[j].style.src = src.replace(/url\\(["']?https:\\/\\/ivanplat1\\.github\\.io\\/assets\\//g, 'url("https://ivanplat1.github.io/DrinkNote/assets/');
                      rules[j].style.src = rules[j].style.src.replace(/url\\(["']?\\/assets\\//g, 'url("/DrinkNote/assets/');
                    }
                  }
                }
              } catch (e) {
                // Игнорируем ошибки доступа к правилам (CORS)
              }
            }
          } catch (e) {
            // Игнорируем ошибки
          }
          if (originalOnLoad) originalOnLoad.call(this);
        };
      }
      return originalAppendChild.call(this, child);
    };
    
    // Перехватываем добавление стилей для исправления путей в CSS
    const originalInsertRule = CSSStyleSheet.prototype.insertRule;
    CSSStyleSheet.prototype.insertRule = function(rule, index) {
      if (typeof rule === 'string') {
        rule = rule.replace(/url\\(["']?https:\\/\\/ivanplat1\\.github\\.io\\/assets\\//g, 'url("https://ivanplat1.github.io/DrinkNote/assets/');
        rule = rule.replace(/url\\(["']?\\/assets\\//g, 'url("/DrinkNote/assets/');
      }
      return originalInsertRule.call(this, rule, index);
    };
    
    // Применяем safe area insets к таб-бару после загрузки DOM
    function applySafeAreaToTabBar() {
      // Проверяем, находимся ли мы в standalone режиме (PWA через домашний экран)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator && window.navigator.standalone) || 
                          document.referrer.includes('android-app://');
      
      // Получаем значение safe area insets
      // Используем прямое значение env() для правильной работы
      const safeAreaBottom = 'env(safe-area-inset-bottom)';
      
      function applyPadding(element) {
        if (!element) return;
        
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const viewportHeight = window.visualViewport ? window.visualViewport.height : windowHeight;
        
        // Проверяем, что элемент действительно внизу экрана (в пределах 100px от низа)
        const isAtBottom = (style.position === 'fixed' || style.position === 'absolute') && 
                          (rect.bottom >= viewportHeight - 100 || 
                           style.bottom === '0px' || 
                           style.bottom === '0' ||
                           Math.abs(rect.bottom - viewportHeight) < 10);
        
        // Также проверяем по содержимому - если есть навигационные элементы
        const text = element.textContent || '';
        const hasNavContent = element.querySelector('nav[role="tablist"]') || 
                              text.includes('Сегодня') || 
                              text.includes('Календарь') ||
                              text.includes('Статистика') ||
                              text.includes('Настройки');
        
        if (isAtBottom || hasNavContent) {
          // Применяем padding только в standalone режиме
          if (isStandalone) {
            // Получаем текущий padding-bottom
            const currentPaddingBottom = style.paddingBottom || '0px';
            let currentPaddingBottomValue = 0;
            
            // Парсим значение padding-bottom
            if (currentPaddingBottom !== '0px' && currentPaddingBottom !== '0') {
              const match = currentPaddingBottom.match(/(\\d+(?:\\.\\d+)?)/);
              if (match) {
                currentPaddingBottomValue = parseFloat(match[1]);
              }
            }
            
            // Применяем safe area insets
            // Используем calc() для правильного расчета
            if (currentPaddingBottomValue > 0) {
              element.style.paddingBottom = \`calc(\${safeAreaBottom} + \${currentPaddingBottomValue}px)\`;
            } else {
              element.style.paddingBottom = safeAreaBottom;
            }
            
            // Увеличиваем минимальную высоту панели вкладок
            // Используем базовую высоту 70px вместо 49px для лучшего размещения текста
            const currentMinHeight = style.minHeight || '70px';
            let currentMinHeightValue = parseInt(currentMinHeight) || 70;
            // Если текущая высота меньше 70px, увеличиваем до 70px
            if (currentMinHeightValue < 70) {
              currentMinHeightValue = 70;
            }
            element.style.minHeight = \`calc(\${currentMinHeightValue}px + \${safeAreaBottom})\`;
            
            // Также увеличиваем высоту, если она задана явно
            if (style.height && style.height !== 'auto') {
              let currentHeightValue = parseInt(style.height) || currentMinHeightValue;
              // Если текущая высота меньше 70px, увеличиваем до 70px
              if (currentHeightValue < 70) {
                currentHeightValue = 70;
              }
              element.style.height = \`calc(\${currentHeightValue}px + \${safeAreaBottom})\`;
            }
            
            // Увеличиваем высоту дочерних элементов панели вкладок
            Array.from(element.children).forEach(child => {
              const childStyle = window.getComputedStyle(child);
              const childMinHeight = childStyle.minHeight || '70px';
              let childMinHeightValue = parseInt(childMinHeight) || 70;
              if (childMinHeightValue < 70) {
                childMinHeightValue = 70;
              }
              child.style.minHeight = \`calc(\${childMinHeightValue}px + \${safeAreaBottom})\`;
              
              if (childStyle.height && childStyle.height !== 'auto') {
                let childHeightValue = parseInt(childStyle.height) || childMinHeightValue;
                if (childHeightValue < 70) {
                  childHeightValue = 70;
                }
                child.style.height = \`calc(\${childHeightValue}px + \${safeAreaBottom})\`;
              }
              
              // Увеличиваем высоту кнопок и ссылок внутри элементов вкладок
              const buttons = child.querySelectorAll('button, a');
              buttons.forEach(btn => {
                btn.style.minHeight = '70px';
                const btnStyle = window.getComputedStyle(btn);
                const btnPaddingTop = btnStyle.paddingTop || '8px';
                const btnPaddingBottom = btnStyle.paddingBottom || '8px';
                btn.style.paddingTop = btnPaddingTop;
                btn.style.paddingBottom = \`calc(\${btnPaddingBottom} + \${safeAreaBottom})\`;
                
                // Агрессивно скрываем все текстовые элементы
                btn.style.fontSize = '0';
                btn.style.lineHeight = '0';
                btn.style.color = 'transparent';
                
                // Скрываем все дочерние элементы, кроме иконок
                const allChildren = btn.querySelectorAll('*');
                allChildren.forEach(child => {
                  const tagName = child.tagName.toLowerCase();
                  const hasIconClass = child.className && typeof child.className === 'string' && (child.className.includes('icon') || child.className.includes('Icon'));
                  const isSvg = tagName === 'svg';
                  const hasSvgChild = child.querySelector('svg');
                  const hasText = child.textContent && child.textContent.trim() && !hasIconClass && !isSvg && !hasSvgChild;
                  
                  // Если это не иконка и содержит текст - скрываем
                  if (!hasIconClass && !isSvg && !hasSvgChild && hasText) {
                    child.style.display = 'none';
                    child.style.visibility = 'hidden';
                    child.style.opacity = '0';
                    child.style.height = '0';
                    child.style.width = '0';
                    child.style.overflow = 'hidden';
                    child.style.fontSize = '0';
                    child.style.lineHeight = '0';
                  }
                });
                
                // Показываем иконки
                const icons = btn.querySelectorAll('svg, [class*="icon"], [class*="Icon"]');
                icons.forEach(icon => {
                  icon.style.display = 'block';
                  icon.style.visibility = 'visible';
                  icon.style.opacity = '1';
                  icon.style.fontSize = '24px';
                  icon.style.width = '24px';
                  icon.style.height = '24px';
                  icon.style.color = 'inherit';
                });
                
                // Скрываем прямые текстовые узлы
                const walker = document.createTreeWalker(
                  btn,
                  NodeFilter.SHOW_TEXT,
                  null,
                  false
                );
                
                let textNode;
                while (textNode = walker.nextNode()) {
                  const text = textNode.textContent.trim();
                  if (text && text.length > 0) {
                    const parent = textNode.parentElement;
                    const hasIconParent = parent && parent.className && typeof parent.className === 'string' && (parent.className.includes('icon') || parent.className.includes('Icon'));
                    if (!hasIconParent) {
                      textNode.textContent = '';
                    }
                  }
                }
              });
            });
          } else {
            // В браузере не применяем padding
            const currentPaddingBottom = style.paddingBottom || '0px';
            element.style.paddingBottom = currentPaddingBottom;
          }
          
          element.style.marginBottom = '0';
          element.dataset.safeAreaApplied = 'true';
        }
      }
      
      // Ищем таб-бар React Navigation
      const tabBarSelectors = [
        'nav[role="tablist"]',
        '[data-testid="tab-bar"]',
        '.tab-bar',
        'div[style*="position: fixed"][style*="bottom"]',
        'div[style*="bottom: 0px"]',
        'div[style*="bottom:0px"]',
      ];
      
      // Применяем ко всем найденным элементам
      tabBarSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(applyPadding);
        } catch (e) {
          // Игнорируем ошибки селекторов
        }
      });
      
      // Также ищем все fixed элементы внизу экрана
      const allElements = document.querySelectorAll('*');
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        // Проверяем fixed элементы внизу экрана
        if (style.position === 'fixed' && (style.bottom === '0px' || style.bottom === '0')) {
          applyPadding(el);
        }
      });
      
      // Также применяем через MutationObserver для динамически созданных элементов
      const tabBarObserver = new MutationObserver(() => {
        tabBarSelectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(applyPadding);
          } catch (e) {
            // Игнорируем ошибки
          }
        });
        
        // Проверяем новые fixed элементы
        const newElements = document.querySelectorAll('*');
        newElements.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' && (style.bottom === '0px' || style.bottom === '0')) {
            applyPadding(el);
          }
        });
      });
      
      tabBarObserver.observe(document.body, { childList: true, subtree: true });
    }
    
    // Применяем после загрузки DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applySafeAreaToTabBar);
    } else {
      applySafeAreaToTabBar();
    }
    
    // Также применяем после полной загрузки страницы
    window.addEventListener('load', () => {
      setTimeout(applySafeAreaToTabBar, 100);
      setTimeout(applySafeAreaToTabBar, 500);
      setTimeout(applySafeAreaToTabBar, 1000);
    });
    
    // Также применяем при изменении размера окна (для поворота экрана)
    window.addEventListener('resize', () => {
      setTimeout(applySafeAreaToTabBar, 100);
    });
    
    // Применяем при изменении видимости (когда приложение становится активным)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(applySafeAreaToTabBar, 100);
      }
    });
  })();
</script>`;
    html = html.replace('</head>', `${pathFixScript}\n</head>`);
  }
  
  if (!html.includes('sw.js')) {
    // Добавляем регистрацию Service Worker перед закрывающим тегом body
    const swScript = `
<script>
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
    
    // Сначала убираем все дублирования /DrinkNote/DrinkNote/...
    jsContent = jsContent.replace(/\/DrinkNote\/DrinkNote\/+/g, '/DrinkNote/');
    
    // Заменяем полные URL к ресурсам
    // Файлы находятся в /assets/node_modules/, а не в _expo/static/
    // Только если путь еще не содержит /DrinkNote/
    jsContent = jsContent.replace(/https:\/\/ivanplat1\.github\.io\/assets\//g, (match) => {
      // Проверяем, не содержит ли уже путь /DrinkNote/
      if (match.includes('/DrinkNote/')) {
        return match;
      }
      return match.replace('/assets/', '/DrinkNote/assets/');
    });
    
    // Заменяем относительные пути к ресурсам (только если они начинаются с /assets/ и не содержат /DrinkNote/)
    jsContent = jsContent.replace(/\/assets\//g, (match, offset, string) => {
      // Проверяем контекст - если перед этим уже есть /DrinkNote/, не заменяем
      const beforeMatch = string.substring(Math.max(0, offset - 20), offset);
      if (beforeMatch.includes('/DrinkNote/')) {
        return match;
      }
      return '/DrinkNote/assets/';
    });
    
    // Заменяем пути в url() функциях (включая кавычки)
    jsContent = jsContent.replace(/url\(["']?\/(assets|node_modules)/g, (match) => {
      // Проверяем, не содержит ли уже путь /DrinkNote/
      if (match.includes('/DrinkNote/')) {
        return match;
      }
      return match.replace(/^\//, '/DrinkNote/');
    });
    
    // Заменяем пути в строках (включая полные URL и разные форматы кавычек)
    // Только если они еще не содержат /DrinkNote/
    jsContent = jsContent.replace(/"https:\/\/ivanplat1\.github\.io\/(?!DrinkNote\/)assets\/node_modules\//g, '"https://ivanplat1.github.io/DrinkNote/assets/node_modules/');
    jsContent = jsContent.replace(/'https:\/\/ivanplat1\.github\.io\/(?!DrinkNote\/)assets\/node_modules\//g, "'https://ivanplat1.github.io/DrinkNote/assets/node_modules/");
    jsContent = jsContent.replace(/"\/(?!DrinkNote\/)assets\/node_modules\//g, '"/DrinkNote/assets/node_modules/');
    jsContent = jsContent.replace(/'\/(?!DrinkNote\/)assets\/node_modules\//g, "'/DrinkNote/assets/node_modules/");
    jsContent = jsContent.replace(/"\/(?!DrinkNote\/)assets\//g, '"/DrinkNote/assets/');
    jsContent = jsContent.replace(/'\/(?!DrinkNote\/)assets\//g, "'/DrinkNote/assets/");
    
    // Также заменяем пути без кавычек (если они есть в коде)
    // Это должно быть последним, чтобы не конфликтовать с предыдущими заменами
    // Но только если они еще не содержат /DrinkNote/
    const beforeReplace = jsContent;
    jsContent = jsContent.replace(/(?<!\/DrinkNote)\/(?<!DrinkNote\/)assets\/node_modules\//g, '/DrinkNote/assets/node_modules/');
    jsContent = jsContent.replace(/(?<!\/DrinkNote)\/(?<!DrinkNote\/)assets\//g, '/DrinkNote/assets/');
    
    // Финальная проверка - убираем любые дублирования
    jsContent = jsContent.replace(/\/DrinkNote\/DrinkNote\/+/g, '/DrinkNote/');
    
    // Проверяем, были ли замены
    if (beforeReplace !== jsContent) {
      console.log(`   Заменены пути в ${jsFile}`);
    }
    
    fs.writeFileSync(jsPath, jsContent);
    console.log(`✅ Обновлен ${jsFile}`);
  });
}

console.log('✅ PWA файлы успешно добавлены!');

