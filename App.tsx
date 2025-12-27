import React, { useEffect, useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, 
  SafeAreaView, FlatList, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback 
} from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import { AuthScreen } from './AuthScreen';
import { supabase } from './lib/supabase';
import { Ionicons } from '@expo/vector-icons';

// Define what a "Pot" looks like
type Pot = {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
};

const HomeScreen = () => {
  const { session } = useAuth();
  const [pots, setPots] = useState<Pot[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- NEW: Form State ---
  const [modalVisible, setModalVisible] = useState(false);
  const [newPotName, setNewPotName] = useState('');
  const [newPotTarget, setNewPotTarget] = useState('');
  const [creating, setCreating] = useState(false);

  // 1. Fetch Pots
  async function fetchPots() {
    if (!session) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('pots')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) Alert.alert('Error fetching pots', error.message);
    else setPots(data || []);
    setLoading(false);
  }

  // 2. Create Real Pot (Connected to Form)
  async function createPot() {
    if (!newPotName || !newPotTarget) {
      Alert.alert("Missing Info", "Please enter a name and target amount.");
      return;
    }

    setCreating(true);
    const { error } = await supabase.from('pots').insert({
      name: newPotName,
      target_amount: parseFloat(newPotTarget), // Convert text to number
      current_amount: 0,
      owner_id: session?.user.id
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      // Success! Close modal and refresh list
      setNewPotName('');
      setNewPotTarget('');
      setModalVisible(false);
      fetchPots();
    }
    setCreating(false);
  }

  useEffect(() => {
    fetchPots();
  }, []);

  const renderPot = ({ item }: { item: Pot }) => (
    <View style={styles.potCard}>
      <View style={styles.potIcon}>
        <Ionicons name="wallet-outline" size={24} color="#3b82f6" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.potName}>{item.name}</Text>
        <Text style={styles.potSubtitle}>Target: £{item.target_amount}</Text>
      </View>
      <Text style={styles.potAmount}>£{item.current_amount}</Text>
    </View>
  );

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

        {/* Total Balance */}
        <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Saved</Text>
            <Text style={styles.balance}>
                £{pots.reduce((sum, pot) => sum + pot.current_amount, 0)}
            </Text>
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
            <Text style={styles.sectionTitle}>Your Pots</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
                <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>+ New Pot</Text>
            </TouchableOpacity>
        </View>

        {/* List */}
        {loading ? (
            <ActivityIndicator color="#3b82f6" />
        ) : pots.length === 0 ? (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No pots yet.</Text>
                <Text style={styles.emptySubText}>Tap "+ New Pot" to start saving.</Text>
            </View>
        ) : (
            <FlatList 
                data={pots} 
                renderItem={renderPot} 
                keyExtractor={(item) => item.id} 
                contentContainerStyle={{ gap: 12 }}
            />
        )}

        {/* --- NEW: CREATE POT MODAL --- */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                
                <Text style={styles.modalTitle}>New Pot</Text>
                
                <Text style={styles.label}>Pot Name</Text>
                <TextInput 
                  placeholder="e.g. Summer Holiday" 
                  placeholderTextColor="#555"
                  style={styles.input} 
                  value={newPotName}
                  onChangeText={setNewPotName}
                />

                <Text style={styles.label}>Target Amount (£)</Text>
                <TextInput 
                  placeholder="1000" 
                  placeholderTextColor="#555"
                  keyboardType="numeric"
                  style={styles.input} 
                  value={newPotTarget}
                  onChangeText={setNewPotTarget}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                    <Text style={{ color: '#888' }}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={createPot} style={styles.createBtn} disabled={creating}>
                    {creating ? <ActivityIndicator color="#000" /> : <Text style={styles.createBtnText}>Create Pot</Text>}
                  </TouchableOpacity>
                </View>

              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

      </View>
    </SafeAreaView>
  );
};

// --- Navigation Wrapper ---
const Navigation = () => {
  const { session, loading } = useAuth();
  if (loading) return <View style={styles.centered}><ActivityIndicator color="#3b82f6"/></View>;
  if (!session) return <AuthScreen />;
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
  content: { flex: 1, padding: 24, paddingTop: 40 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  greeting: { color: '#888', fontSize: 16 },
  username: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  smallBtn: { padding: 8, backgroundColor: '#111', borderRadius: 20 },

  card: { backgroundColor: '#111', padding: 24, borderRadius: 24, marginBottom: 30, borderWidth: 1, borderColor: '#222' },
  cardLabel: { color: '#666', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  balance: { color: '#fff', fontSize: 42, fontWeight: '900', marginTop: 8 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  potCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 16, borderRadius: 16, gap: 16, borderWidth: 1, borderColor: '#222' },
  potIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  potName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  potSubtitle: { color: '#666', fontSize: 13 },
  potAmount: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptySubText: { color: '#666', marginTop: 8 },

  // --- MODAL STYLES ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { color: '#888', marginBottom: 8, fontSize: 14 },
  input: { backgroundColor: '#000', color: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333', marginBottom: 16, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cancelBtn: { padding: 16 },
  createBtn: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  createBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});