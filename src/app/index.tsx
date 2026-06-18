import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const WORK_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

export default function HomeScreen() {
  const [seconds, setSeconds] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [isWorkMode, setIsWorkMode] = useState(true);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [currentProject, setCurrentProject] = useState('DevWearAssistant');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const theme = useTheme();

  // Cargar estadísticas al inicio
  useEffect(() => {
    const loadStats = async () => {
      const saved = await AsyncStorage.getItem('pomodoro_sessions');
      if (saved) setSessionsCount(JSON.parse(saved).length);
      const lastProject = await AsyncStorage.getItem('last_project');
      if (lastProject) setCurrentProject(lastProject);
    };
    loadStats();
  }, []);

  // Lógica del cronómetro
  useEffect(() => {
    if (isActive && seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    } else if (seconds === 0) {
      handleCycleComplete();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, seconds]);

  const handleCycleComplete = async () => {
    Vibration.vibrate([500, 500, 500]);
    
    const nextMode = !isWorkMode;
    setIsWorkMode(nextMode);
    setSeconds(nextMode ? WORK_TIME : BREAK_TIME);
    setIsActive(false);

    if (isWorkMode) {
      const session = { 
        id: Date.now(), 
        date: new Date().toISOString(), 
        duration: WORK_TIME / 60,
        projectName: currentProject 
      };
      const existing = await AsyncStorage.getItem('pomodoro_sessions');
      const history = existing ? JSON.parse(existing) : [];
      const newHistory = [session, ...history];
      await AsyncStorage.setItem('pomodoro_sessions', JSON.stringify(newHistory));
      setSessionsCount(newHistory.length);
      Alert.alert("¡Buen trabajo!", `Ciclo Pomodoro completado para "${currentProject}". Tómate un respiro.`);
    } else {
      Alert.alert("¡Descanso terminado!", "¿Listo para otra sesión de código?");
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setSeconds(isWorkMode ? WORK_TIME : BREAK_TIME);
  };

  const handleProjectChange = async (text: string) => {
    setCurrentProject(text);
    await AsyncStorage.setItem('last_project', text);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {isWorkMode ? 'TIEMPO DE CÓDIGO' : 'DESCANSO PRODUCTIVO'}
          </ThemedText>
          
          <ThemedText style={styles.timerText}>
            {formatTime(seconds)} 
          </ThemedText>

          <ThemedView style={styles.controls}>
            <TouchableOpacity onPress={toggleTimer} style={styles.mainButton}>
              <SymbolView 
                name={isActive ? "pause.fill" : "play.fill"} 
                size={32}
                tintColor="#FFFFFF"
                style={!isActive ? { marginLeft: 4 } : undefined}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={resetTimer}>
              <SymbolView name="arrow.clockwise" size={24} tintColor="#60646C" />
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.statsCard}>
          <ThemedText type="small">Proyecto actual:</ThemedText>
          <TextInput
            style={[styles.projectInput, { color: theme.text, borderColor: theme.textSecondary }]}
            onChangeText={handleProjectChange}
            value={currentProject}
            placeholder="Nombre del proyecto"
            placeholderTextColor={theme.textSecondary}
          />
          <ThemedText type="small">Ciclos Pomodoro completados: {sessionsCount}</ThemedText>
          <TouchableOpacity onPress={() => router.push('/history')}>
            <ThemedText type="link">Ver historial completo →</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  timerText: {
    fontSize: 90,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    marginVertical: Spacing.four,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    marginTop: Spacing.three,
  },
  mainButton: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 38,
    backgroundColor: '#208AEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignSelf: 'stretch',
    marginBottom: BottomTabInset,
    alignItems: 'center',
  },
  projectInput: {
    borderBottomWidth: 1,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    textAlign: 'center',
    fontSize: 16,
    width: '80%',
  },
});
