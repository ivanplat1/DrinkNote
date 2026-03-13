import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import type { SpotLayout } from '../context/OnboardingContext';

const SPOT_PADDING = 12;
const SPOT_PADDING_BOTTOM = 4;

export type OnboardingOverlayContentProps = {
  /** Координаты цели (уже в системе координат родителя оверлея — без доп. пересчёта) */
  layout: SpotLayout | null | undefined;
  tooltip: string;
  isLast: boolean;
  onNext: () => void;
  /** Не рисовать затемнение и рамку (шаги 3–4) */
  hideSpotlight?: boolean;
  /** Только для шага 0: уменьшить отступ снизу у рамки, чтобы не обрезало */
  tightBottom?: boolean;
  /** Не добавлять отступ сверху у рамки */
  tightTop?: boolean;
  /** Доп. отступ снизу у футера (для оверлея поверх табов — приподнять блок, чтобы были видны вкладки) */
  footerOffset?: number;
  /** Зарезервировать снизу область (например под таб-бар), чтобы не затемнять и не перекрывать её футером */
  bottomReservedSpace?: number;
  /** Не затемнять область ниже подсветки */
  hideBottomShade?: boolean;
  /** Явные внешние отступы рамки вокруг target (top/right/bottom/left) */
  spotMargins?: { top: number; right: number; bottom: number; left: number };
  /** Временная блокировка кнопки "Далее" */
  nextDisabled?: boolean;
};

export default function OnboardingOverlayContent({
  layout,
  tooltip,
  isLast,
  onNext,
  hideSpotlight = false,
  tightBottom = false,
  tightTop = false,
  footerOffset = 0,
  bottomReservedSpace = 0,
  hideBottomShade = false,
  spotMargins,
  nextDisabled = false,
}: OnboardingOverlayContentProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const shadeOpacity = useRef(new Animated.Value(1)).current;
  const spotlightOpacity = useRef(new Animated.Value(1)).current;
  const spotlightScale = useRef(new Animated.Value(1)).current;
  const footerTranslateY = useRef(new Animated.Value(0)).current;

  const defaultTop = tightTop ? 0 : SPOT_PADDING;
  const defaultRight = SPOT_PADDING;
  const defaultBottom = tightBottom ? SPOT_PADDING_BOTTOM : SPOT_PADDING;
  const defaultLeft = SPOT_PADDING;
  const topPad = spotMargins?.top ?? defaultTop;
  const rightPad = spotMargins?.right ?? defaultRight;
  const bottomPad = spotMargins?.bottom ?? defaultBottom;
  const leftPad = spotMargins?.left ?? defaultLeft;

  const x = (layout?.x ?? 0) - leftPad;
  const rawY = (layout?.y ?? 0) - topPad;
  const y = Math.max(0, rawY);
  const w = (layout?.width ?? 0) + leftPad + rightPad;
  const h = (layout?.height ?? 0) + topPad + bottomPad;

  useEffect(() => {
    shadeOpacity.setValue(0.65);
    spotlightOpacity.setValue(0);
    spotlightScale.setValue(0.92);
    footerTranslateY.setValue(28);

    const smoothOut = Easing.bezier(0.22, 1, 0.36, 1);

    Animated.parallel([
      Animated.timing(shadeOpacity, {
        toValue: 1,
        duration: 480,
        easing: smoothOut,
        useNativeDriver: true,
      }),
      Animated.timing(spotlightOpacity, {
        toValue: 1,
        duration: 580,
        easing: smoothOut,
        useNativeDriver: true,
      }),
      Animated.timing(spotlightScale, {
        toValue: 1,
        duration: 580,
        easing: smoothOut,
        useNativeDriver: true,
      }),
      Animated.timing(footerTranslateY, {
        toValue: 0,
        duration: 600,
        easing: smoothOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, [tooltip, hideSpotlight, shadeOpacity, spotlightOpacity, spotlightScale, footerTranslateY]);

  return (
    <>
      {hideSpotlight ? (
        <Animated.View
          style={[
            styles.shade,
            {
              opacity: shadeOpacity,
              backgroundColor: 'rgba(0,0,0,0.5)',
              top: 0,
              left: 0,
              right: 0,
              // Не затемняем область под футером и таб-баром, как на остальных шагах.
              bottom: bottomReservedSpace,
            },
          ]}
        />
      ) : layout ? (
        <>
          <Animated.View
            style={[
              styles.shade,
              {
                opacity: shadeOpacity,
                backgroundColor: 'rgba(0,0,0,0.65)',
                top: 0,
                left: 0,
                right: 0,
                height: Math.max(0, y),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.shade,
              {
                opacity: shadeOpacity,
                backgroundColor: 'rgba(0,0,0,0.65)',
                top: y,
                left: 0,
                width: Math.max(0, x),
                height: h,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.shade,
              {
                opacity: shadeOpacity,
                backgroundColor: 'rgba(0,0,0,0.65)',
                top: y,
                left: x + w,
                right: 0,
                height: h,
              },
            ]}
          />
          {!hideBottomShade && (
            <Animated.View
              style={[
                styles.shade,
                {
                  opacity: shadeOpacity,
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  top: y + h,
                  left: 0,
                  right: 0,
                  // Затемняем до самого низа под футер (но не таб-бар).
                  bottom: bottomReservedSpace,
                },
              ]}
            />
          )}
          <Animated.View
            style={[
              styles.spotlight,
              {
                opacity: spotlightOpacity,
                transform: [{ scale: spotlightScale }],
                left: x,
                top: y,
                width: w,
                height: h,
                borderColor: colors.primary,
                backgroundColor: 'transparent',
              },
            ]}
          />
        </>
      ) : (
        <Animated.View
          style={[
            styles.shade,
            {
              opacity: shadeOpacity,
              backgroundColor: 'rgba(0,0,0,0.65)',
              top: 0,
              left: 0,
              right: 0,
              bottom: bottomReservedSpace,
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.footer,
          {
            transform: [{ translateY: footerTranslateY }],
            bottom: bottomReservedSpace,
            paddingBottom: 16 + insets.bottom + footerOffset,
            paddingHorizontal: 20,
          },
        ]}
        pointerEvents="auto"
      >
        <View style={[styles.footerSurface, { backgroundColor: 'transparent' }]} pointerEvents="none" />
        <View style={[styles.tooltipCard, { backgroundColor: colors.backgroundCard, borderColor: colors.primary }]}>
          <Text style={[styles.tooltip, { color: colors.text }]}>{tooltip}</Text>
        </View>
        <TouchableOpacity
          onPress={onNext}
          disabled={nextDisabled}
          style={[styles.nextBtn, { backgroundColor: colors.primary, opacity: nextDisabled ? 0.75 : 1 }]}
          activeOpacity={0.8}
        >
          <Text style={styles.nextText}>{isLast ? 'Готово' : 'Далее'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  shade: { position: 'absolute', zIndex: 1 },
  spotlight: {
    position: 'absolute',
    zIndex: 2,
    borderWidth: 3,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, elevation: 20 },
  footerSurface: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tooltipCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    ...(Platform.OS === 'android' ? { elevation: 8 } : {}),
  },
  tooltip: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  nextBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
