import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import { AuthScreen } from './AuthScreen';
import { supabase } from './lib/supabase';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';

// --- THE NEW DASHBOARD (Home Screen) ---
const HomeScreen = () => {
  const [biometricType, setBiometricType] = useState<string>('None');
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  // 1. Quietly check what hardware the phone has
  useEffect(() => {
    (async () => {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('FaceID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('TouchID');
      }
    })();
  }, []);

  // 2. The function to test/enable security
  const toggleSecurity = async () => {
    if (isBiometricEnabled) {
      setIsBiometricEnabled(false); // Turn it off easily
      return;
    }

    // Try to scan
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Confirm with ${biometricType}`,
      fallbackLabel: '', // Hide password fallback
      disableDeviceFallback: true, // Force biometric only
    });

    if (result.success) {
      setIsBiometricEnabled(true);
      Alert.alert("Success", `${biometricType} is now enabled for future logins.`);
    } else {
      Alert.alert("Failed", "Could not verify identity.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        {/* Header */}
        <View style={styles.header}>
            <View>
                <Text style={styles.greeting}>Good afternoon,</Text>
                <Text style={styles.username}>Saksham</Text>
            </View>
            <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.smallBtn}>
                <Ionicons name="log-out-outline" size={24} color="#666" />
            </TouchableOpacity>
        </View>

        {/* Balance Card (Placeholder) */}
        <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Balance</Text>
            <Text style={styles.balance}>£0.00</Text>
        </View>

        {/* Security Settings Section */}
        <Text style={styles.sectionTitle}>Settings</Text>
        
        <TouchableOpacity style={styles.settingRow} onPress={toggleSecurity}>
            <View style={styles.rowLeft}>
                <Ionicons 
                    name={biometricType === 'FaceID' ? "scan-outline" : "finger-print-outline"} 
                    size={24} 
                    color="#3b82f6" 
                />
                <Text style={styles.settingText}>
                    Enable {biometricType === 'None' ? 'Biometrics' : biometricType}
                </Text>
            </View>
            {/* Simple Toggle Indicator */}
            <View style={[styles.toggle, isBiometricEnabled && styles.toggleActive]}>
                <View style={[styles.toggleKnob, isBiometricEnabled && styles.toggleKnobActive]} />
            </View>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

// --- NAVIGATION WRAPPER ---
const Navigation = () => {
  const { session, loading } = useAuth();

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#3b82f6"/></View>;

  // If not logged in -> Auth Screen
  if (!session) return <AuthScreen />;

  // If logged in -> Go straight to Home (No blocking gate for now!)
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
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  content: { padding: 24, paddingTop: 40 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  greeting: { color: '#888', fontSize: 16 },
  username: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  smallBtn: { padding: 8, backgroundColor: '#111', borderRadius: 20 },

  card: { backgroundColor: '#111', padding: 24, borderRadius: 24, marginBottom: 40, borderWidth: 1, borderColor: '#222' },
  cardLabel: { color: '#666', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  balance: { color: '#fff', fontSize: 42, fontWeight: '900', marginTop: 8 },

  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#222' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { color: '#fff', fontSize: 16, fontWeight: '500' },

  toggle: { width: 50, height: 28, backgroundColor: '#333', borderRadius: 14, padding: 2 },
  toggleActive: { backgroundColor: '#3b82f6' },
  toggleKnob: { width: 24, height: 24, backgroundColor: '#fff', borderRadius: 12 },
  toggleKnobActive: { alignSelf: 'flex-end' }
});