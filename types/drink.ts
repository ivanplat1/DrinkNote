export type Drink = {
  id: string;
  dateISO: string; // YYYY-MM-DD for grouping by day
  name: string; // Название напитка (например, Пиво, Вино, Джин-тоник)
  beverageType: 'beer' | 'wine' | 'spirit' | 'cocktail' | 'other';
  volumeMl: number;
  abvPercent: number; // Крепость, %
  standardUnits: number; // Рассчитанное значение (10 г этанола за единицу)
  quantity?: number; // Количество порций/единиц (по умолчанию 1)
  note?: string;
};


