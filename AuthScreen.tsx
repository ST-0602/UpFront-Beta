import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, 
  Keyboard, TouchableWithoutFeedback 
} from 'react-native';
import { supabase } from './lib/supabase'; 
import Animated, { FadeInDown, Layout, SlideInDown, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons'; 
import * as Linking from 'expo-linking'; // Catches the callback

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [strength, setStrength] = useState(0);

  // --- DEEP LINK HANDLER (The "Catcher") ---
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      // Check if the URL is for us and has tokens
      if (url && (url.includes('access_token') || url.includes('refresh_token'))) {
        try {
          // Extract tokens from the URL fragment (#...)
          const paramsString = url.split('#')[1]; 
          const params = new URLSearchParams(paramsString);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            setLoading(true);
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            // Success: AuthProvider will detect session and redirect to Home
          }
        } catch (e: any) {
          Alert.alert('Login Error', e.message);
        } finally {
          setLoading(false);
        }
      }
    };

    // Listen for links while app is open
    const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    
    // Check if app was opened from a closed state
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  // --- GOOGLE LOGIN (The "launcher") ---
  const handleGooglePress = async () => {
    try {
      setLoading(true);
      await Haptics.selectionAsync();

      // 1. Ask Supabase to start the flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'upfront://', // Supabase will send the user back here
          skipBrowserRedirect: true, // We handle the URL manually to be safe
        },
      });

      if (error) throw error;

      // 2. Open the URL Supabase gave us (This opens Google)
      if (data?.url) {
        await Linking.openURL(data.url); 
      }
      
    } catch (e: any) {
      Alert.alert("Google Error", e.message);
      setLoading(false);
    }
  };

  // --- STANDARD EMAIL LOGIN ---
  async function handleAuth() {
    setLoading(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Sign In Failed', error.message);
    } else {
      if (strength < 2) {
        Alert.alert('Weak Password', 'Please add numbers or special characters.');
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: fullName } }
      });
      if (error) Alert.alert('Error', error.message);
    }
    setLoading(false);
  }

  // Password Strength Logic
  useEffect(() => {
    let score = 0;
    if (password.length > 0) {
        if (password.length > 6) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;
    }
    setStrength(score);
  }, [password]);

  const animatedBarStyle = useAnimatedStyle(() => ({
      width: withSpring(`${(strength / 4) * 100}%`, { damping: 20 }),
      backgroundColor: strength <= 1 ? '#ef4444' : strength === 2 ? '#eab308' : strength === 3 ? '#3b82f6' : '#22c55e',
  }));

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <LinearGradient colors={['#0f172a', '#000000']} style={styles.background} />
        
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
          <View style={styles.innerContent}>
            
            <Animated.View entering={FadeInDown.delay(200)}>
              <Text style={styles.brandTitle}>UpFront.</Text>
              <Text style={styles.header}>{isLogin ? 'Welcome back.' : 'Join the squad.'}</Text>
            </Animated.View>

            <Animated.View layout={Layout.springify()} style={styles.form}>
              {!isLogin && (
                  <TextInput placeholder="Full Name" placeholderTextColor="#555" style={styles.input} onChangeText={setFullName} />
              )}

              <TextInput placeholder="Email" placeholderTextColor="#555" style={styles.input} autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} />
              
              <View>
                <TextInput placeholder="Password" placeholderTextColor="#555" style={styles.input} secureTextEntry onChangeText={setPassword} />
                {!isLogin && password.length > 0 && (
                    <View style={styles.strengthTrack}>
                        <Animated.View style={[styles.strengthFill, animatedBarStyle]} />
                    </View>
                )}
              </View>

              <TouchableOpacity style={styles.btn} onPress={handleAuth} disabled={loading}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>}
              </TouchableOpacity>

              {/* --- 👇 PASTE THIS STARTING HERE 👇 --- */}
              
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: '#222', marginTop: 10, borderColor: '#333', borderWidth: 1 }]} 
                onPress={async () => {
                  setLoading(true);
                  // ⚠️ REPLACE WITH THE EMAIL/PASSWORD YOU JUST CREATED
                  const { error } = await supabase.auth.signInWithPassword({ 
                    email: "sakshamt@rocketmail.com", 
                    password: "Gumtree@101" 
                  });
                  if (error) Alert.alert("Dev Login Failed", error.message);
                  setLoading(false);
                }}
              >
                <Text style={[styles.btnText, { color: '#888' }]}>⚡️ DEV QUICK LOGIN</Text>
              </TouchableOpacity>

              {/* --- 👆 END OF PASTE 👆 --- */}

              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialBtn} onPress={handleGooglePress}>
                  <FontAwesome name="google" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

            </Animated.View>
          </View>

          <Animated.View entering={SlideInDown} style={styles.bottomSwitcher}>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.switchBtn}>{isLogin ? 'Create an account' : 'Log In'}</Text>
            </TouchableOpacity>
          </Animated.View>

        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  background: { position: 'absolute', width: '100%', height: '100%' },
  content: { flex: 1 },
  innerContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brandTitle: { fontSize: 32, fontWeight: '900', color: '#3b82f6', marginBottom: 10 },
  header: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 30 },
  form: { gap: 16 },
  input: { backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#222', padding: 16, color: '#fff', fontSize: 16, marginBottom: 8 },
  btn: { backgroundColor: '#fff', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnText: { fontWeight: 'bold', fontSize: 16 },
  strengthTrack: { height: 4, backgroundColor: '#222', borderRadius: 2, marginTop: -4, marginBottom: 10, overflow: 'hidden', width: '100%' },
  strengthFill: { height: '100%', borderRadius: 2 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  socialBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  bottomSwitcher: { padding: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#111' },
  switchBtn: { color: '#3b82f6', fontWeight: 'bold' }
});