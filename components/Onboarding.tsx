import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons, Entypo } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const { t, language } = useI18n();
  const [index, setIndex] = useState(0);
  const listRef = React.useRef<FlatList>(null);

  // Memoize slides by language so FlatList reliably re-renders visible items.
  const slides: Slide[] = useMemo(
    () => [
      {
        key: "hello",
        icon: <Ionicons name="hand-left" size={72} color={colors.primary} />,
        title: t("onboarding.slides.helloTitle"),
        description: t("onboarding.slides.helloDesc"),
      },
      {
        key: "welcome",
        icon: <Ionicons name="wine" size={72} color={colors.primary} />,
        title: t("onboarding.slides.welcomeTitle"),
        description: t("onboarding.slides.welcomeDesc"),
      },
      {
        key: "favorites",
        icon: <MaterialIcons name="star" size={72} color={colors.primary} />,
        title: t("onboarding.slides.favoritesTitle"),
        description: t("onboarding.slides.favoritesDesc"),
      },
      {
        key: "add",
        icon: (
          <Entypo name="circle-with-plus" size={72} color={colors.primary} />
        ),
        title: t("onboarding.slides.addTitle"),
        description: t("onboarding.slides.addDesc"),
      },
      {
        key: "custom",
        icon: (
          <MaterialIcons
            name="add-circle-outline"
            size={72}
            color={colors.primary}
          />
        ),
        title: t("onboarding.slides.customTitle"),
        description: t("onboarding.slides.customDesc"),
      },
      {
        key: "edit",
        icon: (
          <MaterialIcons name="touch-app" size={72} color={colors.primary} />
        ),
        title: t("onboarding.slides.editTitle"),
        description: t("onboarding.slides.editDesc"),
      },
    ],
    [colors.primary, language, t],
  );

  const onViewableItemsChanged = React.useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) setIndex(viewableItems[0].index ?? 0);
    },
    [],
  );
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onComplete}
          style={styles.skipBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            {t("onboarding.skip")}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        key={language}
        data={slides}
        extraData={language}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.key}
        getItemLayout={(_, i) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * i,
          index: i,
        })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.backgroundCard },
              ]}
            >
              {item.icon}
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {item.description}
            </Text>
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
                {
                  backgroundColor: i === index ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          onPress={goNext}
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Text style={styles.nextText}>
            {isLast ? t("onboarding.done") : t("onboarding.next")}
          </Text>
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
    flexDirection: "row",
    justifyContent: "flex-end",
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
    alignItems: "center",
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
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
    alignItems: "center",
  },
  nextText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
