import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  FlatList, Alert, Share, Modal, TextInput, KeyboardAvoidingView, 
  Platform, TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as Clipboard from 'expo-clipboard'; 

type Member = { 
  id: string; 
  user_id: string; 
  role: string;
  profiles: { full_name: string } | null; 
};

type Transaction = {
  id: string;
  amount: number;
  created_at: string;
  profiles: { full_name: string } | null;
};

export default function PotDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { potId, name, code: paramCode } = route.params; 

  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [potData, setPotData] = useState<any>(null);

  // Deposit State
  const [depositVisible, setDepositVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [depositing, setDepositing] = useState(false);

  async function fetchDetails() {
    setLoading(true);
    
    // 1. Get Pot Stats
    const { data: pot, error: potError } = await supabase
      .from('pots')
      .select('*')
      .eq('id', potId)
      .single();
    if (pot) setPotData(pot);

    // 2. Get Members
    const { data: mems } = await supabase
      .from('pot_members')
      .select('*, profiles(full_name)')
      .eq('pot_id', potId);
    if (mems) setMembers(mems as any);

    // 3. Get Transactions (New)
    const { data: trans } = await supabase
      .from('transactions')
      .select('*, profiles(full_name)')
      .eq('pot_id', potId)
      .order('created_at', { ascending: false });
    if (trans) setTransactions(trans as any);

    setLoading(false);
  }

  useEffect(() => { fetchDetails(); }, []);

  // --- ACTIONS ---

  const handleDeposit = async () => {
    if (!amount) return;
    setDepositing(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // We only insert the transaction. 
    // The SQL Trigger will automatically update the Pot Balance!
    const { error } = await supabase.from('transactions').insert({
      pot_id: potId,
      user_id: user.id,
      amount: parseFloat(amount),
      description: 'Deposit'
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setAmount('');
      setDepositVisible(false);
      fetchDetails(); // Refresh to see new balance
    }
    setDepositing(false);
  };

  const copyToClipboard = async () => {
    const code = potData?.share_code || paramCode;
    await Clipboard.setStringAsync(code);
    Alert.alert("Copied!", "Send this code to your friend.");
  };

  const shareMessage = async () => {
    const code = potData?.share_code || paramCode;
    Share.share({ message: `Join my pot "${name}"! Code: ${code}` });
  };

  const getProgress = () => {
    if (!potData || potData.target_amount === 0) return 0;
    return Math.min(100, (potData.current_amount / potData.target_amount) * 100);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{name}</Text>
        <TouchableOpacity style={styles.backBtn}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color="#3b82f6" style={{marginTop: 50}} /> : (
        <FlatList
          contentContainerStyle={styles.content}
          data={transactions} // We use the list to render transactions
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              {/* Share Banner */}
              <View style={styles.shareBanner}>
                  <TouchableOpacity onPress={copyToClipboard} style={styles.shareTextContainer}>
                      <Text style={styles.shareLabel}>TAP TO COPY</Text>
                      <Text style={styles.shareCode}>{potData?.share_code || paramCode}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={shareMessage} style={styles.shareIconBtn}>
                      <Ionicons name="share-outline" size={24} color="#fff" />
                  </TouchableOpacity>
              </View>

              {/* Amount Card */}
              <View style={styles.amountCard}>
                  <Text style={styles.currencyLabel}>Total Saved</Text>
                  <Text style={styles.bigAmount}>
                      {potData?.currency === 'USD' ? '$' : '£'}{potData?.current_amount}
                  </Text>
                  <Text style={styles.targetLabel}>
                      of {potData?.currency === 'USD' ? '$' : '£'}{potData?.target_amount} goal
                  </Text>
                  <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${getProgress()}%` }]} />
                  </View>

                  {/* Add Money Button */}
                  <TouchableOpacity style={styles.depositBtn} onPress={() => setDepositVisible(true)}>
                    <Text style={styles.depositBtnText}>+ Add Funds</Text>
                  </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Recent Activity</Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.transactionRow}>
              <View style={styles.transIcon}>
                <Ionicons name="arrow-up" size={18} color="#22c55e" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.transName}>{item.profiles?.full_name || 'User'}</Text>
                <Text style={styles.transDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.transAmount}>+£{item.amount}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{color: '#666', textAlign: 'center'}}>No transactions yet.</Text>}
        />
      )}

      {/* DEPOSIT MODAL */}
      <Modal animationType="slide" transparent={true} visible={depositVisible} onRequestClose={() => setDepositVisible(false)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add to Pot</Text>
                <Text style={{color:'#666', marginBottom: 20}}>How much are you putting in?</Text>
                
                <TextInput 
                  placeholder="£0.00" 
                  placeholderTextColor="#555"
                  keyboardType="numeric"
                  style={styles.input} 
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={() => setDepositVisible(false)} style={styles.cancelBtn}>
                    <Text style={{ color: '#888' }}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={handleDeposit} style={styles.createBtn} disabled={depositing}>
                    {depositing ? <ActivityIndicator color="#000" /> : <Text style={styles.createBtnText}>Confirm</Text>}
                  </TouchableOpacity>
                </View>

              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: '#111', borderRadius: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 50 },
  
  // Banner
  shareBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#112240', borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#1e3a8a', overflow: 'hidden', height: 80 },
  shareTextContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shareLabel: { color: '#60a5fa', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  shareCode: { color: '#fff', fontWeight: 'bold', fontSize: 24, letterSpacing: 4 },
  shareIconBtn: { backgroundColor: '#3b82f6', width: 60, height: '100%', justifyContent: 'center', alignItems: 'center' },

  // Card
  amountCard: { backgroundColor: '#111', padding: 30, borderRadius: 24, alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#222' },
  currencyLabel: { color: '#666', fontSize: 14, textTransform: 'uppercase', marginBottom: 8 },
  bigAmount: { color: '#fff', fontSize: 48, fontWeight: '900' },
  targetLabel: { color: '#888', fontSize: 16, marginBottom: 20 },
  progressTrack: { width: '100%', height: 8, backgroundColor: '#222', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 4 },
  
  depositBtn: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 30 },
  depositBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  
  // Transactions
  transactionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  transIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(34, 197, 94, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  transName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  transDate: { color: '#666', fontSize: 12, marginTop: 2 },
  transAmount: { color: '#22c55e', fontWeight: 'bold', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  input: { backgroundColor: '#000', color: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333', marginBottom: 16, fontSize: 24, textAlign: 'center', fontWeight: 'bold' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cancelBtn: { padding: 16 },
  createBtn: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  createBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});