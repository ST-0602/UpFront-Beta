import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator } from 'react-native';
// Polyfill for Supabase Image Uploads
import { decode } from 'base-64';
if(typeof atob === 'undefined') { global.atob = decode; }

import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import PotDetailScreen from './screens/PotDetailScreen';
import ProfileScreen from './screens/ProfileScreen'; // <--- Import New Screen

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

console.log("Debug AuthScreen:", AuthScreen); 
// If this prints "undefined", the export in Step 1 didn't save correctly.

  if (loading) {
    return <View style={{flex:1, backgroundColor:'#000', justifyContent:'center'}}><ActivityIndicator color="#3b82f6"/></View>;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
        {session && session.user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="PotDetail" component={PotDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} /> 
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}