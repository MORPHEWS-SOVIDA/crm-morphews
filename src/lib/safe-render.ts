import React from 'react';

/**
 * Safely converts any value to a React-renderable node.
 * Prevents "Objects are not valid as a React child" (#310) errors.
 */
export function safeRender(value: unknown): React.ReactNode {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (React.isValidElement(value)) return value;

  // Object / array – stringify
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Wraps a component render to catch any rendering issues caused by bad data.
 * Returns null if the render function throws.
 */
export function safeTry<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
