import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  FlatList, Alert, Share, Modal, TextInput, KeyboardAvoidingView, 
  Platform, TouchableWithoutFeedback, Keyboard, ScrollView, Image 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as Clipboard from 'expo-clipboard'; 
import { LinearGradient } from 'expo-linear-gradient';

type Member = { 
  id: string; 
  user_id: string; 
  role: string;
  profiles: { full_name: string; avatar_url?: string } | null; 
};

type Transaction = {
  id: string;
  amount: number;
  title: string;
  description: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string } | null;
  split_type: string;
  split_details: any;
  paid_from_pot: boolean; 
  category: string;
};

const CATEGORIES = [
    { id: 'general', label: 'General', icon: 'wallet' },
    { id: 'food', label: 'Food', icon: 'fast-food' },
    { id: 'drink', label: 'Drinks', icon: 'beer' },
    { id: 'transport', label: 'Transport', icon: 'car' },
    { id: 'stay', label: 'Stay', icon: 'bed' },
    { id: 'fun', label: 'Activity', icon: 'ticket' },
];

export default function PotDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { potId, name, code: paramCode } = route.params; 

  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [potData, setPotData] = useState<any>(null);
  const [myRole, setMyRole] = useState<string>('member'); 
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [modalVisible, setModalVisible] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [transType, setTransType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [processing, setProcessing] = useState(false);
  
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]); 
  const [depositorId, setDepositorId] = useState<string>(''); 

  async function fetchDetails() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        setCurrentUserId(user.id);
        setDepositorId(user.id); 
    }

    const { data: pot } = await supabase.from('pots').select('*').eq('id', potId).single();
    if (pot) setPotData(pot);

    const { data: mems } = await supabase
      .from('pot_members')
      .select('*, profiles(full_name, avatar_url)') 
      .eq('pot_id', potId);
      
    if (mems) {
        setMembers(mems as any);
        if (selectedMembers.length === 0) setSelectedMembers(mems.map((m: any) => m.user_id));
        
        const me = mems.find((m: any) => m.user_id === user?.id);
        setMyRole(me?.role || 'member');
        if (pot && pot.owner_id === user?.id) setMyRole('owner');
    }

    const { data: trans } = await supabase
      .from('transactions')
      .select('*, profiles(full_name)')
      .eq('pot_id', potId)
      .order('created_at', { ascending: false });
    
    if (trans) setTransactions(trans as any);
    setLoading(false);
  }

  useEffect(() => { fetchDetails(); }, []);

  const calculateBalances = () => {
    const balances: Record<string, number> = {};
    members.forEach(m => balances[m.user_id] = 0);

    transactions.forEach(t => {
      const val = t.amount;
      const cost = Math.abs(val);

      if (val > 0) {
        if (balances[t.user_id] !== undefined) balances[t.user_id] += val;
      } else {
        if (!t.split_details || Object.keys(t.split_details).length === 0) {
            if (balances[t.user_id] !== undefined) balances[t.user_id] -= cost; 
        } else {
            Object.entries(t.split_details).forEach(([uid, share]) => {
                if (balances[uid] !== undefined) balances[uid] -= (share as number);
            });
        }
      }
    });
    return balances;
  };
  const memberBalances = calculateBalances();

  const getCategoryIcon = (catId: string) => {
      const cat = CATEGORIES.find(c => c.id === catId);
      return (cat ? cat.icon : 'wallet') as any;
  };

  const handleInvite = () => {
    const code = potData?.share_code || paramCode;
    Alert.alert("Invite Friend", `Group Code: ${code}`, [
        { text: "Copy", onPress: async () => { await Clipboard.setStringAsync(code); } },
        { text: "Share", onPress: () => { Share.share({ message: `Join my pot "${name}"! Code: ${code}` }); } },
        { text: "Cancel", style: "cancel" }
    ]);
  };

  const openModal = (type: 'deposit' | 'withdraw', transactionToEdit?: Transaction) => {
    setTransType(transactionToEdit && transactionToEdit.amount > 0 ? 'deposit' : type);
    
    if (transactionToEdit) {
        setEditingId(transactionToEdit.id);
        setAmount(Math.abs(transactionToEdit.amount).toString());
        setTitle(transactionToEdit.title);
        setDescription(transactionToEdit.description || '');
        setCategory(transactionToEdit.category || 'general');
        setDepositorId(transactionToEdit.user_id); 
        if (transactionToEdit.split_details) setSelectedMembers(Object.keys(transactionToEdit.split_details));
    } else {
        setEditingId(null);
        setAmount('');
        setTitle('');
        setDescription('');
        setCategory('general');
        setDepositorId(currentUserId); 
        if (members.length > 0) setSelectedMembers(members.map(m => m.user_id)); 
    }
    setModalVisible(true);
  };

  const handleSettleUp = () => {
      let report = "";
      members.forEach(m => {
          const bal = memberBalances[m.user_id] || 0;
          const name = m.profiles?.full_name?.split(' ')[0] || 'User';
          if (bal > 0.01) report += `• Pay ${name}: £${bal.toFixed(2)}\n`;
          else if (bal < -0.01) report += `• ${name} owes: £${Math.abs(bal).toFixed(2)}\n`;
      });
      if (report === "") report = "Everything is perfectly balanced!";
      Alert.alert("Settlement Report", `Remaining in Pot: £${(potData?.current_amount || 0).toFixed(2)}\n\n${report}`, [{ text: "OK" }]);
  };

  const handleTransaction = async () => {
    const finalTitle = title || (transType === 'deposit' ? 'Deposit' : 'Expense');
    if (!amount) return Alert.alert("Missing Info", "Please add an amount.");
    setProcessing(true);
    
    const cleanAmount = parseFloat(amount);
    const finalAmount = transType === 'deposit' ? Math.abs(cleanAmount) : -Math.abs(cleanAmount);
    const transactionOwner = transType === 'deposit' ? depositorId : currentUserId;

    const splitData: any = {}; 
    if (transType === 'withdraw') {
        const splitAmount = Math.abs(finalAmount) / selectedMembers.length;
        selectedMembers.forEach(uid => { splitData[uid] = splitAmount; });
    }

    const payload = {
        amount: finalAmount,
        title: finalTitle,
        description: description,
        category: category,
        split_type: 'EQUAL',
        split_details: splitData,
        paid_from_pot: true,
        user_id: transactionOwner 
    };

    let error;
    if (editingId) {
        const { error: updateError } = await supabase.from('transactions').update(payload).eq('id', editingId);
        error = updateError;
    } else {
        const { error: insertError } = await supabase.from('transactions').insert({ pot_id: potId, ...payload });
        error = insertError;
    }

    if (error) Alert.alert("Error", error.message);
    else {
      setModalVisible(false);
      fetchDetails(); 
    }
    setProcessing(false);
  };

  const deleteTransaction = async (id: string) => {
    if (myRole !== 'owner' && myRole !== 'admin') return;
    Alert.alert("Delete?", "Remove this?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            await supabase.from('transactions').delete().eq('id', id);
            fetchDetails(); 
          }}
    ]);
  };

  const toggleMemberSelection = (userId: string) => {
    if (selectedMembers.includes(userId)) {
        if (selectedMembers.length > 1) setSelectedMembers(selectedMembers.filter(id => id !== userId));
    } else {
        setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const getProgress = () => {
    if (!potData || potData.target_amount === 0) return 0;
    const percent = (potData.current_amount / potData.target_amount) * 100;
    return Math.max(0, Math.min(100, percent));
  };
  const getSplitText = () => {
    if (!amount || selectedMembers.length === 0) return "£0.00 each";
    return `£${(parseFloat(amount) / selectedMembers.length).toFixed(2)} ea`;
  };
  const canEdit = myRole === 'owner' || myRole === 'admin';

  return (
    <LinearGradient colors={['#2c2c2e', '#000000']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.title}>{name}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => setBalanceVisible(true)}><Ionicons name="stats-chart" size={24} color="#3b82f6" /></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color="#3b82f6" style={{marginTop: 50}} /> : (
        <FlatList
          contentContainerStyle={styles.content}
          data={transactions}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              {/* MEMBERS */}
              <View style={styles.membersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 15, paddingHorizontal: 10}}>
                    {members.map(member => (
                        <View key={member.id} style={styles.popCircleContainer}>
                            <View style={styles.popCircle}>
                                {member.profiles?.avatar_url ? <Image source={{ uri: member.profiles.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={styles.popInitials}>{member.profiles?.full_name?.[0] || '?'}</Text>}
                            </View>
                            <Text style={styles.popName} numberOfLines={1}>{member.profiles?.full_name?.split(' ')[0]}</Text>
                        </View>
                    ))}
                    <TouchableOpacity onPress={handleInvite} style={styles.popCircleContainer}>
                        <View style={[styles.popCircle, {backgroundColor:'#222', borderWidth:1, borderColor:'#444'}]}><Ionicons name="add" size={24} color="#fff" /></View>
                        <Text style={styles.popName}>Invite</Text>
                    </TouchableOpacity>
                </ScrollView>
              </View>

              {/* DASHBOARD CARD */}
              <View style={styles.amountCard}>
                  <Text style={styles.currencyLabel}>Pot Balance</Text>
                  <Text style={styles.bigAmount}>£{potData?.current_amount?.toFixed(2)}</Text>
                  <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${getProgress()}%` }]} /></View>
                  
                  {canEdit ? (
                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#22c55e'}]} onPress={() => openModal('deposit')}>
                            <Ionicons name="add" size={24} color="#000" />
                            <Text style={styles.btnText}>Add Funds</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#3b82f6'}]} onPress={handleSettleUp}>
                            <Ionicons name="list" size={24} color="#000" />
                            <Text style={styles.btnText}>Status</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#ef4444'}]} onPress={() => openModal('withdraw')}>
                            <Ionicons name="remove" size={24} color="#000" />
                            <Text style={styles.btnText}>Spend</Text>
                        </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.readOnlyBadge}><Text style={{color:'#888'}}>View Only Mode</Text></View>
                  )}
              </View>
              <Text style={styles.sectionTitle}>History</Text>
            </>
          }
          renderItem={({ item }) => {
            const isDeposit = item.amount > 0;
            return (
              <TouchableOpacity onPress={() => canEdit && openModal(isDeposit ? 'deposit' : 'withdraw', item)} onLongPress={() => deleteTransaction(item.id)} activeOpacity={0.7} style={styles.transactionRow}>
                <View style={[styles.transIcon, { backgroundColor: isDeposit ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                  <Ionicons name={isDeposit ? "arrow-up" : getCategoryIcon(item.category)} size={18} color={isDeposit ? "#22c55e" : "#ef4444"} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.transName}>{item.title}</Text>
                  <Text style={styles.transSub}>{item.profiles?.full_name || 'User'} • {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.transAmount, { color: isDeposit ? '#22c55e' : '#ef4444' }]}>{isDeposit ? '+' : ''}£{Math.abs(item.amount).toFixed(2)}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={{color: '#666', textAlign: 'center'}}>No transactions yet.</Text>}
        />
      )}

      {/* INPUT MODAL */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Entry' : (transType === 'deposit' ? 'Add Funds 💰' : 'Record Expense 💸')}</Text>
                
                <TextInput placeholder="£0.00" placeholderTextColor="#555" keyboardType="numeric" style={styles.amountInput} value={amount} onChangeText={setAmount} autoFocus />
                
                {transType === 'withdraw' && (
                    <View style={{marginBottom: 20}}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 10}}>
                            {CATEGORIES.map(cat => (
                                <TouchableOpacity key={cat.id} onPress={() => setCategory(cat.id)} style={[styles.catChip, category === cat.id && styles.catChipActive]}>
                                    <Ionicons name={cat.icon as any} size={16} color={category === cat.id ? '#fff' : '#666'} />
                                    <Text style={[styles.catText, category === cat.id && {color:'#fff'}]}>{cat.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View style={styles.detailsContainer}>
                    <TextInput placeholder={transType === 'deposit' ? "Source" : "Merchant/Title"} placeholderTextColor="#666" style={styles.detailInput} value={title} onChangeText={setTitle} />
                    <View style={styles.divider} />
                    <TextInput placeholder="Notes" placeholderTextColor="#666" style={styles.detailInput} value={description} onChangeText={setDescription} />
                </View>

                {transType === 'deposit' && (
                    <View style={styles.splitSection}>
                        <Text style={styles.splitHeader}>Received From:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                            {members.map(member => (
                                <TouchableOpacity key={member.id} onPress={() => setDepositorId(member.user_id)} style={[styles.memberChip, depositorId === member.user_id && styles.memberChipActive]}>
                                    <Text style={[styles.memberChipText, depositorId === member.user_id && styles.memberChipTextActive]}>{member.profiles?.full_name?.split(' ')[0]}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {transType === 'withdraw' && (
                    <View style={styles.splitSection}>
                        <Text style={styles.splitHeader}>Split Between:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                            {members.map(member => {
                                const isSelected = selectedMembers.includes(member.user_id);
                                return (
                                    <TouchableOpacity key={member.id} onPress={() => toggleMemberSelection(member.user_id)} style={[styles.memberChip, isSelected && styles.memberChipActive]}>
                                        <Text style={[styles.memberChipText, isSelected && styles.memberChipTextActive]}>{member.profiles?.full_name?.split(' ')[0]}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <Text style={styles.splitMath}>{getSplitText()}</Text>
                    </View>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}><Text style={{ color: '#888' }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleTransaction} style={[styles.confirmBtn, { backgroundColor: transType === 'deposit' ? '#22c55e' : '#ef4444' }]} disabled={processing}>
                    {processing ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmBtnText}>{editingId ? 'Save' : 'Confirm'}</Text>}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
      </Modal>

      {/* BALANCE SHEET MODAL */}
      <Modal animationType="fade" transparent={true} visible={balanceVisible} onRequestClose={() => setBalanceVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Pot Balance</Text>
                <Text style={{color:'#666', textAlign:'center', marginBottom:20}}>Calculated Refunds & Debts</Text>
                {members.map(member => {
                    const bal = memberBalances[member.user_id] || 0;
                    return (
                        <View key={member.id} style={styles.balanceRow}>
                            <View style={styles.avatar}>{member.profiles?.avatar_url ? <Image source={{ uri: member.profiles.avatar_url }} style={{ width: '100%', height: '100%', borderRadius: 16 }} /> : <Text style={{color:'#fff'}}>{member.profiles?.full_name?.[0]}</Text>}</View>
                            <Text style={styles.balanceName}>{member.profiles?.full_name}</Text>
                            <Text style={[styles.balanceAmount, { color: bal >= 0 ? '#22c55e' : '#ef4444' }]}>{bal >= 0 ? '+' : ''}£{bal.toFixed(2)}</Text>
                        </View>
                    )
                })}
                <TouchableOpacity onPress={() => setBalanceVisible(false)} style={[styles.confirmBtn, {backgroundColor:'#333', marginTop:20}]}><Text style={styles.confirmBtnText}>Close</Text></TouchableOpacity>
            </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 }, // Removed fixed black BG
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 50 },
  membersContainer: { marginBottom: 20 },
  popCircleContainer: { alignItems: 'center', width: 60 },
  popCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderWidth: 2, borderColor: '#000', overflow:'hidden' },
  popInitials: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  popName: { color: '#888', fontSize: 10, fontWeight: '600' },
  amountCard: { backgroundColor: 'rgba(255,255,255,0.08)', padding: 24, borderRadius: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  currencyLabel: { color: '#666', fontSize: 14, textTransform: 'uppercase', marginBottom: 8 },
  bigAmount: { color: '#fff', fontSize: 48, fontWeight: '900' },
  progressTrack: { width: '100%', height: 8, backgroundColor: '#222', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 4 },
  buttonRow: { flexDirection: 'row', gap: 8, width: '100%', paddingHorizontal: 4 },
  actionBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, gap: 4 },
  btnText: { color: '#000', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  readOnlyBadge: { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#222', paddingVertical:8, paddingHorizontal:16, borderRadius:20 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  transIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  transName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  transSub: { color: '#666', fontSize: 12, marginTop: 2 },
  transAmount: { fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  amountInput: { fontSize: 42, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 },
  detailsContainer: { backgroundColor: '#222', borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  detailInput: { padding: 16, color: '#fff', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#333' },
  splitSection: { marginBottom: 20 },
  splitHeader: { color: '#888', marginBottom: 10, fontSize: 14 },
  memberChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#333', marginRight: 8 },
  memberChipActive: { backgroundColor: '#3b82f6' },
  memberChipText: { color: '#888', fontWeight: '600' },
  memberChipTextActive: { color: '#fff' },
  splitMath: { color: '#22c55e', marginTop: 10, fontWeight: 'bold', textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelBtn: { padding: 16 },
  confirmBtn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  confirmBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  balanceRow: { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#222' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  balanceName: { flex:1, color:'#fff', fontSize:16, fontWeight:'bold' },
  balanceAmount: { fontSize:16, fontWeight:'bold' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#222', borderWidth: 1, borderColor: '#333' },
  catChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  catText: { color: '#888', fontWeight: '600', fontSize: 12 }
});