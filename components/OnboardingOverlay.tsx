import React, { useRef, useState, useEffect } from 'react';
import { View, Modal, StyleSheet } from 'react-native';
import { useOnboarding } from '../context/OnboardingContext';
import { useTheme } from '../theme/ThemeContext';
import OnboardingOverlayContent from './OnboardingOverlayContent';

type Props = { onComplete?: () => void };
// Визуально у пунктирной кнопки сверху/по бокам зазор воспринимается меньше,
// поэтому делаем асимметричный внешний отступ рамки.
const ONE_TIME_ENTRY_SPOT_MARGINS = { top: 10, right: 10, bottom: 10, left: 10 };

/** Оверлей для шагов 3–6 (Календарь, Статистика, Настройки, профиль). Непрозрачный фон — без «швов» при смене слайда. */
export default function OnboardingOverlay({ onComplete }: Props) {
  const { colors } = useTheme();
  const { interactiveStep, setInteractiveStep, targets, stepConfig, finishInteractive } = useOnboarding();
  const overlayRef = useRef<View>(null);
  const [overlayOrigin, setOverlayOrigin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (interactiveStep === null || interactiveStep < 4) return;
    const key = stepConfig[interactiveStep]?.key;
    if (key && targets[key]) {
      const t = setTimeout(() => {
        overlayRef.current?.measureInWindow((ox, oy) => setOverlayOrigin({ x: ox, y: oy }));
      }, 50);
      return () => clearTimeout(t);
    }
  }, [interactiveStep, targets, stepConfig]);

  if (interactiveStep === null) return null;

  const step = stepConfig[interactiveStep];
  if (!step) return null;

  const hideSpotlight = false;
  const raw = !hideSpotlight && targets[step.key] ? targets[step.key] : null;
  const layout = raw
    ? { x: raw.x - overlayOrigin.x, y: raw.y - overlayOrigin.y, width: raw.width, height: raw.height }
    : null;
  if (__DEV__ && step?.key === 'oneTimeEntry' && raw) {
    console.log('[OnboardingOverlay oneTimeEntry] overlayOrigin', overlayOrigin, 'raw', raw, 'layout', layout);
  }

  const isLast = interactiveStep === stepConfig.length - 1;
  const goNext = () => {
    if (isLast) {
      finishInteractive();
      setTimeout(() => onComplete?.(), 0);
    } else {
      setInteractiveStep(interactiveStep + 1);
    }
  };

  // Прозрачный фон на шагах 3–6, чтобы были видны Календарь, Статистика и Настройки.
  const opaqueOverlay = false;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View
        ref={overlayRef}
        style={[StyleSheet.absoluteFill, opaqueOverlay ? { backgroundColor: colors.background } : null]}
        pointerEvents="auto"
        collapsable={false}
      >
        <OnboardingOverlayContent
          layout={layout}
          tooltip={step.tooltip}
          isLast={isLast}
          onNext={goNext}
          hideSpotlight={hideSpotlight}
          tightTop={step?.key === 'oneTimeEntry'}
          footerOffset={0}
          bottomReservedSpace={96}
          spotMargins={step?.key === 'oneTimeEntry' ? ONE_TIME_ENTRY_SPOT_MARGINS : undefined}
        />
      </View>
    </Modal>
  );
}
