import { FeeComponent, LevelFeeStructure, LevelFeeValue } from '../types';

const toAmount = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(parsed, 0);
};

export const normalizeFeeComponent = (component: any, index = 0): FeeComponent => {
  const quantity = Math.max(Number(component?.quantity || 1), 1);
  const unitAmount = toAmount(component?.amount);
  return {
    id: String(component?.id || `${index + 1}`),
    code: component?.code ? String(component.code) : undefined,
    name: String(component?.name || 'Fee Item'),
    amount: unitAmount,
    quantity,
    optional: Boolean(component?.optional)
  };
};

export const normalizeLevelFee = (value: LevelFeeValue | undefined): LevelFeeStructure => {
  if (typeof value === 'number') {
    const amount = toAmount(value);
    return {
      total: amount,
      items: [{ id: '1', name: 'Course Fee', amount, quantity: 1 }]
    };
  }

  const raw = (value || {}) as any;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const normalizedItems = rawItems.map((item: any, index: number) => normalizeFeeComponent(item, index));
  const computedTotal = normalizedItems.reduce((sum, item) => sum + toAmount(item.amount) * Math.max(item.quantity || 1, 1), 0);
  const fallbackTotal = toAmount(raw.total);
  const total = computedTotal > 0 ? computedTotal : fallbackTotal;

  if (!normalizedItems.length && total > 0) {
    normalizedItems.push({ id: '1', name: 'Course Fee', amount: total, quantity: 1 });
  }

  return {
    total,
    items: normalizedItems,
    durationMonths: raw.durationMonths ? Math.max(Number(raw.durationMonths), 1) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined
  };
};

export const getLevelFeeTotal = (value: LevelFeeValue | undefined): number => normalizeLevelFee(value).total;

export const getLevelFeeItems = (value: LevelFeeValue | undefined): FeeComponent[] => normalizeLevelFee(value).items;

export const hasLevelFeeConfig = (fees: Record<string, LevelFeeValue> | undefined, level: string): boolean =>
  Boolean(level) && Object.prototype.hasOwnProperty.call(fees || {}, level);

export const createDefaultLevelFee = (amount = 10000): LevelFeeStructure => ({
  total: toAmount(amount),
  items: [{ id: '1', name: 'Tuition', amount: toAmount(amount), quantity: 1 }]
});
