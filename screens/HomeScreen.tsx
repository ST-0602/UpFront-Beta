import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, 
  FlatList, Alert, Modal, TextInput, 
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase'; 
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native'; 

type Pot = {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
  share_code: string; 
};

export default function HomeScreen() {
  const navigation = useNavigation<any>(); 
  const [pots, setPots] = useState<Pot[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Friend'); // <--- Default placeholder
  
  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  
  // Form State
  const [newPotName, setNewPotName] = useState('');
  const [newPotTarget, setNewPotTarget] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [processing, setProcessing] = useState(false);

  // 1. Fetch User Profile & Joined Pots
  const fetchData = async () => {
    // A. Get Current User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // B. Get Real Name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    if (profile?.full_name) setUserName(profile.full_name.split(' ')[0]);

    // C. Get ONLY Joined Pots
    // We query pot_members and "expand" the pots data
    const { data: memberData, error } = await supabase
      .from('pot_members')
      .select('pot_id, pots ( * )')
      .eq('user_id', user.id);

    if (error) {
      console.log('Error fetching pots:', error);
    } else {
      // Map the nested data back to a flat structure
      const formattedPots = memberData
        .map((row: any) => row.pots)
        .filter((pot: any) => pot !== null) // Filter out deleted pots
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setPots(formattedPots);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  // 2. Helper: Generate Code
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // 3. Create Pot 
  async function createPot() {
    if (!newPotName || !newPotTarget) {
      Alert.alert("Missing Info", "Enter name and amount.");
      return;
    }
    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const code = generateCode();

    // A. Insert Pot
    const { data: potData, error: potError } = await supabase
      .from('pots')
      .insert({
        name: newPotName,
        target_amount: parseFloat(newPotTarget),
        current_amount: 0,
        owner_id: user.id,
        currency: 'GBP',
        share_code: code 
      })
      .select()
      .single();

    if (potError) {
      Alert.alert("Error", potError.message);
      setProcessing(false);
      return;
    }

    // B. Add Owner as Member
    const { error: memberError } = await supabase
      .from('pot_members')
      .insert({ pot_id: potData.id, user_id: user.id, role: 'owner' });

    if (memberError) {
      Alert.alert("Error joining pot", memberError.message);
    } else {
      setNewPotName('');
      setNewPotTarget('');
      setCreateModalVisible(false);
      fetchData();
    }
    setProcessing(false);
  }

  // 4. Join Pot Logic (FIXED)
  async function joinPot() {
    if (!joinCode || joinCode.length < 6) {
      Alert.alert("Invalid Code", "Please enter a 6-character code.");
      return;
    }
    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    // A. Use Secure RPC to find pot (Bypasses the "Member Only" view policy)
    const { data: potsFound, error: findError } = await supabase
      .rpc('get_pot_by_code', { code_input: joinCode.toUpperCase() });

    if (findError || !potsFound || potsFound.length === 0) {
      Alert.alert("Not Found", "No pot found with that code.");
      setProcessing(false);
      return;
    }

    const pot = potsFound[0];

    // B. Check if already a member
    const { data: existing } = await supabase
      .from('pot_members')
      .select('*')
      .eq('pot_id', pot.id)
      .eq('user_id', user?.id)
      .single();

    if (existing) {
      Alert.alert("Already Joined", `You are already in ${pot.name}`);
      setProcessing(false);
      return;
    }

    // C. Insert Member
    const { error: joinError } = await supabase
      .from('pot_members')
      .insert({ pot_id: pot.id, user_id: user?.id, role: 'member' });

    if (joinError) {
      Alert.alert("Error", joinError.message);
    } else {
      Alert.alert("Success", `You joined ${pot.name}!`);
      setJoinCode('');
      setJoinModalVisible(false);
      fetchData();
    }
    setProcessing(false);
  }

  // 5. Delete Pot
  async function deletePot(id: string) {
    Alert.alert("Delete Pot", "Are you sure? This deletes it for everyone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          const { error } = await supabase.from('pots').delete().eq('id', id);
          if (error) Alert.alert("Error", error.message);
          else fetchData();
      }}
    ]);
  }

  const renderPot = ({ item }: { item: Pot }) => (
    <TouchableOpacity 
      onPress={() => navigation.navigate('PotDetail', { potId: item.id, name: item.name, code: item.share_code })}
      onLongPress={() => deletePot(item.id)}
      activeOpacity={0.7}
      style={styles.potCard}
    >
      <View style={styles.potIcon}><Ionicons name="wallet-outline" size={24} color="#3b82f6" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.potName}>{item.name}</Text>
        <Text style={styles.potSubtitle}>Target: £{item.target_amount}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.potAmount}>£{item.current_amount}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}> 
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Good afternoon,</Text>
              {/* REAL NAME NOW */}
              <Text style={styles.username}>{userName}</Text>
            </View>
            <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.smallBtn}>
                <Ionicons name="log-out-outline" size={24} color="#666" />
            </TouchableOpacity>
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
            <Text style={styles.sectionTitle}>Your Pots</Text>
            <View style={{ flexDirection: 'row', gap: 15 }}>
                <TouchableOpacity onPress={() => setJoinModalVisible(true)}>
                    <Text style={styles.actionLink}>Join Pot</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCreateModalVisible(true)}>
                    <Text style={styles.actionLink}>+ New</Text>
                </TouchableOpacity>
            </View>
        </View>

        {loading ? <ActivityIndicator color="#3b82f6" /> : (
            <FlatList 
                data={pots} 
                renderItem={renderPot} 
                keyExtractor={(item) => item.id} 
                contentContainerStyle={{ gap: 12 }} 
                ListEmptyComponent={<Text style={{color:'#666', textAlign:'center', marginTop:20}}>No pots found.</Text>}
            />
        )}

        {/* --- CREATE MODAL --- */}
        <Modal animationType="slide" transparent={true} visible={createModalVisible} onRequestClose={() => setCreateModalVisible(false)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                <Text style={styles.modalTitle}>New Pot</Text>
                <TextInput placeholder="Name (e.g. Holiday)" placeholderTextColor="#555" style={styles.input} value={newPotName} onChangeText={setNewPotName} />
                <TextInput placeholder="Target (£)" placeholderTextColor="#555" keyboardType="numeric" style={styles.input} value={newPotTarget} onChangeText={setNewPotTarget} />
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.cancelBtn}><Text style={{ color: '#888' }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={createPot} style={styles.createBtn} disabled={processing}>
                    {processing ? <ActivityIndicator color="#000"/> : <Text style={styles.createBtnText}>Create</Text>}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* --- JOIN MODAL --- */}
        <Modal animationType="fade" transparent={true} visible={joinModalVisible} onRequestClose={() => setJoinModalVisible(false)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                <Text style={styles.modalTitle}>Join a Pot</Text>
                <Text style={{color:'#888', marginBottom:15}}>Enter the 6-character code shared by your friend.</Text>
                <TextInput 
                    placeholder="e.g. XJ9-22B" 
                    placeholderTextColor="#555" 
                    style={[styles.input, { textAlign: 'center', letterSpacing: 4, textTransform: 'uppercase' }]} 
                    value={joinCode} 
                    onChangeText={setJoinCode} 
                    maxLength={6}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={styles.cancelBtn}><Text style={{ color: '#888' }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={joinPot} style={[styles.createBtn, { backgroundColor: '#3b82f6' }]} disabled={processing}>
                    {processing ? <ActivityIndicator color="#fff"/> : <Text style={[styles.createBtnText, {color:'#fff'}]}>Join</Text>}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, padding: 24, paddingTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  greeting: { color: '#888', fontSize: 16 },
  username: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  smallBtn: { padding: 8, backgroundColor: '#111', borderRadius: 20 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  actionLink: { color: '#3b82f6', fontWeight: 'bold', fontSize: 16 },
  potCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 16, borderRadius: 16, gap: 16, borderWidth: 1, borderColor: '#222' },
  potIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  potName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  potSubtitle: { color: '#666', fontSize: 13 },
  potAmount: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  input: { backgroundColor: '#000', color: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333', marginBottom: 16, fontSize: 18 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cancelBtn: { padding: 16 },
  createBtn: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  createBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});