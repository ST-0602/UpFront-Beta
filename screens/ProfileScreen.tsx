import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator 
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { decode } from 'base-64'; 

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getProfile();
  }, []);

  async function getProfile() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (data) {
      setFullName(data.full_name);
      // Add a timestamp to force refresh if the URL is the same
      if (data.avatar_url) setAvatarUrl(data.avatar_url);
    }
    setLoading(false);
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "We need access to your photos.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Using the "safe" old option
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
      
      // 1. Convert Base64 to ArrayBuffer (Crucial Step for correct image format)
      const binaryStr = decode(base64Data);
      const byteArray = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        byteArray[i] = binaryStr.charCodeAt(i);
      }

      // 2. Generate Path
      const fileName = `${userId}/avatar_${Date.now()}.png`;

      // 3. Upload the Byte Array
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, byteArray.buffer, { 
            contentType: 'image/png', 
            upsert: true 
        });

      if (uploadError) throw uploadError;

      // 4. Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      // 5. Update Profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      Alert.alert("Success", "Profile picture updated!");

    } catch (error: any) {
      console.log(error); // Log to console for debugging
      Alert.alert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{width: 40}} /> 
      </View>

      <View style={styles.content}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarContainer} disabled={uploading}>
            {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
                <View style={styles.placeholder}>
                    <Text style={styles.initials}>{fullName ? fullName[0] : '?'}</Text>
                </View>
            )}
            
            <View style={styles.editBadge}>
                {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Ionicons name="camera" size={20} color="#fff" />
                )}
            </View>
        </TouchableOpacity>

        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.subtext}>Tap photo to change</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 40 },
  backBtn: { padding: 8, backgroundColor: '#111', borderRadius: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  content: { alignItems: 'center' },
  avatarContainer: { position: 'relative', marginBottom: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#333' },
  placeholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#444' },
  initials: { color: '#fff', fontSize: 48, fontWeight: 'bold' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#3b82f6', padding: 10, borderRadius: 20, borderWidth: 4, borderColor: '#000', minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  name: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtext: { color: '#666' },
});