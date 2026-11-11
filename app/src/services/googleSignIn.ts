/**
 * Real Google Sign-In -> returns a Google ID token that the SERVER verifies.
 * The native module is loaded lazily so the app still runs in builds that do
 * not include it (e.g. Expo Go); email/password login keeps working there.
 */
export async function getGoogleIdToken(): Promise<string> {
  let GoogleSignin: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch {
    throw new Error('Google Sign-In needs the development build. Use email login for now.');
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId || webClientId.startsWith('your-')) {
    throw new Error('Google Sign-In is not configured (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID missing).');
  }

  GoogleSignin.configure({ webClientId });
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  const idToken: string | undefined = result?.data?.idToken ?? result?.idToken;
  if (!idToken) {
    throw new Error('Google sign-in was cancelled or returned no token.');
  }
  return idToken;
}

/** DEV ONLY: fake Google identity, accepted only if the server has ALLOW_DEV_GOOGLE_MOCK=true. */
export const DEV_GOOGLE_MOCK_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_ALLOW_DEV_GOOGLE_MOCK === 'true';
