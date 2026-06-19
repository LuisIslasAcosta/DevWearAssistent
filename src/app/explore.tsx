import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  tag?: string;
}

const MAX_NOTE_LENGTH = 200;

export default function TabTwoScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputTag, setInputTag] = useState('');
  const [tagFocused, setTagFocused] = useState(false);
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();

  useEffect(() => {
    loadTasks();
    requestNotificationPermissions();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') Alert.alert('Permisos', 'Activa notificaciones para recordatorios.');
  };

  const loadTasks = async () => {
    const saved = await AsyncStorage.getItem('tasks');
    if (saved) setTasks(JSON.parse(saved));
  };

  const addTask = async () => {
    if (!inputText.trim()) return;
    if (inputText.trim().length > MAX_NOTE_LENGTH) {
      Alert.alert('Nota demasiado larga', `Máximo ${MAX_NOTE_LENGTH} caracteres.`);
      return;
    }
    const newTask: Task = { id: Date.now().toString(), text: inputText.trim(), completed: false, tag: inputTag.trim() || undefined };
    const updated = [newTask, ...tasks];
    setTasks(updated);
    await AsyncStorage.setItem('tasks', JSON.stringify(updated));
    setInputText('');
    setInputTag('');
    setTagFocused(false);
  };

  const toggleTask = async (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    setTasks(updated);
    await AsyncStorage.setItem('tasks', JSON.stringify(updated));
  };

  const deleteTask = async (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    await AsyncStorage.setItem('tasks', JSON.stringify(updated));
  };

  const startVoiceNote = () => {
    if (Platform.OS === 'web') { Alert.alert('No disponible', 'Requiere dispositivo físico.'); return; }
    Speech.speak('Función de dictado activada.', { language: 'es-ES' });
    Alert.alert('Dictado', 'Se requiere librería adicional para voz a texto.');
  };

  const scheduleHydrationReminder = async () => {
    await Notifications.scheduleNotificationAsync({
      content: { title: '💧 Hora de hidratarse', body: 'Bebe agua y estira los dedos.', sound: 'default' },
      trigger: { type: 'timeInterval', seconds: 60 * 60, repeats: true } as any,
    });
    Alert.alert('Recordatorio activado', 'Recibirás un aviso cada hora.');
  };

  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const monoFamily = Platform.select({ ios: 'ui-monospace', default: 'monospace', web: 'var(--font-mono)' });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, Platform.select({ android: { paddingTop: safeAreaInsets.top }, web: { paddingTop: Spacing.six } })]}
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="label" themeColor="textSecondary">DEVWEAR</ThemedText>
          <ThemedText type="label" style={{ color: theme.accent }}>// tareas</ThemedText>
        </View>

        <ThemedText type="subtitle" style={styles.pageTitle}>Tareas y Notas</ThemedText>

        <ThemedView type="backgroundElement" style={styles.inputCard}>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.mainInput, { color: theme.text, fontFamily: monoFamily }]}
              placeholder="// nuevo bug o idea..."
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={addTask}
              onFocus={() => setTagFocused(true)}
            />
            <TouchableOpacity onPress={startVoiceNote} style={styles.micBtn}>
              <SymbolView name="mic.fill" size={18} tintColor={theme.accent} />
            </TouchableOpacity>
          </View>

          {tagFocused && (
            <View style={styles.tagRow}>
              <ThemedText type="label" themeColor="textSecondary">#TAG</ThemedText>
              <TextInput
                style={[styles.tagInput, { color: theme.accentGlow, borderColor: theme.backgroundSelected }]}
                placeholder="bug / idea / refactor"
                placeholderTextColor={theme.textSecondary}
                value={inputTag}
                onChangeText={setInputTag}
              />
            </View>
          )}

          <View style={styles.inputActions}>
            <TouchableOpacity onPress={scheduleHydrationReminder} style={styles.reminderBtn}>
              <SymbolView name="drop.fill" size={14} tintColor={theme.textSecondary} />
              <ThemedText type="label" themeColor="textSecondary">HIDRATACIÓN</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={addTask} style={[styles.addBtn, { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={{ color: '#0D1117' }}>+ Agregar</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>

        {pending.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>PENDIENTES · {pending.length}</ThemedText>
            {pending.map((task) => <TaskRow key={task.id} task={task} theme={theme} onToggle={toggleTask} onDelete={deleteTask} />)}
          </View>
        )}

        {done.length > 0 && (
          <View style={[styles.section, { marginBottom: BottomTabInset + Spacing.three }]}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>COMPLETADAS · {done.length}</ThemedText>
            {done.map((task) => <TaskRow key={task.id} task={task} theme={theme} onToggle={toggleTask} onDelete={deleteTask} />)}
          </View>
        )}

        {tasks.length === 0 && (
          <View style={[styles.emptyState, { marginBottom: BottomTabInset + Spacing.three }]}>
            <ThemedText type="mono" themeColor="textSecondary">// sin tareas aún</ThemedText>
            <ThemedText type="mono" themeColor="textSecondary">// escribe algo arriba</ThemedText>
          </View>
        )}
      </ThemedView>
    </ScrollView>
  );
}

function TaskRow({ task, theme, onToggle, onDelete }: { task: any; theme: any; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <TouchableOpacity onPress={() => onToggle(task.id)} style={styles.taskRow}>
      <View style={[styles.taskCheck, { borderColor: task.completed ? theme.accent : theme.textSecondary, backgroundColor: task.completed ? theme.accent : 'transparent' }]}>
        {task.completed && <SymbolView name="checkmark" size={10} tintColor="#0D1117" />}
      </View>
      <View style={styles.taskContent}>
        <ThemedText style={[styles.taskText, { color: task.completed ? theme.textSecondary : theme.text, fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace', web: 'var(--font-mono)' }) }, task.completed && styles.completedText]}>
          {task.text}
        </ThemedText>
        {task.tag && <ThemedText type="label" style={{ color: theme.accent, marginTop: 2 }}>#{task.tag}</ThemedText>}
      </View>
      <TouchableOpacity onPress={() => onDelete(task.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <SymbolView name="xmark" size={14} tintColor={theme.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  container: { maxWidth: MaxContentWidth, flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  pageTitle: { paddingHorizontal: Spacing.four, marginBottom: Spacing.three },
  inputCard: { marginHorizontal: Spacing.four, borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.four },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, gap: Spacing.two },
  mainInput: { flex: 1, fontSize: 14, lineHeight: 20 },
  micBtn: { padding: Spacing.one },
  tagRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  tagInput: { flex: 1, fontSize: 12, borderBottomWidth: 1, paddingVertical: Spacing.one, letterSpacing: 0.5 },
  inputActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(125,133,144,0.2)' },
  reminderBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  addBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.sm },
  section: { paddingHorizontal: Spacing.four, marginBottom: Spacing.four },
  sectionLabel: { marginBottom: Spacing.two },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(125,133,144,0.15)' },
  taskCheck: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  taskContent: { flex: 1 },
  taskText: { fontSize: 13, lineHeight: 18 },
  completedText: { textDecorationLine: 'line-through', opacity: 0.5 },
  emptyState: { padding: Spacing.six, alignItems: 'center', gap: Spacing.one },
});