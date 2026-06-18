import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
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
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();

  useEffect(() => {
    loadTasks();
    requestNotificationPermissions();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos de Notificación', 'Necesitamos permisos para enviar recordatorios.');
    }
  };

  const loadTasks = async () => {
    const saved = await AsyncStorage.getItem('tasks');
    if (saved) setTasks(JSON.parse(saved));
  };

  const addTask = async () => {
    if (!inputText.trim()) return;
    if (inputText.trim().length > MAX_NOTE_LENGTH) {
      Alert.alert('Nota demasiado larga', `La nota no puede exceder los ${MAX_NOTE_LENGTH} caracteres.`);
      return;
    }
    const newTask: Task = {
      id: Date.now().toString(),
      text: inputText.trim(),
      completed: false,
      tag: inputTag.trim() || undefined
    };
    const updated = [newTask, ...tasks];
    setTasks(updated);
    await AsyncStorage.setItem('tasks', JSON.stringify(updated));
    setInputText('');
    setInputTag('');
  };

  const toggleTask = async (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(updated);
    await AsyncStorage.setItem('tasks', JSON.stringify(updated));
  };

  const startVoiceNote = () => {
    if (Platform.OS === 'web') {
      Alert.alert("No disponible", "El reconocimiento de voz requiere dispositivo físico.");
      return;
    }
    Speech.speak("Función de dictado activada. Por favor, hable.", { language: 'es-ES' });
    Alert.alert("Reconocimiento de Voz", "La función de dictado de voz requiere una librería adicional para convertir voz a texto. Actualmente, solo se simula la activación.");
  };

  const scheduleHydrationReminder = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "¡Hora de hidratarse! 💧",
        body: "Bebe un poco de agua para mantenerte concentrado.",
        sound: 'default',
      },
      trigger: {
        type: 'timeInterval',
        seconds: 60 * 60,
        repeats: true,
      },
    });
    Alert.alert("Recordatorio de Hidratación", "Se ha programado un recordatorio de hidratación cada hora.");
  };

  const contentPlatformStyle = Platform.select({
    android: { paddingTop: safeAreaInsets.top },
    web: { paddingTop: Spacing.six },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">Tareas y Notas</ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Nuevo bug o idea..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={addTask}
          />
          <TouchableOpacity onPress={startVoiceNote}>
            <SymbolView name="mic.fill" size={20} tintColor="#208AEF" />
          </TouchableOpacity>
        </ThemedView>

        <TouchableOpacity onPress={scheduleHydrationReminder} style={styles.reminderButton}>
          <SymbolView name="drop.fill" size={20} tintColor="#208AEF" />
          <ThemedText type="smallBold">Programar Recordatorio de Hidratación</ThemedText>
        </TouchableOpacity>

        <ThemedView style={styles.taskList}>
          {tasks.map(task => (
            <TouchableOpacity 
              key={task.id} 
              onPress={() => toggleTask(task.id)}
              style={styles.taskItem}>
              <SymbolView 
                name={task.completed ? "checkmark.circle.fill" : "circle"} 
                size={20} 
                tintColor={task.completed ? "#4CAF50" : theme.textSecondary} 
              />
              <ThemedText style={[task.completed && styles.completedText]}>
                {task.text}{' '}
                {task.tag && <ThemedText type="small" themeColor="textSecondary">({task.tag})</ThemedText>}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
  titleContainer: { padding: Spacing.four },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#E0E1E6',
    gap: Spacing.two,
  },
  taskList: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
});
