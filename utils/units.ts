export function calculateStandardUnits(
  volumeMl: number,
  abvPercent: number,
): number {
  const ethanolDensity = 0.789; // g/mL
  const grams = volumeMl * (abvPercent / 100) * ethanolDensity;
  const units = grams / 10; // 10 g = 1 стандартная доза
  return Math.round(units * 100) / 100;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatTotalVolume(
  volumeMl: number,
  quantity: number = 1,
  units?: { ml: string; l: string },
): string {
  const totalMl = volumeMl * (quantity || 1);
  if (totalMl >= 1000) {
    const liters = Math.round((totalMl / 1000) * 100) / 100;
    return `${liters} ${units?.l ?? "л"}`;
  }
  return `${totalMl} ${units?.ml ?? "мл"}`;
}
