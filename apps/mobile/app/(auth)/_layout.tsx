import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)/map" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  );
}
