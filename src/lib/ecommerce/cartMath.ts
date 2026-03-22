export function coercePositiveInt(value: unknown, fallback = 1): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }

  if (typeof value === 'string') {
    const match = value.trim().replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) {
        return Math.max(1, Math.round(parsed));
      }
    }
  }

  return fallback;
}

export function coerceNonNegativeInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === 'string') {
    const match = value.trim().replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.round(parsed));
      }
    }
  }

  return fallback;
}

export function calculateCartLineTotal(quantity: unknown, unitPrice: unknown, kitSize: unknown): number {
  const safeQuantity = coercePositiveInt(quantity, 1);
  const safeUnitPrice = coerceNonNegativeInt(unitPrice, 0);
  const safeKitSize = coercePositiveInt(kitSize, 1);

  return safeQuantity * safeUnitPrice * safeKitSize;
}

export function normalizeCurrencyCents(value: unknown): number {
  return coerceNonNegativeInt(value, 0);
}