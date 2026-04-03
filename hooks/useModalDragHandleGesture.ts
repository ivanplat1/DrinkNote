import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import { runOnJS, withSpring } from 'react-native-reanimated';

const SPRING = { damping: 20, stiffness: 300 };
const DISMISS_PX = 50;
/** Быстрый «флик» вниз тоже закрывает */
const DISMISS_VELOCITY_Y = 800;

/**
 * Жест для верхней полоски модалки: свайп вниз или тап закрывают окно.
 * Tap/Pan из RNGH вместе с обычным TouchableOpacity, чтобы Pan не терялся.
 */
export function useModalDragHandleGesture(
  translateY: SharedValue<number>,
  onClose: () => void
) {
  return useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(5)
      .activeOffsetY([5, 100])
      .failOffsetX([-30, 30])
      .onUpdate((e) => {
        'worklet';
        if (e.translationY > 0) {
          translateY.value = e.translationY;
        }
      })
      .onEnd((e) => {
        'worklet';
        if (e.translationY > DISMISS_PX || e.velocityY > DISMISS_VELOCITY_Y) {
          translateY.value = withSpring(1000, SPRING, () => {
            runOnJS(onClose)();
            translateY.value = 0;
          });
        } else {
          translateY.value = withSpring(0, SPRING);
        }
      });

    const tap = Gesture.Tap().onEnd(() => {
      'worklet';
      translateY.value = 0;
      runOnJS(onClose)();
    });

    return Gesture.Exclusive(pan, tap);
  }, [translateY, onClose]);
}
