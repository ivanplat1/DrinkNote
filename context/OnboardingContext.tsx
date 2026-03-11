import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getHasSeenOnboarding } from '../storage/settings';

export type SpotLayout = { x: number; y: number; width: number; height: number };

export type InteractiveStepConfig = {
  key: string;
  tooltip: string;
};

const INTERACTIVE_STEPS: InteractiveStepConfig[] = [
  {
    key: 'welcome',
    tooltip: 'Добро пожаловать в DrinkNote! Покажем самое важное за несколько шагов.',
  },
  {
    key: 'favorites',
    tooltip: 'Это ваше избранное. Сюда удобно добавлять напитки, которыми пользуетесь чаще всего. Одно нажатие по карточке добавит запись на выбранную дату.',
  },
  {
    key: 'favoritesEdit',
    tooltip: 'Чтобы изменить название, объём или крепость, задержите палец на карточке. Появятся кнопки редактирования и удаления из избранного.',
  },
  {
    key: 'addButton',
    tooltip: 'Кнопка «+» добавляет новые напитки в избранное. Нажмите, откроется список: можно выбрать готовый вариант или добавить свой.',
  },
  {
    key: 'oneTimeEntry',
    tooltip: 'Используйте «+» для единичного добавления — без лишних шагов и сохранения.',
  },
  {
    key: 'calendar',
    tooltip: 'В календаре видно записи по дням: что и сколько употребили. Можно листать месяцы и смотреть общую картину.',
  },
  {
    key: 'stats',
    tooltip: 'Здесь собрана статистика: объёмы и единицы по периодам, тренды по неделям и месяцам, по типам напитков и дням недели. В полной версии доступна расширенная аналитика, а также можно указывать цену напитков и считать траты.',
  },
  {
    key: 'settings',
    tooltip: 'В настройках задаются пол, возраст и вес. Эти параметры нужны для расчёта условно-безопасной нормы — той, которую ВОЗ использовала в контексте минимального риска, а не полной безопасности для здоровья. По нынешней позиции ВОЗ безопасного уровня употребления алкоголя не существует. Свою условную норму вы можете задать по желанию.',
  },
  {
    key: 'fullVersionBenefits',
    tooltip: 'Также, приобретя полную версию приложения, вы сможете выбрать валюту учёта трат, устанавливать цели по серии дней без алкоголя и менять темы оформления.',
  },
  {
    key: 'profileForNorm',
    tooltip: 'Чтобы приложение рассчитало вашу условно-безопасную норму, заполните в профиле вес, пол и дату рождения. Мы не собираем никаких данных — всё хранится только на вашем устройстве.',
  },
];

type OnboardingContextValue = {
  /** null = ещё не загрузили, true/false = онбординг уже пройден / не пройден */
  onboardingSeen: boolean | null;
  setOnboardingSeen: (v: boolean) => void;
  interactiveStep: number | null;
  /** true, когда идёт интерактивная обучалка (для отображения демо-данных на Календаре и Статистике без записи в память) */
  isOnboardingActive: boolean;
  setInteractiveStep: (step: number | null) => void;
  registerTarget: (name: string, layout: SpotLayout) => void;
  targets: Record<string, SpotLayout>;
  stepConfig: InteractiveStepConfig[];
  startInteractive: () => void;
  finishInteractive: () => void;
};

const defaultValue: OnboardingContextValue = {
  onboardingSeen: null,
  setOnboardingSeen: () => {},
  interactiveStep: null,
  isOnboardingActive: false,
  setInteractiveStep: () => {},
  registerTarget: () => {},
  targets: {},
  stepConfig: INTERACTIVE_STEPS,
  startInteractive: () => {},
  finishInteractive: () => {},
};

const OnboardingContext = createContext<OnboardingContextValue>(defaultValue);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  const [interactiveStep, setInteractiveStep] = useState<number | null>(null);
  const [targets, setTargets] = useState<Record<string, SpotLayout>>({});

  useEffect(() => {
    let cancelled = false;
    getHasSeenOnboarding().then((seen) => {
      if (!cancelled) {
        setOnboardingSeen(seen);
        if (!seen) {
          setTargets({});
          setInteractiveStep(0);
        }
      }
    });
    return () => { cancelled = true; };
  }, []);

  const registerTarget = useCallback((name: string, layout: SpotLayout) => {
    setTargets((prev) => {
      const next = { ...prev };
      next[name] = layout;
      return next;
    });
  }, []);

  const startInteractive = useCallback(() => {
    setTargets({});
    setInteractiveStep(0);
  }, []);

  const finishInteractive = useCallback(() => {
    setInteractiveStep(null);
  }, []);

  const value: OnboardingContextValue = {
    onboardingSeen,
    setOnboardingSeen,
    interactiveStep,
    isOnboardingActive: interactiveStep !== null,
    setInteractiveStep,
    registerTarget,
    targets,
    stepConfig: INTERACTIVE_STEPS,
    startInteractive,
    finishInteractive,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
