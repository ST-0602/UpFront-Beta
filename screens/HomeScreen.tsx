import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, 
  FlatList, Alert, Modal, TextInput, Image,
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
  const [userName, setUserName] = useState('Friend');
  const [userAvatar, setUserAvatar] = useState<string | null>(null); // <--- Store your own avatar
  
  const [totalBalance, setTotalBalance] = useState(0);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [newPotName, setNewPotName] = useState('');
  const [newPotTarget, setNewPotTarget] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Get Profile (Name + Avatar)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
      
    if (profile) {
        if (profile.full_name) setUserName(profile.full_name.split(' ')[0]);
        if (profile.avatar_url) setUserAvatar(profile.avatar_url);
    }

    // 2. Get Pots
    const { data: memberData, error } = await supabase
      .from('pot_members')
      .select('pot_id, pots ( * )')
      .eq('user_id', user.id);

    if (!error && memberData) {
      const formattedPots = memberData
        .map((row: any) => row.pots)
        .filter((pot: any) => pot !== null)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setPots(formattedPots);

      const total = formattedPots.reduce((sum, pot) => sum + (pot.current_amount || 0), 0);
      setTotalBalance(total);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return result;
  };

  async function createPot() {
    if (!newPotName || !newPotTarget) return;
    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const code = generateCode();
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
    } else {
      await supabase.from('pot_members').insert({ pot_id: potData.id, user_id: user.id, role: 'owner' });
      setNewPotName('');
      setNewPotTarget('');
      setCreateModalVisible(false);
      fetchData();
    }
    setProcessing(false);
  }

  async function joinPot() {
    if (!joinCode || joinCode.length < 6) return;
    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: potsFound } = await supabase.rpc('get_pot_by_code', { code_input: joinCode.toUpperCase() });

    if (!potsFound || potsFound.length === 0) {
      Alert.alert("Not Found", "No pot found with that code.");
      setProcessing(false);
      return;
    }
    const pot = potsFound[0];

    const { data: existing } = await supabase.from('pot_members').select('*').eq('pot_id', pot.id).eq('user_id', user?.id).single();

    if (existing) {
      Alert.alert("Already Joined", `You are already in ${pot.name}`);
    } else {
      const { error: joinError } = await supabase.from('pot_members').insert({ pot_id: pot.id, user_id: user?.id, role: 'member' });
      if (joinError) Alert.alert("Error", joinError.message);
      else {
        setJoinCode('');
        setJoinModalVisible(false);
        fetchData();
      }
    }
    setProcessing(false);
  }

  const renderPot = ({ item }: { item: Pot }) => (
    <TouchableOpacity 
      onPress={() => navigation.navigate('PotDetail', { potId: item.id, name: item.name, code: item.share_code })}
      activeOpacity={0.7}
      style={styles.potCard}
    >
      <View style={styles.potIcon}><Ionicons name="wallet-outline" size={24} color="#3b82f6" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.potName}>{item.name}</Text>
        <Text style={styles.potSubtitle}>Goal: £{item.target_amount}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.potAmount}>£{item.current_amount}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}> 
      <View style={styles.content}>
        
        {/* HEADER - NOW CLICKABLE FOR PROFILE */}
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBtn}>
                {userAvatar ? (
                    <Image source={{ uri: userAvatar }} style={styles.headerAvatar} />
                ) : (
                    <View style={[styles.headerAvatar, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                         <Ionicons name="person" size={20} color="#666" />
                    </View>
                )}
                <View>
                    <Text style={styles.greeting}>Hello, {userName} 👋</Text>
                    <Text style={{color:'#666', fontSize:12}}>Tap to edit profile</Text>
                </View>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.smallBtn}>
                <Ionicons name="log-out-outline" size={24} color="#666" />
            </TouchableOpacity>
        </View>

        {/* DASHBOARD SUMMARY */}
        <View style={styles.dashboardCard}>
            <View>
                <Text style={styles.dashLabel}>Total Pool Value</Text>
                <Text style={styles.dashAmount}>£{totalBalance.toFixed(2)}</Text>
            </View>
            <View style={styles.dashIcon}>
                <Ionicons name="pie-chart" size={24} color="#fff" />
            </View>
            <View style={styles.dashFooter}>
                <Text style={styles.dashFooterText}>{pots.length} Active Pots</Text>
            </View>
        </View>

        {/* ACTION ROW */}
        <View style={styles.actionRow}>
            <Text style={styles.sectionTitle}>Your Groups</Text>
            <TouchableOpacity onPress={() => setCreateModalVisible(true)}>
                <Text style={styles.actionLink}>+ Create New</Text>
            </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color="#3b82f6" /> : (
            <FlatList 
                data={pots} 
                renderItem={renderPot} 
                keyExtractor={(item) => item.id} 
                contentContainerStyle={{ gap: 12, paddingBottom: 40 }} 
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={{color:'#666', textAlign:'center'}}>No pots yet.</Text>
                        <TouchableOpacity onPress={() => setJoinModalVisible(true)} style={{marginTop:10}}>
                             <Text style={{color:'#3b82f6'}}>Join a friend's pot?</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
        )}

        <TouchableOpacity style={styles.fab} onPress={() => setJoinModalVisible(true)}>
            <Ionicons name="scan-outline" size={24} color="#000" />
            <Text style={{fontWeight:'bold', marginLeft: 8}}>Join Pot</Text>
        </TouchableOpacity>

        {/* CREATE MODAL */}
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

        {/* JOIN MODAL */}
        <Modal animationType="fade" transparent={true} visible={joinModalVisible} onRequestClose={() => setJoinModalVisible(false)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                <Text style={styles.modalTitle}>Join a Pot</Text>
                <TextInput 
                    placeholder="CODE" 
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  profileBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  greeting: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  smallBtn: { padding: 8, backgroundColor: '#111', borderRadius: 20 },
  
  // DASHBOARD
  dashboardCard: { backgroundColor: '#1a1a1a', borderRadius: 24, padding: 24, marginBottom: 30, position:'relative', overflow:'hidden', borderWidth:1, borderColor:'#333' },
  dashLabel: { color: '#888', fontSize: 14, textTransform: 'uppercase', marginBottom: 8 },
  dashAmount: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  dashIcon: { position: 'absolute', top: 20, right: 20, backgroundColor:'#333', padding:10, borderRadius:20 },
  dashFooter: { marginTop: 20, flexDirection:'row', alignItems:'center' },
  dashFooterText: { color: '#22c55e', fontWeight:'bold', fontSize:14 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  actionLink: { color: '#3b82f6', fontWeight: 'bold', fontSize: 16 },
  
  potCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 16, borderRadius: 16, gap: 16, borderWidth: 1, borderColor: '#222' },
  potIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  potName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  potSubtitle: { color: '#666', fontSize: 13 },
  potAmount: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
  fab: { position:'absolute', bottom: 30, alignSelf:'center', backgroundColor:'#fff', paddingVertical:12, paddingHorizontal:24, borderRadius:30, flexDirection:'row', alignItems:'center', shadowColor:'#000', shadowOpacity:0.3, shadowRadius:10 },
  
  emptyState: { alignItems:'center', marginTop: 40 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  input: { backgroundColor: '#000', color: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333', marginBottom: 16, fontSize: 18 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cancelBtn: { padding: 16 },
  createBtn: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  createBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});