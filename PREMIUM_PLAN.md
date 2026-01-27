# Premium Features Implementation Plan

## Implementation Order

1. **Stage 1: Premium Infrastructure** - Foundation
2. **Stage 3: Advanced Statistics** - Core value
3. **Stage 2: Themes** - Quick visual impact
4. **Stage 4: Widgets (Android)** - Convenience
5. **Stage 6: UI/UX Polish** - Final touches

---

## Stage 1: Premium Infrastructure

### 1.1. Premium Status Storage
- Add `isPremium` flag to AsyncStorage
- Create utility functions:
  - `checkPremium()` - check premium status
  - `setPremium()` - set premium status
  - `isPremiumUser()` - check if user has premium

### 1.2. Purchase Integration (Expo In-App Purchases)
- Install `expo-in-app-purchases`
- Configure product in Google Play Console
- Create purchase service:
  - `initPurchases()` - initialize purchases
  - `purchasePremium()` - handle purchase
  - `restorePurchases()` - restore previous purchases
  - Handle success/failure callbacks

### 1.3. Premium Screen
- Create `PremiumScreen.tsx`
- Show premium features description
- Purchase button
- Restore purchases button
- Show for non-premium users

---

## Stage 3: Advanced Statistics

### 3.1. New Charts and Analytics
- Trend graph (line chart by days/weeks/months)
- Period comparison (month-to-month, year-to-year)
- Day of week analytics (average by Monday, Tuesday, etc.)
- Time of day analytics (if time data available)

### 3.2. Advanced Stats Screen
- Create `AdvancedStatsScreen.tsx`
- Add tab to StatsScreen or separate screen
- Show only for premium users

---

## Stage 2: Themes

### 2.1. Theme System
- Create `theme/themes.ts` with themes:
  - Dark (current)
  - Light
  - Color variants (optional)
- Store selected theme in AsyncStorage
- Create `ThemeContext` for theme switching

### 2.2. Apply Themes
- Update `theme/colors.ts` to support themes
- Apply themes to all screens
- Add theme switcher in Settings

---

## Stage 4: Widgets (Android)

### 4.1. Home Screen Widget
- Create Android widget
- Show current streak
- Quick add entry (optional)
- Update data

### 4.2. Widget Settings
- Widget sizes
- What to show
- Update in Settings

---

## Stage 6: UI/UX Polish

### 6.1. Premium Indicators
- "Premium" badges on locked features
- "Unlock in Premium" hints
- Smooth transitions

### 6.2. Testing
- Test purchases (sandbox)
- Test all premium features
- Test on different devices

---

## Future Considerations

### Stage 5: Google Fit Integration (Android) - Later
- Install `react-native-google-fit` or similar
- Request permissions
- Export data:
  - Consumption fact (yes/no) by days
  - Amount in standard units
- Auto-export on entry addition
- Error handling and retries

### HealthKit Integration (iOS) - After Android Release
- Export consumption fact (yes/no) by days
- Export amount in standard units
- Auto-export on entry addition
- No reverse sync

---

## Premium Features List

### Included in Premium:
1. ✅ Advanced Statistics (trends, comparisons, analytics)
2. ✅ Themes (dark, light, color variants)
3. ✅ Home Screen Widgets (Android)
4. ✅ Google Fit Integration (Android) - later
5. ✅ HealthKit Integration (iOS) - after Android release

### Not Included:
- ❌ Cloud sync
- ❌ Group challenges
- ❌ AI analysis
- ❌ Any server-dependent features
- ❌ Reminders/notifications
- ❌ Predictions

### Export Features (Low Priority):
- PDF reports
- CSV/Excel export
- Do if time permits
