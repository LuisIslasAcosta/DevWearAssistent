// Importaciones necesarias para la pantalla de tareas y notas
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Dimensions, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Interfaz para definir la estructura de una tarea
interface Task {
  id: string; // Identificador único de la tarea
  text: string; // Texto de la tarea
  completed: boolean; // Si la tarea está completada
  tag?: string; // Etiqueta opcional para categorizar
  createdAt: string; // Fecha de creación en formato ISO
}

// Longitud máxima de caracteres para una nota
const MAX_NOTE_LENGTH = 200;

// Detección del tamaño de pantalla para diseño responsivo
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768; // Consideramos tablet si el ancho es >= 768px

export default function TabTwoScreen() {
  // Estados de la aplicación
  const [tasks, setTasks] = useState<Task[]>([]); // Lista de todas las tareas
  const [inputText, setInputText] = useState(''); // Texto del input de nueva tarea
  const [inputTag, setInputTag] = useState(''); // Texto del input de etiqueta
  const [tagFocused, setTagFocused] = useState(false); // Si el campo de etiqueta está enfocado
  const safeAreaInsets = useSafeAreaInsets(); // Márgenes seguros del dispositivo
  const theme = useTheme(); // Tema actual de la aplicación

  // Solicitar permisos de notificaciones al iniciar
  const requestNotificationPermissions = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') Alert.alert('Permisos', 'Activa notificaciones para recordatorios.');
  }, []);

  // Cargar tareas guardadas desde almacenamiento
  const loadTasks = useCallback(async () => {
    const saved = await AsyncStorage.getItem('tasks');
    if (saved) setTasks(JSON.parse(saved));
  }, []);

  // Efecto para cargar datos al iniciar la pantalla
  useEffect(() => {
    requestNotificationPermissions();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks().catch(console.error);
  }, [loadTasks, requestNotificationPermissions]);

  // Agregar una nueva tarea
  const addTask = async () => {
    if (!inputText.trim()) return; // No agregar si está vacío
    
    // Validar longitud máxima
    if (inputText.trim().length > MAX_NOTE_LENGTH) {
      Alert.alert('Nota demasiado larga', `Máximo ${MAX_NOTE_LENGTH} caracteres.`);
      return;
    }
    
    // Crear nueva tarea con fecha de creación actual
    const newTask: Task = { 
      id: Date.now().toString(), // ID único basado en timestamp
      text: inputText.trim(), 
      completed: false, // Nueva tarea siempre pendiente
      tag: inputTag.trim() || undefined, // Tag opcional
      createdAt: new Date().toISOString() // Fecha actual en formato ISO
    };
    
    // Actualizar estado y guardar
    const updated = [newTask, ...tasks];
    setTasks(updated);
    await AsyncStorage.setItem('tasks', JSON.stringify(updated));
    
    // Limpiar inputs
    setInputText('');
    setInputTag('');
    setTagFocused(false);
  };

  // Marcar/desmarcar tarea como completada
  const toggleTask = async (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    setTasks(updated);
    await AsyncStorage.setItem('tasks', JSON.stringify(updated));
  };

  // Eliminar una tarea
  const deleteTask = async (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    await AsyncStorage.setItem('tasks', JSON.stringify(updated));
  };

  // Iniciar dictado de voz (funcionalidad preparada para futuro)
  const startVoiceNote = () => {
    if (Platform.OS === 'web') { 
      Alert.alert('No disponible', 'Requiere dispositivo físico.'); 
      return; 
    }
    
    // Notificar al usuario que la función está activa
    Speech.speak('Función de dictado activada.', { language: 'es-ES' });
    Alert.alert('Dictado', 'Se requiere librería adicional para voz a texto.');
  };

  // Programar recordatorio de hidratación cada hora
  const scheduleHydrationReminder = async () => {
    await Notifications.scheduleNotificationAsync({
      content: { 
        title: '💧 Hora de hidratarse', 
        body: 'Bebe agua y estira los dedos.', 
        sound: 'default' 
      },
      trigger: { 
        type: 'timeInterval', 
        seconds: 60 * 60, // Cada 1 hora
        repeats: true 
      } as any,
    });
    Alert.alert('Recordatorio activado', 'Recibirás un aviso cada hora.');
  };

  // Filtrar tareas pendientes y completadas
  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  
  // Familia de fuente monoespaciada para código
  const monoFamily = Platform.select({ 
    ios: 'ui-monospace', 
    default: 'monospace', 
    web: 'var(--font-mono)' 
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.contentContainer, 
        Platform.select({ 
          android: { paddingTop: safeAreaInsets.top }, 
          web: { paddingTop: Spacing.six } 
        })
      ]}
    >
      <View style={[styles.container, isTablet && styles.containerTablet]}>
        {/* Encabezado de la pantalla */}
        <View style={styles.header}>
          <ThemedText type="label" themeColor="textSecondary">DEVWEAR</ThemedText>
          <ThemedText type="label" style={{ color: theme.accent }}>tareas</ThemedText>
        </View>

        {/* Título de la sección */}
        <ThemedText type="subtitle" style={styles.pageTitle}>Tareas y Notas</ThemedText>

        {/* Card de entrada de nueva tarea */}
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
              <SymbolView name="mic.fill" size={isTablet ? 22 : 18} tintColor={theme.accent} />
            </TouchableOpacity>
          </View>

          {/* Campo de etiqueta (solo visible cuando el input está enfocado) */}
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

          {/* Botones de acción */}
          <View style={styles.inputActions}>
            <TouchableOpacity onPress={scheduleHydrationReminder} style={styles.reminderBtn}>
              <SymbolView name="drop.fill" size={isTablet ? 16 : 14} tintColor={theme.textSecondary} />
              <ThemedText type="label" themeColor="textSecondary">HIDRATACIÓN</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={addTask} style={[styles.addBtn, { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={{ color: '#0D1117' }}>+ Agregar</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>

        {/* Sección de tareas pendientes */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
              PENDIENTES · {pending.length}
            </ThemedText>
            {pending.map((task) => (
              <TaskRow key={task.id} task={task} theme={theme} onToggle={toggleTask} onDelete={deleteTask} />
            ))}
          </View>
        )}

        {/* Sección de tareas completadas */}
        {done.length > 0 && (
          <View style={[styles.section, { marginBottom: BottomTabInset + Spacing.three }]}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
              COMPLETADAS · {done.length}
            </ThemedText>
            {done.map((task) => (
              <TaskRow key={task.id} task={task} theme={theme} onToggle={toggleTask} onDelete={deleteTask} />
            ))}
          </View>
        )}

        {/* Estado vacío cuando no hay tareas */}
        {tasks.length === 0 && (
          <View style={[styles.emptyState, { marginBottom: BottomTabInset + Spacing.three }]}>
            <ThemedText type="mono" themeColor="textSecondary">{'// sin tareas aún'}</ThemedText>
            <ThemedText type="mono" themeColor="textSecondary">{'// escribe algo arriba'}</ThemedText>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// Componente individual para cada fila de tarea
function TaskRow({ task, theme, onToggle, onDelete }: { 
  task: any; 
  theme: any; 
  onToggle: (id: string) => void; 
  onDelete: (id: string) => void; 
}) {
  return (
    <TouchableOpacity onPress={() => onToggle(task.id)} style={styles.taskRow}>
      {/* Checkbox personalizado */}
      <View style={[
        styles.taskCheck, 
        { 
          borderColor: task.completed ? theme.accent : theme.textSecondary, 
          backgroundColor: task.completed ? theme.accent : 'transparent' 
        }
      ]}>
        {task.completed && <SymbolView name="checkmark" size={isTablet ? 12 : 10} tintColor="#0D1117" />}
      </View>
      
      {/* Contenido de la tarea */}
      <View style={styles.taskContent}>
        <ThemedText style={[
          styles.taskText, 
          { 
            color: task.completed ? theme.textSecondary : theme.text, 
            fontFamily: Platform.select({ 
              ios: 'ui-monospace', 
              default: 'monospace', 
              web: 'var(--font-mono)' 
            }) 
          }, 
          task.completed && styles.completedText
        ]}>
          {task.text}
        </ThemedText>
        {/* Mostrar etiqueta si existe */}
        {task.tag && <ThemedText type="label" style={{ color: theme.accent, marginTop: 2 }}>#{task.tag}</ThemedText>}
      </View>
      
      {/* Botón de eliminar */}
      <TouchableOpacity onPress={() => onDelete(task.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <SymbolView name="xmark" size={isTablet ? 16 : 14} tintColor={theme.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// Estilos de la pantalla con diseño responsivo
const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  container: { maxWidth: MaxContentWidth, flexGrow: 1, width: '100%' },
  containerTablet: { maxWidth: 900, paddingHorizontal: Spacing.six }, // Contenedor más ancho en tablets
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: isTablet ? Spacing.six : Spacing.four, 
    paddingTop: Spacing.three, 
    paddingBottom: Spacing.one 
  },
  pageTitle: { 
    paddingHorizontal: isTablet ? Spacing.six : Spacing.four, 
    marginBottom: isTablet ? Spacing.four : Spacing.three,
    fontSize: isTablet ? 28 : 24 // Título más grande en tablets
  },
  inputCard: { 
    marginHorizontal: isTablet ? Spacing.six : Spacing.four, 
    borderRadius: isTablet ? Radius.lg : Radius.md, 
    overflow: 'hidden', 
    marginBottom: isTablet ? Spacing.five : Spacing.four 
  },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: isTablet ? Spacing.four : Spacing.three, 
    gap: isTablet ? Spacing.three : Spacing.two 
  },
  mainInput: { 
    flex: 1, 
    fontSize: isTablet ? 16 : 14, 
    lineHeight: isTablet ? 24 : 20 
  },
  micBtn: { padding: isTablet ? Spacing.two : Spacing.one },
  tagRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: isTablet ? Spacing.four : Spacing.three, 
    paddingBottom: isTablet ? Spacing.three : Spacing.two, 
    gap: isTablet ? Spacing.three : Spacing.two 
  },
  tagInput: { 
    flex: 1, 
    fontSize: isTablet ? 14 : 12, 
    borderBottomWidth: 1, 
    paddingVertical: isTablet ? Spacing.two : Spacing.one, 
    letterSpacing: 0.5 
  },
  inputActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: isTablet ? Spacing.four : Spacing.three, 
    paddingVertical: isTablet ? Spacing.three : Spacing.two, 
    borderTopWidth: StyleSheet.hairlineWidth, 
    borderTopColor: 'rgba(125,133,144,0.2)' 
  },
  reminderBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  addBtn: { 
    paddingHorizontal: isTablet ? Spacing.four : Spacing.three, 
    paddingVertical: isTablet ? Spacing.three : Spacing.two, 
    borderRadius: Radius.sm 
  },
  section: { 
    paddingHorizontal: isTablet ? Spacing.six : Spacing.four, 
    marginBottom: isTablet ? Spacing.five : Spacing.four 
  },
  sectionLabel: { 
    marginBottom: isTablet ? Spacing.three : Spacing.two,
    fontSize: isTablet ? 16 : 14 // Etiqueta más grande en tablets
  },
  taskRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: isTablet ? Spacing.three : Spacing.two, 
    paddingVertical: isTablet ? Spacing.three : Spacing.two, 
    borderBottomWidth: StyleSheet.hairlineWidth, 
    borderBottomColor: 'rgba(125,133,144,0.15)' 
  },
  taskCheck: { 
    width: isTablet ? 22 : 18, 
    height: isTablet ? 22 : 18, 
    borderRadius: isTablet ? 5 : 4, 
    borderWidth: 1.5, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 2 
  },
  taskContent: { flex: 1 },
  taskText: { 
    fontSize: isTablet ? 15 : 13, 
    lineHeight: isTablet ? 22 : 18 
  },
  completedText: { textDecorationLine: 'line-through', opacity: 0.5 },
  emptyState: { 
    padding: isTablet ? Spacing.six * 1.5 : Spacing.six, 
    alignItems: 'center', 
    gap: Spacing.one 
  },
});