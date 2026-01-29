export type PresetDrink = {
  id: string;
  name: string;
  beverageType: 'beer' | 'wine' | 'spirit' | 'cocktail' | 'other';
  volumeMl: number;
  abvPercent: number;
  /** Цена по умолчанию (премиум, абстрактная валюта) */
  defaultPrice?: number;
};


