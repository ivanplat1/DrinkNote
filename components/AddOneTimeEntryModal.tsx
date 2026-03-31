import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
  ScrollView,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import type { Drink } from '../types/drink';
import type { ThemeColors } from '../theme/themes';
import { useI18n } from '../i18n/I18nContext';

const BEVERAGE_TYPES: Array<Drink['beverageType']> = ['beer', 'wine', 'spirit', 'cocktail', 'other'];

function getBeverageColors(type: Drink['beverageType'], themeColors: ThemeColors) {
  const c = themeColors[type] ?? themeColors.other;
  return { main: c.main, light: c.light, text: c.text };
}

const TYPE_LABEL_KEYS: Record<Drink['beverageType'], string> = {
  beer: 'drinkTypes.beer',
  wine: 'drinkTypes.wine',
  spirit: 'drinkTypes.spirit',
  cocktail: 'drinkTypes.cocktail',
  other: 'drinkTypes.other',
};

const TYPE_DEFAULTS: Record<Drink['beverageType'], { volumeMl: number; abvPercent: number }> = {
  beer: { volumeMl: 500, abvPercent: 5 },
  wine: { volumeMl: 150, abvPercent: 12 },
  spirit: { volumeMl: 50, abvPercent: 40 },
  cocktail: { volumeMl: 300, abvPercent: 15 },
  other: { volumeMl: 100, abvPercent: 20 },
};

export type OneTimeEntryData = {
  name: string;
  beverageType: Drink['beverageType'];
  volumeMl: number;
  abvPercent: number;
  price?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  isPremium: boolean;
  onSave: (data: OneTimeEntryData) => void;
};

// Смещения прокрутки под клавиатуру (Android: клавиатура выше, прокручиваем сильнее)
const SCROLL_Y_VOLUME_ABV = Platform.OS === 'android' ? 260 : 180;
const SCROLL_Y_PRICE = Platform.OS === 'android' ? 420 : 320;

export default function AddOneTimeEntryModal({ visible, onClose, isPremium, onSave }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);

  const [name, setName] = useState('');
  const [beverageType, setBeverageType] = useState<Drink['beverageType']>('cocktail');
  const [volumeStr, setVolumeStr] = useState('300');
  const [abvStr, setAbvStr] = useState('15');
  const [priceStr, setPriceStr] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      setBeverageType('cocktail');
      setVolumeStr('300');
      setAbvStr('15');
      setPriceStr('');
      translateY.value = 0;
    }
  }, [visible]);

  // При появлении клавиатуры прокручиваем к полям; при скрытии — возврат (на Android модалка не остаётся поднятой)
  useEffect(() => {
    if (!visible) return;
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollTo({ y: SCROLL_Y_VOLUME_ABV, animated: true });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const selectType = (type: Drink['beverageType']) => {
    setBeverageType(type);
    setName('');
    setVolumeStr('');
    setAbvStr('');
    if (type !== 'other') {
      const d = TYPE_DEFAULTS[type];
      setVolumeStr(String(d.volumeMl));
      setAbvStr(String(d.abvPercent));
    }
  };

  const handleSave = () => {
    const n = name.trim() || t(TYPE_LABEL_KEYS[beverageType]);
    const vol = parseFloat(volumeStr.replace(',', '.'));
    const abv = parseFloat(abvStr.replace(',', '.'));
    if (!n) {
      Alert.alert(t('common.error'), t('oneTimeEntry.nameOrTypeError'));
      return;
    }
    if (isNaN(vol) || vol <= 0) {
      Alert.alert(t('common.error'), t('oneTimeEntry.volumeError'));
      return;
    }
    if (isNaN(abv) || abv < 0 || abv > 100) {
      Alert.alert(t('common.error'), t('oneTimeEntry.abvError'));
      return;
    }
    const priceNum = priceStr.trim() ? parseFloat(priceStr.replace(',', '.')) : undefined;
    const price = isPremium && priceNum != null && !isNaN(priceNum) && priceNum >= 0
      ? Math.round(priceNum * 100) / 100
      : undefined;
    onSave({
      name: n,
      beverageType,
      volumeMl: vol,
      abvPercent: abv,
      ...(price != null && { price }),
    });
    onClose();
  };

  const panGesture = Gesture.Pan()
    .minDistance(5)
    .activeOffsetY([5, 100])
    .failOffsetX([-30, 30])
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 50) {
        translateY.value = withSpring(1000, { damping: 20, stiffness: 300 }, () => {
          runOnJS(onClose)();
          translateY.value = 0;
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, translateY.value) }],
  }));

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        >
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <GestureDetector gesture={panGesture}>
                <Animated.View
                  style={[
                    styles.card,
                    { backgroundColor: colors.backgroundCard },
                    { paddingBottom: 20 + insets.bottom },
                    animatedStyle,
                  ]}
                >
                  <TouchableOpacity style={styles.dragHandle} onPress={onClose} activeOpacity={1}>
                    <View style={[styles.dragBar, { backgroundColor: colors.textTertiary }]} />
                  </TouchableOpacity>
                  <ScrollView
                    ref={scrollRef}
                    style={styles.scrollView}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 360 }}
                  >
                    <Text style={[styles.title, { color: colors.text }]}>{t('todayScreen.addOneTime')}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                      {t('oneTimeEntry.subtitle')}
                    </Text>

                    <Text style={[styles.label, { color: colors.text }]}>{t('oneTimeEntry.name')}</Text>
                    <TextInput
                      placeholder={t('oneTimeEntry.namePlaceholder')}
                      placeholderTextColor={colors.textTertiary}
                      value={name}
                      onChangeText={setName}
                      style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      returnKeyType="next"
                    />

                    <Text style={[styles.label, { color: colors.text }]}>{t('oneTimeEntry.type')}</Text>
                    <View style={styles.typeRow}>
                      {BEVERAGE_TYPES.map((t) => {
                        const bc = getBeverageColors(t, colors as ThemeColors);
                        const isSelected = beverageType === t;
                        return (
                          <TouchableOpacity
                            key={t}
                            style={[
                              styles.typeChip,
                              {
                                backgroundColor: isSelected ? bc.main : bc.light,
                                borderColor: bc.main,
                              },
                            ]}
                            onPress={() => selectType(t)}
                          >
                            <Text style={[styles.typeChipText, { color: isSelected ? '#fff' : bc.text }]}>
                              {t(TYPE_LABEL_KEYS[t])}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.row}>
                      <View style={styles.half}>
                        <Text style={[styles.label, { color: colors.text }]}>{t('todayScreen.volumeMlLabel')}</Text>
                        <TextInput
                          placeholder="300"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={volumeStr}
                          onChangeText={setVolumeStr}
                          onFocus={() => scrollRef.current?.scrollTo({ y: SCROLL_Y_VOLUME_ABV, animated: true })}
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                        />
                      </View>
                      <View style={styles.half}>
                        <Text style={[styles.label, { color: colors.text }]}>{t('todayScreen.abvLabel')}</Text>
                        <TextInput
                          placeholder="15"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={abvStr}
                          onChangeText={setAbvStr}
                          onFocus={() => scrollRef.current?.scrollTo({ y: SCROLL_Y_VOLUME_ABV, animated: true })}
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                        />
                      </View>
                    </View>

                    {isPremium && (
                      <>
                        <Text style={[styles.label, { color: colors.text }]}>{t('todayScreen.price')}</Text>
                        <TextInput
                          placeholder={t('oneTimeEntry.notSpecified')}
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          value={priceStr}
                          onChangeText={(t) => setPriceStr(t.replace(',', '.'))}
                          onFocus={() => scrollRef.current?.scrollTo({ y: SCROLL_Y_PRICE, animated: true })}
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                        />
                      </>
                    )}

                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                      onPress={handleSave}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </Animated.View>
            </GestureDetector>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 4,
    paddingHorizontal: 20,
    height: '75%',
  },
  scrollView: {
    flex: 1,
  },
  dragHandle: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 28,
  },
  dragBar: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginRight: 8,
    marginBottom: 8,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
