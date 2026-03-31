import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { PresetDrink } from '../types/preset';
import type { Drink } from '../types/drink';
import { formatTotalVolume } from '../utils/units';
import { detectDefaultLanguage, t } from '../i18n/i18n';

const COLORS = {
  bg: '#0c1222',
  card: '#151d32',
  cardBorder: '#1e293b',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  accent: '#6366f1',
  accentSoft: '#818cf8',
} as const;

export interface FavoritesWidgetProps {
  presets: PresetDrink[];
  todayDrinks?: Drink[];
}

function SectionHeader({ title }: { title: string }) {
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
      }}
    >
      <TextWidget
        text={title}
        style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textMuted, letterSpacing: 0.5 }}
      />
    </FlexWidget>
  );
}

export function FavoritesWidget({ presets, todayDrinks = [] }: FavoritesWidgetProps) {
  const language = detectDefaultLanguage();
  const todayList = todayDrinks.slice(0, 5);
  const presetList = presets.slice(0, 5);

  return (
    <FlexWidget
      style={{
        flex: 1,
        flexDirection: 'row',
        padding: 14,
        flexGap: 10,
        backgroundColor: COLORS.bg,
      }}
    >
      {/* Колонка: Избранное */}
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: 'column',
          flexGap: 6,
        }}
      >
        <SectionHeader title={t(language, 'widgets.favoritesTitle')} />
        {presetList.length === 0 ? (
          <FlexWidget
            style={{
              paddingVertical: 10,
              paddingHorizontal: 8,
              backgroundColor: COLORS.card,
              borderRadius: 8,
            }}
          >
            <TextWidget
              text={t(language, 'widgets.favoritesEmpty')}
              style={{ fontSize: 12, color: COLORS.textDim }}
            />
          </FlexWidget>
        ) : (
          presetList.map((preset) => (
            <FlexWidget
              key={preset.id}
              clickAction="ADD_DRINK"
              clickActionData={{ presetId: preset.id }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 10,
                backgroundColor: COLORS.card,
                borderRadius: 8,
                borderLeftWidth: 3,
                borderLeftColor: COLORS.accent,
              }}
            >
              <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 2 }}>
                <TextWidget
                  text={preset.name}
                  style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}
                />
                <TextWidget
                  text={`${preset.volumeMl} ${t(language, 'widgets.mlShort')} · ${preset.abvPercent}%`}
                  style={{ fontSize: 11, color: COLORS.textDim }}
                />
              </FlexWidget>
              <TextWidget
                text="+"
                style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.accentSoft }}
              />
            </FlexWidget>
          ))
        )}
      </FlexWidget>

      {/* Разделитель */}
      <FlexWidget
        style={{
          width: 1,
          backgroundColor: COLORS.cardBorder,
          alignSelf: 'stretch',
        }}
      />

      {/* Колонка: Сегодня */}
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: 'column',
          flexGap: 6,
        }}
      >
        <SectionHeader title={t(language, 'widgets.todayTitle')} />
        {todayList.length === 0 ? (
          <FlexWidget
            style={{
              paddingVertical: 10,
              paddingHorizontal: 8,
              backgroundColor: COLORS.card,
              borderRadius: 8,
            }}
          >
            <TextWidget
              text={t(language, 'widgets.todayEmpty')}
              style={{ fontSize: 12, color: COLORS.textDim }}
            />
          </FlexWidget>
        ) : (
          todayList.map((d) => (
            <FlexWidget
              key={d.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 10,
                backgroundColor: COLORS.card,
                borderRadius: 8,
              }}
            >
              <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 2 }}>
                <TextWidget
                  text={d.name}
                  style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}
                />
                <TextWidget
                  text={d.quantity && d.quantity > 1 ? `${formatTotalVolume(d.volumeMl, d.quantity)} · ${d.quantity}×` : `${d.volumeMl} ${t(language, 'widgets.mlShort')}`}
                  style={{ fontSize: 11, color: COLORS.textDim }}
                />
              </FlexWidget>
            </FlexWidget>
          ))
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
