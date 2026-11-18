export interface AuthErrorLike {
  code?: string;
  message?: string;
}

const DEFAULT_AUTH_ERROR_MESSAGE = 'Google sign-in failed. Please try again.';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/popup-blocked':
    'Your browser blocked the sign-in popup. Please allow popups for this site and try again.',
  'auth/operation-not-supported-in-this-environment':
    'Google sign-in is not supported in this browser. Please try a different browser.',
  'auth/unauthorized-domain':
    'Google sign-in is not available on this domain. Please contact support.',
  'auth/network-request-failed':
    'Network error while signing in. Please check your connection and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled. Please try again.',
  'auth/redirect-cancelled-by-user': 'Sign-in was cancelled. Please try again.',
  'auth/too-many-requests':
    'Too many sign-in attempts. Please wait a moment and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
};

const POPUP_FALLBACK_ERROR_CODES: ReadonlySet<string> = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
]);

export function getAuthErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as AuthErrorLike).code;
  return typeof code === 'string' ? code : null;
}

export function getAuthErrorMessage(error: unknown): string {
  const code = getAuthErrorCode(error);
  if (!code) return DEFAULT_AUTH_ERROR_MESSAGE;
  return AUTH_ERROR_MESSAGES[code] ?? DEFAULT_AUTH_ERROR_MESSAGE;
}

export function shouldFallbackToRedirect(error: unknown): boolean {
  const code = getAuthErrorCode(error);
  return code !== null && POPUP_FALLBACK_ERROR_CODES.has(code);
}
