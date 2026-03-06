import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, Entypo } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Slide = {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

type Props = {
  onComplete: () => void;
  /** После последнего слайда — перейти в интерактивный режим (подсветка на экране «Сегодня») */
  onStartInteractive?: () => void;
};

export default function Onboarding({ onComplete, onStartInteractive }: Props) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const listRef = React.useRef<FlatList>(null);

  const slides: Slide[] = [
    {
      key: 'welcome',
      icon: <Ionicons name="wine" size={72} color={colors.primary} />,
      title: 'Добро пожаловать в DrinkNote',
      description: 'Удобный учёт алкоголя: избранное, календарь, статистика и цели. Коротко покажем основы.',
    },
    {
      key: 'favorites',
      icon: <MaterialIcons name="star" size={72} color={colors.primary} />,
      title: 'Избранное',
      description: 'На вкладке «Сегодня» в блоке «Избранное» — ваши сохранённые напитки. Нажатие по кнопке — и запись добавлена на выбранную дату.',
    },
    {
      key: 'add',
      icon: <Entypo name="circle-with-plus" size={72} color={colors.primary} />,
      title: 'Как добавить напиток',
      description: 'Нажмите «+» в избранном или кнопку добавления — выберите напиток из списка или добавьте свой (название, объём, крепость).',
    },
    {
      key: 'custom',
      icon: <MaterialIcons name="add-circle-outline" size={72} color={colors.primary} />,
      title: 'Свой напиток',
      description: 'В окне выбора напитка нажмите «Свой напиток» — введите название, тип, объём (мл) и крепость (%). Можно сохранить в избранное.',
    },
    {
      key: 'edit',
      icon: <MaterialIcons name="touch-app" size={72} color={colors.primary} />,
      title: 'Редактирование и удаление',
      description: 'Долгое нажатие на кнопку в избранном или на запись в списке дня — откроются действия: изменить или удалить.',
    },
  ];

  const onViewableItemsChanged = React.useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setIndex(viewableItems[0].index ?? 0);
  }, []);
  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

  const isLast = index === slides.length - 1;
  const goNext = () => {
    if (isLast) {
      if (onStartInteractive) {
        onStartInteractive();
      } else {
        onComplete();
      }
      return;
    }
    const next = index + 1;
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onComplete} style={styles.skipBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Пропустить</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.key}
        getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.backgroundCard }]}>{item.icon}</View>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
          </View>
        )}
        ref={listRef}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === index ? colors.primary : colors.border },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          onPress={goNext}
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Text style={styles.nextText}>{isLast ? 'Готово' : 'Далее'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 16,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
