import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { detectDefaultLanguage, formatDaysCount, t } from '../i18n/i18n';

const COLORS = {
  bg: '#0c1222',
  card: '#151d32',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  accent: '#6366f1',
  accentSoft: '#818cf8',
} as const;

export interface StreakWidgetProps {
  currentStreak: number;
  bestStreak?: number;
}

export function StreakWidget({ currentStreak, bestStreak }: StreakWidgetProps) {
  const language = detectDefaultLanguage();
  const bestLabel = bestStreak != null && bestStreak > 0
    ? t(language, 'widgets.record').replace('{{days}}', formatDaysCount(language, bestStreak))
    : null;
  const hasStreak = currentStreak > 0;

  return (
    <FlexWidget
      style={{
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 18,
        flexGap: 6,
        backgroundColor: COLORS.bg,
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 20,
          backgroundColor: COLORS.card,
          borderRadius: 12,
          flexGap: 4,
        }}
      >
        <TextWidget text="🔥" style={{ fontSize: 32 }} />
        <TextWidget
          text={currentStreak <= 0 ? '—' : formatDaysCount(language, currentStreak)}
          style={{
            fontSize: 26,
            fontWeight: 'bold',
            color: hasStreak ? COLORS.accentSoft : COLORS.text,
          }}
        />
        <TextWidget
          text={t(language, 'widgets.alcoholFree')}
          style={{ fontSize: 12, color: COLORS.textMuted }}
        />
        {bestLabel != null && (
          <TextWidget
            text={bestLabel}
            style={{ fontSize: 11, color: COLORS.textDim }}
          />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
