import React, { useState, useCallback } from 'react'; 
import {  
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,  
  FlatList, Alert, Modal, TextInput, Image, 
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback 
} from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { supabase } from '../lib/supabase';  
import { Ionicons } from '@expo/vector-icons'; 
import { useNavigation, useFocusEffect } from '@react-navigation/native';  
import { LinearGradient } from 'expo-linear-gradient';

type Pot = { 
  id: string; 
  name: string; 
  current_amount: number; 
  target_amount: number; 
  share_code: string;  
  owner_id: string;
  status: 'active' | 'archived';
  user_role: string;
}; 

export default function HomeScreen() { 
  const navigation = useNavigation<any>();  
  const [pots, setPots] = useState<Pot[]>([]); 
  const [loading, setLoading] = useState(true); 
  const [userName, setUserName] = useState('Friend'); 
  const [userAvatar, setUserAvatar] = useState<string | null>(null); 
  const [userId, setUserId] = useState('');
  const [totalBalance, setTotalBalance] = useState(0); 
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

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
    setUserId(user.id);

    const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single(); 
    if (profile) { 
        if (profile.full_name) setUserName(profile.full_name.split(' ')[0]); 
        if (profile.avatar_url) setUserAvatar(profile.avatar_url); 
    } 

    const { data: memberData, error } = await supabase 
      .from('pot_members') 
      .select('role, pots ( * )') 
      .eq('user_id', user.id); 

    if (!error && memberData) { 
      const formattedPots = memberData 
        .map((row: any) => ({
            ...row.pots,
            user_role: row.role,
            status: row.pots.status === 'archived' ? 'archived' : 'active'
        })) 
        .filter((pot: any) => pot.id) 
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); 
       
      setPots(formattedPots); 

      const total = formattedPots
        .filter((p: Pot) => p.status === 'active')
        .reduce((sum: number, pot: Pot) => sum + (pot.current_amount || 0), 0);
      setTotalBalance(total); 
    } 
    setLoading(false); 
  }; 

  useFocusEffect(useCallback(() => { fetchData(); }, [])); 

  // --- ACTIONS ---
  const generateCode = () => { 
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; 
    let result = ''; 
    for (let i = 0; i < 6; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); } 
    return result; 
  }; 

  async function createPot() { 
    if (!newPotName || !newPotTarget) return; 
    setProcessing(true); 
    const code = generateCode(); 
    
    const { data: potData, error } = await supabase.from('pots').insert({ 
        name: newPotName, 
        target_amount: parseFloat(newPotTarget), 
        current_amount: 0, 
        owner_id: userId, 
        currency: 'GBP', 
        share_code: code,
        status: 'active'
      }).select().single(); 

    if (error) Alert.alert("Error", error.message); 
    else { 
      await supabase.from('pot_members').insert({ pot_id: potData.id, user_id: userId, role: 'owner' }); 
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
    const { data: potsFound } = await supabase.from('pots').select('*').eq('share_code', joinCode.toUpperCase());

    if (!potsFound || potsFound.length === 0) { 
      Alert.alert("Not Found", "Invalid code."); 
      setProcessing(false); 
      return; 
    } 
    const pot = potsFound[0]; 
    const { data: existing } = await supabase.from('pot_members').select('*').eq('pot_id', pot.id).eq('user_id', userId).single(); 

    if (existing) Alert.alert("Already Joined", `You are in ${pot.name}`); 
    else { 
      await supabase.from('pot_members').insert({ pot_id: pot.id, user_id: userId, role: 'member' }); 
      setJoinCode(''); 
      setJoinModalVisible(false); 
      fetchData(); 
    } 
    setProcessing(false); 
  } 

  // --- MENU ACTIONS ---
  const handleOptions = (pot: Pot) => {
    const isOwner = pot.owner_id === userId;
    const options = [];

    if (isOwner) {
        if (pot.status === 'active') {
            options.push({ text: "Archive", onPress: () => updateStatus(pot, 'archived') });
            options.push({ text: "Delete Permanently", style: 'destructive', onPress: () => confirmDelete(pot.id) });
        } else {
            options.push({ text: "Unarchive", onPress: () => updateStatus(pot, 'active') });
            options.push({ text: "Delete Permanently", style: 'destructive', onPress: () => confirmDelete(pot.id) });
        }
    } else {
        options.push({ text: "Leave Pot", style: 'destructive', onPress: () => leavePot(pot.id) });
    }

    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Manage Pot", pot.name, options as any);
  };

  const updateStatus = async (pot: Pot, status: 'active' | 'archived') => {
      // 1. Optimistic UI update (makes it feel instant)
      const updatedPots = pots.map(p => p.id === pot.id ? { ...p, status } : p);
      setPots(updatedPots);

      // 2. Real DB update
      const { error } = await supabase.from('pots').update({ status }).eq('id', pot.id);
      
      if (error) {
          Alert.alert("Update Failed", error.message); // This will tell us if RLS is still blocking
          fetchData(); // Revert on error
      } else {
          fetchData(); // Confirm success
      }
  };

  const confirmDelete = (id: string) => {
      Alert.alert(
          "Delete Pot?",
          "This cannot be undone.",
          [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => deletePot(id) }
          ]
      );
  };

  const deletePot = async (id: string) => {
      const { error } = await supabase.from('pots').delete().eq('id', id);
      if (error) Alert.alert("Error", error.message);
      else fetchData();
  };

  const leavePot = async (id: string) => {
      await supabase.from('pot_members').delete().eq('pot_id', id).eq('user_id', userId);
      fetchData();
  };

  // --- RENDER ---
  const displayedPots = pots.filter(p => p.status === activeTab);

  const renderPot = ({ item }: { item: Pot }) => ( 
    <TouchableOpacity  
      onPress={() => navigation.navigate('PotDetail', { potId: item.id, name: item.name, code: item.share_code })} 
      activeOpacity={0.7} 
      style={[styles.potCard, item.status === 'archived' && { opacity: 0.6 }]} 
    > 
      <View style={styles.potIcon}>
        <Ionicons name={item.status === 'archived' ? "archive-outline" : "wallet-outline"} size={24} color="#3b82f6" />
      </View> 
      <View style={{ flex: 1 }}> 
        <Text style={styles.potName}>{item.name}</Text> 
        <Text style={styles.potSubtitle}>Goal: £{item.target_amount}</Text> 
      </View> 
      <View style={{ alignItems: 'flex-end', marginRight: 10 }}> 
        <Text style={styles.potAmount}>£{item.current_amount}</Text> 
      </View> 
      
      <TouchableOpacity style={styles.menuBtn} onPress={() => handleOptions(item)}>
        <Ionicons name="ellipsis-vertical" size={20} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity> 
  ); 

  return ( 
    <LinearGradient colors={['#2c2c2e', '#000000']} style={styles.container}>
    <SafeAreaView style={{flex: 1}} edges={['top']}>  
      <View style={styles.content}> 
         
        {/* HEADER */} 
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
                    <Text style={{color:'#aaa', fontSize:12}}>Tap for settings</Text> 
                </View> 
            </TouchableOpacity> 
        </View> 

        {/* DASHBOARD */} 
        <View style={styles.dashboardCard}> 
            <View> 
                <Text style={styles.dashLabel}>Total Pool Value</Text> 
                <Text style={styles.dashAmount}>£{totalBalance.toFixed(2)}</Text> 
            </View> 
            
            <TouchableOpacity 
                style={styles.dashIcon} 
                onPress={() => Alert.alert("Coming Soon", "Analytics will be available here soon!")}
            >
                <Ionicons name="stats-chart" size={20} color="#fff" />
            </TouchableOpacity> 

            <View style={styles.dashFooter}> 
                <Text style={styles.dashFooterText}>{pots.filter(p => p.status === 'active').length} Active Pots</Text> 
            </View> 
        </View> 

        {/* TABS & ACTION ROW */} 
        <View style={styles.actionRow}> 
            <View style={styles.tabs}>
                <TouchableOpacity onPress={() => setActiveTab('active')} style={[styles.tab, activeTab === 'active' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('archived')} style={[styles.tab, activeTab === 'archived' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>Archive</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setCreateModalVisible(true)}> 
                <Text style={styles.actionLink}>+ New</Text> 
            </TouchableOpacity> 
        </View> 

        {loading ? <ActivityIndicator color="#3b82f6" style={{marginTop: 50}} /> : ( 
            <FlatList  
                data={displayedPots}  
                renderItem={renderPot}  
                keyExtractor={(item) => item.id}  
                contentContainerStyle={{ gap: 12, paddingBottom: 80 }}  
                ListEmptyComponent={ 
                    <View style={styles.emptyState}> 
                        <Text style={{color:'#666', textAlign:'center'}}>
                            {activeTab === 'active' ? "No active pots." : "No archived pots."}
                        </Text> 
                        {activeTab === 'active' && (
                            <TouchableOpacity onPress={() => setJoinModalVisible(true)} style={{marginTop:10}}> 
                                <Text style={{color:'#3b82f6'}}>Join a friend's pot?</Text> 
                            </TouchableOpacity>
                        )}
                    </View> 
                } 
            /> 
        )} 

        {/* FAB */}
        {activeTab === 'active' && (
            <TouchableOpacity style={styles.fab} onPress={() => setJoinModalVisible(true)}> 
                <Ionicons name="scan-outline" size={24} color="#000" /> 
                <Text style={{fontWeight:'bold', marginLeft: 8}}>Join Pot</Text> 
            </TouchableOpacity> 
        )}

        {/* CREATE MODAL */} 
        <Modal animationType="slide" transparent={true} visible={createModalVisible} onRequestClose={() => setCreateModalVisible(false)}> 
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}> 
            <View style={styles.modalOverlay}> 
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}> 
                <Text style={styles.modalTitle}>New Pot</Text> 
                <TextInput placeholder="Name" placeholderTextColor="#555" style={styles.input} value={newPotName} onChangeText={setNewPotName} /> 
                <TextInput placeholder="Target (£)" placeholderTextColor="#555" keyboardType="numeric" style={styles.input} value={newPotTarget} onChangeText={setNewPotTarget} /> 
                <View style={styles.modalButtons}> 
                  <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.cancelBtn}><Text style={{ color: '#888' }}>Cancel</Text></TouchableOpacity> 
                  <TouchableOpacity onPress={createPot} style={styles.createBtn} disabled={processing}><Text style={styles.createBtnText}>Create</Text></TouchableOpacity> 
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
                <Text style={styles.modalTitle}>Join Pot</Text> 
                <TextInput placeholder="CODE" placeholderTextColor="#555" style={[styles.input, { textAlign: 'center', letterSpacing: 4, textTransform: 'uppercase' }]} value={joinCode} onChangeText={setJoinCode} maxLength={6} /> 
                <View style={styles.modalButtons}> 
                  <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={styles.cancelBtn}><Text style={{ color: '#888' }}>Cancel</Text></TouchableOpacity> 
                  <TouchableOpacity onPress={joinPot} style={[styles.createBtn, { backgroundColor: '#3b82f6' }]} disabled={processing}><Text style={[styles.createBtnText, {color:'#fff'}]}>Join</Text></TouchableOpacity> 
                </View> 
              </KeyboardAvoidingView> 
            </View> 
          </TouchableWithoutFeedback> 
        </Modal> 

      </View> 
    </SafeAreaView> 
    </LinearGradient>
  ); 
} 

const styles = StyleSheet.create({ 
  container: { flex: 1 }, 
  content: { flex: 1, padding: 24, paddingTop: 10 }, 
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, 
  profileBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 }, 
  headerAvatar: { width: 40, height: 40, borderRadius: 20 }, 
  greeting: { color: '#fff', fontSize: 18, fontWeight: 'bold' }, 
  
  // DASHBOARD - IMPROVED
  dashboardCard: { 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderRadius: 24, 
    padding: 24, 
    marginBottom: 24, 
    position:'relative', 
    overflow:'hidden', 
    borderWidth:1, 
    borderColor: 'rgba(255,255,255,0.1)' 
  }, 
  dashLabel: { color: '#888', fontSize: 14, textTransform: 'uppercase', marginBottom: 8 }, 
  dashAmount: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1 }, 
  dashIcon: { 
    position: 'absolute', 
    top: 20, 
    right: 20, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    padding: 10, 
    borderRadius: 20 
  }, 
  dashFooter: { marginTop: 20, flexDirection:'row', alignItems:'center' }, 
  dashFooterText: { color: '#22c55e', fontWeight:'bold', fontSize:14 }, 

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, 
  tabs: { flexDirection:'row', gap:8 },
  tab: { paddingVertical:6, paddingHorizontal:14, borderRadius:20, backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  activeTab: { backgroundColor:'#fff', borderColor:'#fff' },
  tabText: { color:'#888', fontWeight:'bold', fontSize:14 },
  activeTabText: { color:'#000' },
  actionLink: { color: '#3b82f6', fontWeight: 'bold', fontSize: 16 }, 

  potCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 20, gap: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, 
  potIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center' }, 
  potName: { color: '#fff', fontSize: 16, fontWeight: 'bold' }, 
  potSubtitle: { color: '#666', fontSize: 13 }, 
  potAmount: { color: '#fff', fontSize: 18, fontWeight: 'bold' }, 
  menuBtn: { padding:8 },
  
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