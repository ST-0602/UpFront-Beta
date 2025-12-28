import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, 
  TextInput, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { decode } from 'base-64'; 

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState('');

  useEffect(() => { getProfile(); }, []);

  async function getProfile() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();
    if (data) {
      setFullName(data.full_name);
      if (data.avatar_url) setAvatarUrl(data.avatar_url);
    }
    setLoading(false);
  }

  async function updateProfile() {
      setSaving(true);
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId);
      if (error) Alert.alert("Error", error.message);
      else Alert.alert("Success", "Profile updated!");
      setSaving(false);
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Permission Denied", "We need access to your photos.");

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true, 
      });

      if (!result.canceled && result.assets[0].base64) {
        uploadImage(result.assets[0].base64);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  }

  async function uploadImage(base64Data: string) {
    try {
      setUploading(true);
      const binaryStr = decode(base64Data);
      const byteArray = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) byteArray[i] = binaryStr.charCodeAt(i);

      const fileName = `${userId}/avatar_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, byteArray.buffer, { contentType: 'image/png', upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
      setAvatarUrl(publicUrl);
    } catch (error: any) {
      Alert.alert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  }

  const handleDeleteAccount = () => {
      Alert.alert("Delete Account?", "This is permanent. All your data will be wiped.", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: async () => {
              // Note: You usually need a Cloud Function to delete user from Auth. 
              // For now, sign them out.
              await supabase.auth.signOut();
          }}
      ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{width: 40}} /> 
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* AVATAR SECTION */}
        <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer} disabled={uploading}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                    <View style={styles.placeholder}><Text style={styles.initials}>{fullName ? fullName[0] : '?'}</Text></View>
                )}
                <View style={styles.editBadge}>
                    {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={20} color="#fff" />}
                </View>
            </TouchableOpacity>
            <Text style={styles.changePhotoText}>Tap to change photo</Text>
        </View>

        {/* FORM SECTION */}
        <View style={styles.formSection}>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput 
                style={styles.input} 
                value={fullName} 
                onChangeText={setFullName} 
                placeholder="Your Name" 
                placeholderTextColor="#555"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={updateProfile} disabled={saving}>
                {saving ? <ActivityIndicator color="#000"/> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
        </View>

        {/* ACTIONS SECTION */}
        <View style={styles.actionSection}>
            <TouchableOpacity style={styles.actionRow} onPress={() => Alert.alert("Support", "Contact us at help@upfront.app")}>
                <Ionicons name="help-buoy-outline" size={22} color="#fff" />
                <Text style={styles.actionText}>Help & Support</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => supabase.auth.signOut()}>
                <Ionicons name="log-out-outline" size={22} color="#fff" />
                <Text style={styles.actionText}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={handleDeleteAccount}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
                <Text style={[styles.actionText, {color: '#ef4444'}]}>Delete Account</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>

      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: '#111', borderRadius: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  content: { alignItems: 'center', paddingBottom: 50 },
  
  avatarSection: { alignItems: 'center', marginBottom: 30 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#333' },
  placeholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#444' },
  initials: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#3b82f6', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: '#000' },
  changePhotoText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },

  formSection: { width: '100%', paddingHorizontal: 24, marginBottom: 40 },
  label: { color: '#666', fontSize: 12, fontWeight: 'bold', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#111', color: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333', fontSize: 16, marginBottom: 20 },
  saveBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  actionSection: { width: '100%', borderTopWidth: 1, borderTopColor: '#222', paddingTop: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, gap: 12 },
  actionText: { color: '#fff', fontSize: 16, flex: 1 },

  version: { color: '#444', marginTop: 30, fontSize: 12 }
});