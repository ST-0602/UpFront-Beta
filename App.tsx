import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import { AuthScreen } from './AuthScreen';
import { supabase } from './lib/supabase';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';

// --- Home Screen ---
const HomeScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Welcome Home</Text>
    <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.btn}>
      <Text style={styles.btnText}>Sign Out</Text>
    </TouchableOpacity>
  </View>
);

// --- Biometric Lock Screen ---
const BiometricGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [status, setStatus] = useState('Scanning...');

  async function authenticate() {
    try {
      // 1. Check for Hardware
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // If they physically can't use FaceID, just let them in (or force them to set it up)
        onUnlock(); 
        return;
      }

      // 2. Authenticate (Force FaceID, NO Passcode fallback)
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock UpFront',
        fallbackLabel: '', // Hides fallback button on some iOS
        disableDeviceFallback: true, // ⚠️ STOPS the passcode prompt!
        cancelLabel: 'Log Out'
      });

      if (result.success) {
        onUnlock();
      } else {
        setStatus('Authentication Failed');
        Alert.alert("Locked", "FaceID failed.", [
          { text: "Try Again", onPress: authenticate },
          { text: "Log Out", onPress: () => supabase.auth.signOut(), style: "destructive" }
        ]);
      }
    } catch (e) {
      // If something crashes, just let them in so they aren't locked out of their money
      onUnlock();
    }
  }

  useEffect(() => {
    // Wait 500ms before scanning to let the view load smoothly
    setTimeout(() => authenticate(), 500);
  }, []);

  return (
    <View style={styles.container}>
      <Ionicons name="finger-print" size={80} color="#3b82f6" />
      <Text style={[styles.text, { marginTop: 20 }]}>Locked</Text>
      
      <TouchableOpacity onPress={authenticate} style={{ marginTop: 20 }}>
        <Text style={{ color: '#3b82f6', fontSize: 18 }}>{status}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => supabase.auth.signOut()} style={{ marginTop: 50 }}>
        <Text style={{ color: '#666' }}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Main Navigation ---
const Navigation = () => {
  const { session, loading } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    if (!session) setIsUnlocked(false);
  }, [session]);

  if (loading) return <View style={styles.container}><ActivityIndicator color="#fff"/></View>;

  // 1. Not Logged In? -> Auth Screen
  if (!session) return <AuthScreen />;

  // 2. Logged In, but Locked? -> Biometric Gate
  if (!isUnlocked) return <BiometricGate onUnlock={() => setIsUnlocked(true)} />;

  // 3. Unlocked? -> Home
  return <HomeScreen />;
};

export default function App() {
  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  btn: { marginTop: 20, padding: 15, backgroundColor: '#333', borderRadius: 8 },
  btnText: { color: '#fff' }
});