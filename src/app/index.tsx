import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const WORK_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

export default function HomeScreen() {
  const [seconds, setSeconds] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [isWorkMode, setIsWorkMode] = useState(true);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [currentProject, setCurrentProject] = useState('DevWearAssistant');
  const [sessionTracking, setSessionTracking] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    const loadStats = async () => {
      try {
        let saved = await AsyncStorage.getItem('pomodoro_sessions');
        
        // Fallback to localStorage for web
        if (!saved && typeof window !== 'undefined') {
          saved = localStorage.getItem('pomodoro_sessions');
        }
        
        if (saved) setSessionsCount(JSON.parse(saved).length);
        
        let lastProject = await AsyncStorage.getItem('last_project');
        if (!lastProject && typeof window !== 'undefined') {
          lastProject = localStorage.getItem('last_project');
        }
        if (lastProject) setCurrentProject(lastProject);
        
        let activeSession = await AsyncStorage.getItem('active_session');
        if (!activeSession && typeof window !== 'undefined') {
          activeSession = localStorage.getItem('active_session');
        }
        if (activeSession) {
          const { startTime, projectName } = JSON.parse(activeSession);
          setSessionStartTime(startTime);
          setCurrentProject(projectName);
          setSessionTracking(true);
          setElapsedMinutes(Math.floor((Date.now() - startTime) / 60000));
        }
      } catch (e) { console.error(e); }
    };
    loadStats();
  }, []);

  useEffect(() => {
    if (isActive && seconds > 0) {
      timerRef.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    } else if (seconds === 0) {
      handleCycleComplete();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, seconds]);

  useEffect(() => {
    if (sessionTracking && sessionStartTime) {
      sessionIntervalRef.current = setInterval(() => {
        setElapsedMinutes(Math.floor((Date.now() - sessionStartTime) / 60000));
      }, 30000);
    }
    return () => { if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current); };
  }, [sessionTracking, sessionStartTime]);

  const handleCycleComplete = async () => {
    Vibration.vibrate([500, 500, 500]);
    const nextMode = !isWorkMode;
    setIsWorkMode(nextMode);
    setSeconds(nextMode ? WORK_TIME : BREAK_TIME);
    setIsActive(false);
    if (isWorkMode) {
      const session = { id: Date.now(), date: new Date().toISOString(), duration: WORK_TIME / 60, projectName: currentProject };
      try {
        const existing = await AsyncStorage.getItem('pomodoro_sessions');
        const history = existing ? JSON.parse(existing) : [];
        const newHistory = [session, ...history];
        await AsyncStorage.setItem('pomodoro_sessions', JSON.stringify(newHistory));
        
        // Fallback to localStorage for web
        if (typeof window !== 'undefined') {
          localStorage.setItem('pomodoro_sessions', JSON.stringify(newHistory));
        }
        
        setSessionsCount(newHistory.length);
        console.log('Session saved:', session);
        console.log('Total sessions:', newHistory.length);
      } catch (e) { console.error('Error saving session:', e); }
      Alert.alert('✓ Ciclo completado', `25 min en "${currentProject}". Descansa.`);
    } else {
      Alert.alert('· Descanso terminado', '¿Listo para seguir?');
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => { setIsActive(false); setSeconds(isWorkMode ? WORK_TIME : BREAK_TIME); };

  const handleProjectChange = async (text: string) => {
    setCurrentProject(text);
    try { 
      await AsyncStorage.setItem('last_project', text);
      if (typeof window !== 'undefined') {
        localStorage.setItem('last_project', text);
      }
    } catch (e) { console.error(e); }
  };

  const startCodingSession = async () => {
    if (!currentProject.trim()) {
      Alert.alert('Proyecto requerido', 'Ingresa el nombre del proyecto.');
      return;
    }
    const startTime = Date.now();
    setSessionStartTime(startTime);
    setSessionTracking(true);
    setElapsedMinutes(0);
    try { 
      await AsyncStorage.setItem('active_session', JSON.stringify({ startTime, projectName: currentProject }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_session', JSON.stringify({ startTime, projectName: currentProject }));
      }
    }
    catch (e) { console.error(e); }
  };

  const stopCodingSession = async () => {
    if (!sessionStartTime) return;
    const durationMinutes = Math.max(1, Math.floor((Date.now() - sessionStartTime) / 60000));
    const session = { id: Date.now(), date: new Date().toISOString(), duration: durationMinutes, projectName: currentProject };
    try {
      const existing = await AsyncStorage.getItem('pomodoro_sessions');
      const history = existing ? JSON.parse(existing) : [];
      const newHistory = [session, ...history];
      await AsyncStorage.setItem('pomodoro_sessions', JSON.stringify(newHistory));
      
      // Fallback to localStorage for web
      if (typeof window !== 'undefined') {
        localStorage.setItem('pomodoro_sessions', JSON.stringify(newHistory));
      }
      
      setSessionsCount(history.length + 1);
      await AsyncStorage.removeItem('active_session');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('active_session');
      }
    } catch (e) { console.error(e); }
    setSessionTracking(false);
    setSessionStartTime(null);
    setElapsedMinutes(0);
    Alert.alert('✓ Sesión guardada', `${durationMinutes} min en "${currentProject}".`);
  };

  const monoFamily = Platform.select({ ios: 'ui-monospace', default: 'monospace', web: 'var(--font-mono)' });
  const ringColor = isWorkMode ? theme.accent : theme.warning;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="label" themeColor="textSecondary">DEVWEAR</ThemedText>
          <ThemedText type="label" style={{ color: theme.accent }}>
            {isWorkMode ? '// work' : '// break'}
          </ThemedText>
        </View>

        <View style={styles.timerSection}>
          <View style={[styles.ringOuter, { borderColor: theme.backgroundElement }]}>
            <View style={[styles.ringInner, {
              borderColor: ringColor,
              opacity: isActive ? 1 : 0.45,
              shadowColor: ringColor,
              shadowOpacity: isActive ? 0.6 : 0,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 0 },
              elevation: isActive ? 8 : 0,
            }]}>
              <ThemedText style={[styles.timerText, { color: theme.text, fontFamily: monoFamily }]}>
                {formatTime(seconds)}
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                {isWorkMode ? 'POMODORO' : 'DESCANSO'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={resetTimer} style={styles.controlBtn}>
              <SymbolView name="arrow.clockwise" size={20} tintColor={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleTimer}
              style={[styles.playBtn, { backgroundColor: ringColor, shadowColor: ringColor }]}
            >
              <SymbolView
                name={isActive ? 'pause.fill' : 'play.fill'}
                size={28}
                tintColor="#0D1117"
                style={!isActive ? { marginLeft: 3 } : undefined}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/history')} style={styles.controlBtn}>
              <SymbolView name="chart.bar.fill" size={20} tintColor={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.cardRow}>
            <ThemedText type="label" themeColor="textSecondary">PROYECTO</ThemedText>
            <TextInput
              style={[styles.projectInput, { color: theme.accent, fontFamily: monoFamily }]}
              onChangeText={handleProjectChange}
              value={currentProject}
              placeholder="nombre-del-proyecto"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText style={[styles.statNumber, { color: theme.accent, fontFamily: monoFamily }]}>
                {sessionsCount}
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">CICLOS</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.backgroundSelected }]} />
            <View style={styles.statItem}>
              <ThemedText style={[styles.statNumber, { color: sessionTracking ? theme.danger : theme.textSecondary, fontFamily: monoFamily }]}>
                {sessionTracking ? `${elapsedMinutes}m` : '--'}
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">SESIÓN</ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

          {!sessionTracking ? (
            <TouchableOpacity onPress={startCodingSession} style={[styles.actionBtn, { borderColor: theme.accent }]}>
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <ThemedText type="smallBold" style={{ color: theme.accent }}>Iniciar sesión de código</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={stopCodingSession} style={[styles.actionBtn, { borderColor: theme.danger }]}>
              <View style={[styles.dot, { backgroundColor: theme.danger }]} />
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                Detener · {elapsedMinutes} min registrados
              </ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Spacing.three, paddingBottom: Spacing.two,
  },
  timerSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.five },
  ringOuter: { width: 220, height: 220, borderRadius: 110, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  ringInner: { width: 196, height: 196, borderRadius: 98, borderWidth: 3, justifyContent: 'center', alignItems: 'center', gap: Spacing.one },
  timerText: { fontSize: 52, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.five },
  playBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  controlBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: Radius.lg, marginBottom: BottomTabInset + Spacing.three, overflow: 'hidden' },
  cardRow: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.one },
  projectInput: { fontSize: 16, fontWeight: '600', letterSpacing: 0.3, paddingVertical: Spacing.one },
  divider: { height: 1, marginHorizontal: Spacing.four },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  statItem: { flex: 1, alignItems: 'center', gap: Spacing.one },
  statDivider: { width: 1, marginVertical: Spacing.one },
  statNumber: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, margin: Spacing.four, padding: Spacing.three, borderRadius: Radius.sm, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});