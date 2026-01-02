/**
 * Time-based 2FA code generation for discount authorization
 * Generates a 4-character code (1 letter + 3 numbers) that changes every minute
 */

// Simple hash function for generating deterministic codes
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Generate a time-based code for a specific user
 * The code changes every minute and is deterministic based on userId and time
 */
export function generateAuthCode(userId: string, timestamp?: number): string {
  const now = timestamp || Date.now();
  // Floor to the current minute
  const minuteTimestamp = Math.floor(now / 60000);
  
  // Create a seed from userId and timestamp
  const seed = `${userId}-${minuteTimestamp}`;
  const hash = simpleHash(seed);
  
  // Generate letter (A-Z)
  const letterIndex = hash % 26;
  const letter = String.fromCharCode(65 + letterIndex); // A=65
  
  // Generate 3 numbers
  const num1 = (hash >> 4) % 10;
  const num2 = (hash >> 8) % 10;
  const num3 = (hash >> 12) % 10;
  
  return `${letter}${num1}${num2}${num3}`;
}

/**
 * Validate a code against a user's current or previous code
 * Allows for some time tolerance (checks current and previous minute)
 */
export function validateAuthCode(userId: string, inputCode: string): boolean {
  if (!inputCode || inputCode.length !== 4) return false;
  
  const normalizedInput = inputCode.toUpperCase();
  const now = Date.now();
  
  // Check current minute
  const currentCode = generateAuthCode(userId, now);
  if (normalizedInput === currentCode) return true;
  
  // Check previous minute (grace period)
  const previousCode = generateAuthCode(userId, now - 60000);
  if (normalizedInput === previousCode) return true;
  
  return false;
}

/**
 * Get the remaining seconds until the code changes
 */
export function getSecondsUntilCodeChange(): number {
  const now = Date.now();
  const currentMinuteMs = Math.floor(now / 60000) * 60000;
  const nextMinuteMs = currentMinuteMs + 60000;
  return Math.ceil((nextMinuteMs - now) / 1000);
}
