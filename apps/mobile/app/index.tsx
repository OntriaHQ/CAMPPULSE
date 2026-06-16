import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/context/ThemeContext';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const C = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(tabs)/map' : '/(auth)/login'} />;
}
