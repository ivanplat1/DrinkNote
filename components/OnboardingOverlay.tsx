import React, { useRef, useState, useEffect } from 'react';
import { View, Modal, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from '../context/OnboardingContext';
import { useTheme } from '../theme/ThemeContext';
import OnboardingOverlayContent from './OnboardingOverlayContent';
import type { SpotLayout } from '../context/OnboardingContext';

type Props = { onComplete?: () => void };
type VisualSnapshot = { stepIndex: number; hideSpotlight: boolean; layout: SpotLayout | null };
const ONE_TIME_ENTRY_SPOT_MARGINS = { top: 10, right: 10, bottom: 10, left: 10 };
const SPOTLIGHT_STEP_KEYS = new Set(['favorites', 'favoritesEdit', 'addButton', 'oneTimeEntry']);
const TAB_BAR_EXTRA_MARGIN = 4;
const FOOTER_EXTRA_OFFSET = -20;

export default function OnboardingOverlay({ onComplete }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { interactiveStep, setInteractiveStep, targets, stepConfig, finishInteractive } = useOnboarding();
  const overlayRef = useRef<View>(null);
  const [overlayOrigin, setOverlayOrigin] = useState({ x: 0, y: 0 });
  const [snapshot, setSnapshot] = useState<VisualSnapshot | null>(null);

  useEffect(() => {
    if (interactiveStep === null) return;
    const key = stepConfig[interactiveStep]?.key;
    if (key && targets[key]) {
      const frame = requestAnimationFrame(() => {
        overlayRef.current?.measureInWindow((ox, oy) => {
          setOverlayOrigin((prev) => (prev.x === ox && prev.y === oy ? prev : { x: ox, y: oy }));
        });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [interactiveStep, targets, stepConfig]);

  useEffect(() => {
    if (interactiveStep === null) {
      setSnapshot(null);
      return;
    }
    const step = stepConfig[interactiveStep];
    if (!step) return;
    const target = targets[step.key];
    const requiresSpotlight = SPOTLIGHT_STEP_KEYS.has(step.key);
    if (requiresSpotlight && !target) return;
    const hideSpotlight = step.key === 'welcome' || !target;
    const layout = !hideSpotlight && target
      ? { x: target.x - overlayOrigin.x, y: target.y - overlayOrigin.y, width: target.width, height: target.height }
      : null;
    const next: VisualSnapshot = { stepIndex: interactiveStep, hideSpotlight, layout };
    setSnapshot((prev) => {
      if (!prev) return next;
      const sameMeta = prev.stepIndex === next.stepIndex && prev.hideSpotlight === next.hideSpotlight;
      const sameLayout =
        prev.layout === next.layout ||
        (!!prev.layout &&
          !!next.layout &&
          prev.layout.x === next.layout.x &&
          prev.layout.y === next.layout.y &&
          prev.layout.width === next.layout.width &&
          prev.layout.height === next.layout.height);
      return sameMeta && sameLayout ? prev : next;
    });
  }, [interactiveStep, stepConfig, targets, overlayOrigin]);

  if (!snapshot) return null;
  const step = stepConfig[snapshot.stepIndex];
  if (!step) return null;

  const isLast = snapshot.stepIndex === stepConfig.length - 1;
  const isIOS = Platform.OS === 'ios';
  const tabBarHeightFromStyle =
    (isIOS ? 60 + Math.max(8, insets.bottom) : 70 + Math.max(0, insets.bottom)) + TAB_BAR_EXTRA_MARGIN;
  // Полностью резервируем область таббара + небольшой запас, смещая футер чуть ниже внутри этой области.
  const bottomReservedSpace = tabBarHeightFromStyle;
  const goNext = () => {
    if (isLast) {
      finishInteractive();
      setTimeout(() => onComplete?.(), 0);
    } else {
      setInteractiveStep(snapshot.stepIndex + 1);
    }
  };

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
          layout={snapshot.layout}
          tooltip={step.tooltip}
          isLast={isLast}
          onNext={goNext}
          hideSpotlight={snapshot.hideSpotlight}
          tightTop={step?.key === 'oneTimeEntry'}
          // Чуть опускаем текст и кнопку ближе к таббару
          footerOffset={FOOTER_EXTRA_OFFSET}
          bottomReservedSpace={bottomReservedSpace}
          spotMargins={step?.key === 'oneTimeEntry' ? ONE_TIME_ENTRY_SPOT_MARGINS : undefined}
        />
      </View>
    </Modal>
  );
}
