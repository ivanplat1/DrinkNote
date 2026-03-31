import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getHasSeenOnboarding } from '../storage/settings';
import { t as translate } from '../i18n/i18n';
import { getCurrentLanguageUnsafe } from '../i18n/I18nContext';

export type SpotLayout = { x: number; y: number; width: number; height: number };

export type InteractiveStepConfig = {
  key: string;
  tooltip: string;
};

const INTERACTIVE_STEPS: InteractiveStepConfig[] = [
  {
    key: 'welcome',
    tooltip: 'onboarding.tooltips.welcome',
  },
  {
    key: 'favorites',
    tooltip: 'onboarding.tooltips.favorites',
  },
  {
    key: 'favoritesEdit',
    tooltip: 'onboarding.tooltips.favoritesEdit',
  },
  {
    key: 'addButton',
    tooltip: 'onboarding.tooltips.addButton',
  },
  {
    key: 'oneTimeEntry',
    tooltip: 'onboarding.tooltips.oneTimeEntry',
  },
  {
    key: 'calendar',
    tooltip: 'onboarding.tooltips.calendar',
  },
  {
    key: 'stats',
    tooltip: 'onboarding.tooltips.stats',
  },
  {
    key: 'settings',
    tooltip: 'onboarding.tooltips.settings',
  },
  {
    key: 'fullVersionBenefits',
    tooltip: 'onboarding.tooltips.fullVersionBenefits',
  },
  {
    key: 'profileForNorm',
    tooltip: 'onboarding.tooltips.profileForNorm',
  },
];

function resolveInteractiveSteps(): InteractiveStepConfig[] {
  const lang = getCurrentLanguageUnsafe();
  return INTERACTIVE_STEPS.map((s) => ({ ...s, tooltip: translate(lang, s.tooltip) }));
}

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
  stepConfig: resolveInteractiveSteps(),
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
      if (cancelled) return;
      setOnboardingSeen(seen);
      if (!seen) {
        setTargets({});
        setInteractiveStep(0);
      }
    });
    return () => {
      cancelled = true;
    };
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
    stepConfig: resolveInteractiveSteps(),
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
