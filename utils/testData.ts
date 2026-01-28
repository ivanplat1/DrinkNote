import { Drink } from '../types/drink';
import { PresetDrink } from '../types/preset';
import { calculateStandardUnits } from './units';

/**
 * Генерирует тестовые данные для разработки
 * TODO: Удалить перед релизом
 */

// Функция для расчета стандартных единиц с учетом количества
function calculateUnits(volumeMl: number, abvPercent: number, quantity: number = 1): number {
  const baseUnits = calculateStandardUnits(volumeMl, abvPercent);
  return Math.round(baseUnits * quantity * 100) / 100;
}

// Генерирует случайную дату в пределах последних 3 месяцев
function randomDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// Генерирует случайное число в диапазоне
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Генерирует случайное число с плавающей точкой
function randomFloat(min: number, max: number, decimals: number = 1): number {
  return Math.round((Math.random() * (max - min) + min) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function generateTestDrinks(): Drink[] {
  const drinks: Drink[] = [];
  
  // Разные типы напитков
  const beverageTypes: Drink['beverageType'][] = ['beer', 'wine', 'spirit', 'cocktail', 'other'];
  
  let previousYearCount = 0;
  let currentYearCount = 0;
  
  console.log('🔄 Начинаю генерацию тестовых данных...');
  
  // Варианты напитков
  const drinkVariants = [
    // Пиво
    { name: 'Пиво', type: 'beer' as const, volumes: [330, 500], abvs: [4.5, 5, 5.5, 6] },
    { name: 'Сидр', type: 'beer' as const, volumes: [330, 500], abvs: [4, 5, 6] },
    { name: 'IPA', type: 'beer' as const, volumes: [330, 500], abvs: [6, 7, 8] },
    
    // Вино
    { name: 'Вино красное', type: 'wine' as const, volumes: [150, 200], abvs: [12, 13, 14] },
    { name: 'Вино белое', type: 'wine' as const, volumes: [150, 200], abvs: [11, 12, 13] },
    { name: 'Шампанское', type: 'wine' as const, volumes: [150, 200], abvs: [12, 12.5] },
    { name: 'Просекко', type: 'wine' as const, volumes: [150, 200], abvs: [11, 11.5] },
    
    // Крепкие
    { name: 'Виски', type: 'spirit' as const, volumes: [30, 50], abvs: [40, 43, 46] },
    { name: 'Водка', type: 'spirit' as const, volumes: [30, 50], abvs: [40] },
    { name: 'Коньяк', type: 'spirit' as const, volumes: [30, 50], abvs: [40, 42] },
    { name: 'Ром', type: 'spirit' as const, volumes: [30, 50], abvs: [40, 45] },
    { name: 'Джин', type: 'spirit' as const, volumes: [30, 50], abvs: [40, 47] },
    
    // Коктейли
    { name: 'Джин-тоник', type: 'cocktail' as const, volumes: [200, 250, 300], abvs: [8, 10, 12] },
    { name: 'Мохито', type: 'cocktail' as const, volumes: [200, 250], abvs: [10, 12] },
    { name: 'Маргарита', type: 'cocktail' as const, volumes: [150, 200], abvs: [15, 18] },
    { name: 'Кровавая Мэри', type: 'cocktail' as const, volumes: [200, 250], abvs: [12, 14] },
    
    // Другое
    { name: 'Ликер', type: 'other' as const, volumes: [30, 50], abvs: [20, 25, 30] },
    { name: 'Вермут', type: 'other' as const, volumes: [50, 100], abvs: [16, 18] },
  ];
  
  let idCounter = 1;
  
  // Генерируем данные за последние 90 дней (примерно 3 месяца)
  // Делаем хаотично - не каждый день, разные дни недели
  // Используем фиксированный seed для воспроизводимости, но с вариативностью
  const usedDates = new Set<string>();
  
  // Генерируем данные за весь предыдущий год (365 дней: от 365 до 729 дней назад)
  for (let daysAgo = 365; daysAgo < 730; daysAgo++) {
    const dateISO = randomDate(daysAgo);
    
    // Пропускаем если уже использовали эту дату
    if (usedDates.has(dateISO)) continue;
    
    const dayOfWeek = new Date(dateISO).getDay();
    
    // Разная вероятность в разные дни недели (пятница-воскресенье чаще)
    let probability = 0.25; // немного меньше вероятность для прошлого года
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      probability = 0.5; // Пятница, суббота, воскресенье
    } else if (dayOfWeek === 4) {
      probability = 0.35; // Четверг
    }
    
    // Решаем, добавлять ли записи в этот день
    if (Math.random() < probability) {
      usedDates.add(dateISO);
      // Количество видов напитков в день (1-2 в среднем)
      const entriesCount = randomInt(1, 2);
      
      // Выбираем один вариант напитка для дня
      const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
      
      for (let i = 0; i < entriesCount; i++) {
        const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
        const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
        const quantity = randomInt(1, 3); // 1-3 порции
        
        drinks.push({
          id: `test_${idCounter++}`,
          dateISO,
          name: variant.name,
          beverageType: variant.type,
          volumeMl: volume,
          abvPercent: abv,
          quantity,
          standardUnits: calculateUnits(volume, abv, quantity),
        });
        previousYearCount++;
      }
    }
  }
  
  // Гарантируем минимум записей за предыдущий год - добавляем записи более активно
  for (let daysAgo = 365; daysAgo < 730; daysAgo++) {
    const dateISO = randomDate(daysAgo);
    if (!usedDates.has(dateISO) && Math.random() < 0.4) {
      usedDates.add(dateISO);
      // 1-2 вида напитков в день
      const entriesCount = randomInt(1, 2);
      const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
      
      for (let i = 0; i < entriesCount; i++) {
        const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
        const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
        const quantity = randomInt(1, 2);
        
        drinks.push({
          id: `test_${idCounter++}`,
          dateISO,
          name: variant.name,
          beverageType: variant.type,
          volumeMl: volume,
          abvPercent: abv,
          quantity,
          standardUnits: calculateUnits(volume, abv, quantity),
        });
        previousYearCount++;
      }
    }
  }
  
  // Добавляем несколько тяжелых дней за предыдущий год
  const heavyDaysPreviousYear = [
    randomDate(randomInt(400, 450)),
    randomDate(randomInt(500, 550)),
    randomDate(randomInt(600, 650)),
  ];
  
  heavyDaysPreviousYear.forEach(dateISO => {
    usedDates.add(dateISO);
    // 2-3 вида напитков, но больше порций
    const entriesCount = randomInt(2, 3);
    const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
    
    for (let i = 0; i < entriesCount; i++) {
      const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
      const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
      const quantity = randomInt(2, 4); // Больше порций для тяжелых дней
      
      drinks.push({
        id: `test_${idCounter++}`,
        dateISO,
        name: variant.name,
        beverageType: variant.type,
        volumeMl: volume,
        abvPercent: abv,
        quantity,
        standardUnits: calculateUnits(volume, abv, quantity),
      });
      previousYearCount++;
    }
  });
  
  console.log(`📅 После тяжелых дней предыдущего года: ${previousYearCount} записей за предыдущий год`);
  
  // Генерируем данные за весь текущий год (0-365 дней назад)
  for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
    const dateISO = randomDate(daysAgo);
    
    // Пропускаем если уже использовали эту дату
    if (usedDates.has(dateISO)) continue;
    
    const dayOfWeek = new Date(dateISO).getDay();
    
    // Разная вероятность в разные дни недели (пятница-воскресенье чаще)
    // Также уменьшаем вероятность для более старых дней года
    let baseProbability = 0.3;
    if (daysAgo > 180) {
      baseProbability = 0.2; // Старые дни года - меньше вероятность
    } else if (daysAgo > 90) {
      baseProbability = 0.25; // Средние дни года
    }
    
    let probability = baseProbability;
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      probability = baseProbability * 2; // Пятница, суббота, воскресенье
    } else if (dayOfWeek === 4) {
      probability = baseProbability * 1.3; // Четверг
    }
    
    // Решаем, добавлять ли записи в этот день
    if (Math.random() < probability) {
      usedDates.add(dateISO);
      // Количество видов напитков в день (1-2 в среднем)
      const entriesCount = randomInt(1, 2);
      
      // Выбираем один вариант напитка для дня
      const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
      
      for (let i = 0; i < entriesCount; i++) {
        const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
        const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
        const quantity = randomInt(1, 3); // 1-3 порции
        
        drinks.push({
          id: `test_${idCounter++}`,
          dateISO,
          name: variant.name,
          beverageType: variant.type,
          volumeMl: volume,
          abvPercent: abv,
          quantity,
          standardUnits: calculateUnits(volume, abv, quantity),
        });
        currentYearCount++;
      }
    }
  }
  
  // Гарантируем минимум записей - добавляем записи за весь текущий год более активно
  for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
    const dateISO = randomDate(daysAgo);
    // Уменьшаем вероятность для более старых дней
    let probability = 0.4;
    if (daysAgo > 180) {
      probability = 0.25; // Старые дни года
    } else if (daysAgo > 90) {
      probability = 0.3; // Средние дни года
    }
    if (!usedDates.has(dateISO) && Math.random() < probability) {
      usedDates.add(dateISO);
      // 1-2 вида напитков в день
      const entriesCount = randomInt(1, 2);
      const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
      
      for (let i = 0; i < entriesCount; i++) {
        const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
        const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
        const quantity = randomInt(1, 2);
        
        drinks.push({
          id: `test_${idCounter++}`,
          dateISO,
          name: variant.name,
          beverageType: variant.type,
          volumeMl: volume,
          abvPercent: abv,
          quantity,
          standardUnits: calculateUnits(volume, abv, quantity),
        });
        currentYearCount++;
      }
    }
  }
  
  console.log(`📅 Сгенерировано ${currentYearCount} записей за текущий год (0-365 дней назад)`);
  
  // Добавляем несколько дней с большим количеством (для тестирования рекордов)
  const heavyDays = [
    randomDate(randomInt(5, 15)),
    randomDate(randomInt(20, 30)),
    randomDate(randomInt(45, 60)),
  ];
  
  heavyDays.forEach(dateISO => {
    usedDates.add(dateISO);
    // 2-3 вида напитков, но больше порций
    const entriesCount = randomInt(2, 3);
    const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
    
    for (let i = 0; i < entriesCount; i++) {
      const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
      const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
      const quantity = randomInt(2, 4); // Больше порций для тяжелых дней
      
      drinks.push({
        id: `test_${idCounter++}`,
        dateISO,
        name: variant.name,
        beverageType: variant.type,
        volumeMl: volume,
        abvPercent: abv,
        quantity,
        standardUnits: calculateUnits(volume, abv, quantity),
      });
      currentYearCount++;
    }
  });
  
  // Добавляем ОЧЕНЬ большой рекордный день (для тестирования рекордов)
  const recordDay = randomDate(randomInt(10, 20));
  usedDates.add(recordDay);
  // 2-3 вида напитков, но ОЧЕНЬ много порций для рекорда
  const recordVariants = [
    drinkVariants[randomInt(0, drinkVariants.length - 1)],
    drinkVariants[randomInt(0, drinkVariants.length - 1)],
  ];
  
  recordVariants.forEach(variant => {
    const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
    const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
    const quantity = randomInt(5, 8); // Много порций для рекорда
    
    drinks.push({
      id: `test_${idCounter++}`,
      dateISO: recordDay,
      name: variant.name,
      beverageType: variant.type,
      volumeMl: volume,
      abvPercent: abv,
      quantity,
      standardUnits: calculateUnits(volume, abv, quantity),
    });
    currentYearCount++;
  });
  
  // Добавляем серебряную серию (16 дней подряд без алкоголя) - должна быть видна
  // Находим период в прошлом, который не пересекается с существующими датами
  // Используем фиксированную дату для гарантии, что серия будет создана
  const today = new Date();
  const silverStreakStartDate = new Date(today);
  silverStreakStartDate.setDate(silverStreakStartDate.getDate() - 25); // 25 дней назад
  const silverStreakStart = silverStreakStartDate.toISOString().split('T')[0];
  const silverStreakDays = 16; // 16 дней для серебряной серии (14+)
  
  // Удаляем все записи из этого периода, если они есть
  const drinksToRemove: string[] = [];
  drinks.forEach((drink, index) => {
    const drinkDate = new Date(drink.dateISO);
    const streakStart = new Date(silverStreakStart);
    const streakEnd = new Date(streakStart);
    streakEnd.setDate(streakEnd.getDate() + silverStreakDays - 1);
    
    if (drinkDate >= streakStart && drinkDate <= streakEnd) {
      drinksToRemove.push(drink.id);
    }
  });
  
  // Удаляем записи из периода серебряной серии
  drinksToRemove.forEach(id => {
    const index = drinks.findIndex(d => d.id === id);
    if (index >= 0) {
      drinks.splice(index, 1);
    }
  });
  
  // Помечаем даты как использованные, чтобы не генерировать там новые записи
  for (let i = 0; i < silverStreakDays; i++) {
    const streakDate = new Date(silverStreakStart);
    streakDate.setDate(streakDate.getDate() + i);
    const streakDateISO = streakDate.toISOString().split('T')[0];
    usedDates.add(streakDateISO);
  }
  
  // Добавляем день ПЕРЕД серией с алкоголем (чтобы серия была видна)
  const dayBeforeStreak = new Date(silverStreakStartDate);
  dayBeforeStreak.setDate(dayBeforeStreak.getDate() - 1);
  const dayBeforeISO = dayBeforeStreak.toISOString().split('T')[0];
  if (!usedDates.has(dayBeforeISO)) {
    usedDates.add(dayBeforeISO);
    const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
    const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
    const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
    
    drinks.push({
      id: `test_${idCounter++}`,
      dateISO: dayBeforeISO,
      name: variant.name,
      beverageType: variant.type,
      volumeMl: volume,
      abvPercent: abv,
      quantity: randomInt(1, 2),
      standardUnits: calculateUnits(volume, abv, randomInt(1, 2)),
    });
  }
  
  // Добавляем день ПОСЛЕ серии с алкоголем (чтобы серия была завершена)
  const dayAfterStreak = new Date(silverStreakStartDate);
  dayAfterStreak.setDate(dayAfterStreak.getDate() + silverStreakDays);
  const dayAfterISO = dayAfterStreak.toISOString().split('T')[0];
  if (!usedDates.has(dayAfterISO)) {
    usedDates.add(dayAfterISO);
    const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
    const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
    const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
    
    drinks.push({
      id: `test_${idCounter++}`,
      dateISO: dayAfterISO,
      name: variant.name,
      beverageType: variant.type,
      volumeMl: volume,
      abvPercent: abv,
      quantity: randomInt(1, 2),
      standardUnits: calculateUnits(volume, abv, randomInt(1, 2)),
    });
  }
  
  // Добавляем золотую серию (30+ дней) для рекорда - в более раннем периоде
  const goldStreakStartDate = new Date(today);
  goldStreakStartDate.setDate(goldStreakStartDate.getDate() - 50); // 50 дней назад
  const goldStreakStart = goldStreakStartDate.toISOString().split('T')[0];
  const goldStreakDays = 35; // 35 дней для золотой серии (30+)
  
  // Удаляем все записи из этого периода
  const drinksToRemoveGold: string[] = [];
  drinks.forEach((drink) => {
    const drinkDate = new Date(drink.dateISO);
    const streakStart = new Date(goldStreakStart);
    const streakEnd = new Date(streakStart);
    streakEnd.setDate(streakEnd.getDate() + goldStreakDays - 1);
    
    if (drinkDate >= streakStart && drinkDate <= streakEnd) {
      drinksToRemoveGold.push(drink.id);
    }
  });
  
  drinksToRemoveGold.forEach(id => {
    const index = drinks.findIndex(d => d.id === id);
    if (index >= 0) {
      drinks.splice(index, 1);
    }
  });
  
  // Помечаем даты как использованные
  for (let i = 0; i < goldStreakDays; i++) {
    const streakDate = new Date(goldStreakStart);
    streakDate.setDate(streakDate.getDate() + i);
    const streakDateISO = streakDate.toISOString().split('T')[0];
    usedDates.add(streakDateISO);
  }
  
  // Добавляем день ПЕРЕД золотой серией
  const dayBeforeGold = new Date(goldStreakStartDate);
  dayBeforeGold.setDate(dayBeforeGold.getDate() - 1);
  const dayBeforeGoldISO = dayBeforeGold.toISOString().split('T')[0];
  if (!usedDates.has(dayBeforeGoldISO)) {
    usedDates.add(dayBeforeGoldISO);
    const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
    const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
    const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
    
    drinks.push({
      id: `test_${idCounter++}`,
      dateISO: dayBeforeGoldISO,
      name: variant.name,
      beverageType: variant.type,
      volumeMl: volume,
      abvPercent: abv,
      quantity: randomInt(1, 2),
      standardUnits: calculateUnits(volume, abv, randomInt(1, 2)),
    });
  }
  
  // Добавляем день ПОСЛЕ золотой серии
  const dayAfterGold = new Date(goldStreakStartDate);
  dayAfterGold.setDate(dayAfterGold.getDate() + goldStreakDays);
  const dayAfterGoldISO = dayAfterGold.toISOString().split('T')[0];
  if (!usedDates.has(dayAfterGoldISO)) {
    usedDates.add(dayAfterGoldISO);
    const variant = drinkVariants[randomInt(0, drinkVariants.length - 1)];
    const volume = variant.volumes[randomInt(0, variant.volumes.length - 1)];
    const abv = variant.abvs[randomInt(0, variant.abvs.length - 1)];
    
    drinks.push({
      id: `test_${idCounter++}`,
      dateISO: dayAfterGoldISO,
      name: variant.name,
      beverageType: variant.type,
      volumeMl: volume,
      abvPercent: abv,
      quantity: randomInt(1, 2),
      standardUnits: calculateUnits(volume, abv, randomInt(1, 2)),
    });
  }
  
  const sortedDrinks = drinks.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  
  // Подсчитываем финальные значения
  const finalPreviousYear = sortedDrinks.filter(d => {
    const date = new Date(d.dateISO);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 365 && daysDiff < 730;
  }).length;
  
  const finalCurrentYear = sortedDrinks.filter(d => {
    const date = new Date(d.dateISO);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 0 && daysDiff < 365;
  }).length;
  
  console.log(`✅ Всего сгенерировано ${sortedDrinks.length} записей`);
  console.log(`   📊 За предыдущий год (365-730 дней назад): ${finalPreviousYear} записей`);
  console.log(`   📊 За текущий год (0-365 дней назад): ${finalCurrentYear} записей`);
  
  if (sortedDrinks.length > 0) {
    const firstDate = sortedDrinks[0].dateISO;
    const lastDate = sortedDrinks[sortedDrinks.length - 1].dateISO;
    console.log(`   📆 Диапазон дат: ${firstDate} - ${lastDate}`);
  }
  
  return sortedDrinks;
}

export function generateTestPresets(): PresetDrink[] {
  return [
    { id: 'test_preset_1', name: 'Любимое пиво', beverageType: 'beer', volumeMl: 500, abvPercent: 5 },
    { id: 'test_preset_2', name: 'Виски односолодовый', beverageType: 'spirit', volumeMl: 50, abvPercent: 43 },
    { id: 'test_preset_3', name: 'Джин-тоник', beverageType: 'cocktail', volumeMl: 250, abvPercent: 10 },
    { id: 'test_preset_4', name: 'Красное вино', beverageType: 'wine', volumeMl: 200, abvPercent: 13 },
    { id: 'test_preset_5', name: 'IPA крафт', beverageType: 'beer', volumeMl: 330, abvPercent: 7 },
    { id: 'test_preset_6', name: 'Маргарита', beverageType: 'cocktail', volumeMl: 200, abvPercent: 18 },
  ];
}
