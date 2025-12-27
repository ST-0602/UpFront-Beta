import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import { AuthScreen } from './AuthScreen';

// 👇 IMPORT THE SCREENS WE MOVED
import HomeScreen from './screens/HomeScreen.tsx';      
import PotDetailScreen from './screens/PotDetailScreen.tsx';

const Stack = createNativeStackNavigator();

// 1. The "App" Stack (Only for logged-in users)
const AppStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="PotDetail" component={PotDetailScreen} />
    </Stack.Navigator>
  );
};

// 2. The Traffic Controller
const Navigation = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{flex:1, backgroundColor:'#000', justifyContent:'center', alignItems:'center'}}>
        <ActivityIndicator size="large" color="#3b82f6"/>
      </View>
    );
  }
  
  return (
    <NavigationContainer>
      {!session ? <AuthScreen /> : <AppStack />}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  );
}