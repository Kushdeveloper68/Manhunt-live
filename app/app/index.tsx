import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

/** Entry gate: wait for the saved login to load, then go to Home or the Splash/onboarding flow. */
export default function Index() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!hydrated) return null;
  return <Redirect href={isAuthenticated ? '/home' : '/splash'} />;
}
