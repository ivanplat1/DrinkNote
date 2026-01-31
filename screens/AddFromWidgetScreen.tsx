import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getUserPresets } from '../storage/presets';
import { addOrMergeDrink } from '../storage/drinks';
import { isPremiumUser } from '../storage/premium';
import { calculateStandardUnits } from '../utils/units';
import { formatISO } from '../utils/date';
import type { Drink } from '../types/drink';

type RouteParams = { presetId?: string };

export default function AddFromWidgetScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params ?? {}) as RouteParams;
  const presetId = params.presetId;
  const addedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!presetId) {
        navigation.replace('MainTabs');
        return;
      }
      if (addedRef.current) return;
      addedRef.current = true;

      const presets = await getUserPresets();
      const preset = presets.find((p) => p.id === presetId);
      if (cancelled || !preset) {
        navigation.replace('MainTabs');
        return;
      }
      const today = formatISO(new Date());
      const units = calculateStandardUnits(preset.volumeMl, preset.abvPercent);
      const isPremium = await isPremiumUser();
      const price = isPremium && preset.defaultPrice != null && preset.defaultPrice > 0 ? preset.defaultPrice : undefined;
      const entry: Drink = {
        id: `drink_${Date.now()}`,
        dateISO: today,
        name: preset.name,
        beverageType: preset.beverageType,
        volumeMl: preset.volumeMl,
        abvPercent: preset.abvPercent,
        standardUnits: units,
        quantity: 1,
        ...(price != null && { price }),
      };
      await addOrMergeDrink(entry);
      if (!cancelled) {
        navigation.replace('MainTabs');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [presetId, navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
