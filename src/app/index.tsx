// Importaciones necesarias para la pantalla principal
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Platform, StyleSheet, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Constantes de tiempo para el temporizador Pomodoro
const WORK_TIME = 25 * 60; // 25 minutos en segundos
const BREAK_TIME = 5 * 60; // 5 minutos en segundos

// Detección del tamaño de pantalla para diseño responsivo
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768; // Consideramos tablet si el ancho es >= 768px

export default function HomeScreen() {
  // Estados del temporizador Pomodoro
  const [seconds, setSeconds] = useState(WORK_TIME); // Segundos restantes
  const [isActive, setIsActive] = useState(false); // Si el temporizador está activo
  const [isWorkMode, setIsWorkMode] = useState(true); // Modo trabajo o descanso
  
  // Estados de sesiones
  const [sessionsCount, setSessionsCount] = useState(0); // Contador de ciclos completados
  const [currentProject, setCurrentProject] = useState('DevWearAssistant'); // Proyecto actual
  const [sessionTracking, setSessionTracking] = useState(false); // Si está registrando sesión de código
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null); // Tiempo de inicio de sesión
  const [elapsedMinutes, setElapsedMinutes] = useState(0); // Minutos transcurridos en sesión
  
  // Referencias para intervalos de tiempo
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null); // Referencia al temporizador
  const sessionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // Referencia al contador de sesión
  
  const router = useRouter(); // Hook para navegación entre pantallas
  const theme = useTheme(); // Hook para acceder al tema de la aplicación

  // Cargar estadísticas guardadas al iniciar la aplicación
  useEffect(() => {
    const loadStats = async () => {
      try {
        // Cargar historial de sesiones Pomodoro
        let saved = await AsyncStorage.getItem('pomodoro_sessions');
        
        // Fallback a localStorage para web si AsyncStorage está vacío
        if (!saved && typeof window !== 'undefined') {
          saved = localStorage.getItem('pomodoro_sessions');
        }
        
        if (saved) setSessionsCount(JSON.parse(saved).length);
        
        // Cargar último proyecto usado
        let lastProject = await AsyncStorage.getItem('last_project');
        if (!lastProject && typeof window !== 'undefined') {
          lastProject = localStorage.getItem('last_project');
        }
        if (lastProject) setCurrentProject(lastProject);
        
        // Restaurar sesión activa si existe (para recuperación de estado)
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
      } catch (e) { console.error('Error cargando estadísticas:', e); }
    };
    loadStats();
  }, []);

  // Manejar la finalización de un ciclo Pomodoro
  const handleCycleComplete = useCallback(async () => {
    // Vibrar para notificar al usuario
    Vibration.vibrate([500, 500, 500]);
    
    // Cambiar entre modo trabajo y descanso
    const nextMode = !isWorkMode;
    setIsWorkMode(nextMode);
    setSeconds(nextMode ? WORK_TIME : BREAK_TIME);
    setIsActive(false);
    
    // Si terminamos un ciclo de trabajo, guardar la sesión
    if (isWorkMode) {
      const session = { 
        id: Date.now(), 
        date: new Date().toISOString(), 
        duration: WORK_TIME / 60, // Duración en minutos
        projectName: currentProject 
      };
      
      try {
        // Guardar sesión en AsyncStorage
        const existing = await AsyncStorage.getItem('pomodoro_sessions');
        const history = existing ? JSON.parse(existing) : [];
        const newHistory = [session, ...history];
        await AsyncStorage.setItem('pomodoro_sessions', JSON.stringify(newHistory));
        
        // Fallback a localStorage para web
        if (typeof window !== 'undefined') {
          localStorage.setItem('pomodoro_sessions', JSON.stringify(newHistory));
        }
        
        setSessionsCount(newHistory.length);
      } catch (e) { 
        console.error('Error guardando sesión:', e); 
      }
      
      Alert.alert('✓ Ciclo completado', `25 min en "${currentProject}". Descansa.`);
    } else {
      Alert.alert('· Descanso terminado', '¿Listo para seguir?');
    }
  }, [isWorkMode, currentProject]);

  // Efecto para manejar el temporizador del Pomodoro
  useEffect(() => {
    if (isActive && seconds > 0) {
      // Iniciar intervalo que decrementa los segundos cada 1 segundo
      timerRef.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    } else if (seconds === 0) {
      // Cuando el temporizador llega a 0, completar el ciclo
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleCycleComplete();
    }
    // Limpiar intervalo al desmontar o cambiar dependencias
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, seconds, handleCycleComplete]);

  // Efecto para actualizar el tiempo transcurrido de la sesión de código cada 30 segundos
  useEffect(() => {
    if (sessionTracking && sessionStartTime) {
      sessionIntervalRef.current = setInterval(() => {
        setElapsedMinutes(Math.floor((Date.now() - sessionStartTime) / 60000));
      }, 30000); // Actualizar cada 30 segundos
    }
    // Limpiar intervalo al desmontar
    return () => { if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current); };
  }, [sessionTracking, sessionStartTime]);

  // Formatear segundos a formato MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Iniciar/pausar el temporizador
  const toggleTimer = () => setIsActive(!isActive);
  
  // Reiniciar el temporizador al tiempo inicial
  const resetTimer = () => { 
    setIsActive(false); 
    setSeconds(isWorkMode ? WORK_TIME : BREAK_TIME); 
  };

  // Guardar el nombre del proyecto actual
  const handleProjectChange = async (text: string) => {
    setCurrentProject(text);
    try { 
      await AsyncStorage.setItem('last_project', text);
      // Fallback a localStorage para web
      if (typeof window !== 'undefined') {
        localStorage.setItem('last_project', text);
      }
    } catch (e) { console.error('Error guardando proyecto:', e); }
  };

  // Iniciar una nueva sesión de registro de código
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
      // Guardar sesión activa para poder recuperarla si la app se cierra
      await AsyncStorage.setItem('active_session', JSON.stringify({ startTime, projectName: currentProject }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_session', JSON.stringify({ startTime, projectName: currentProject }));
      }
    } catch (e) { 
      console.error('Error iniciando sesión:', e); 
    }
  };

  // Detener la sesión de código y guardar el tiempo transcurrido
  const stopCodingSession = async () => {
    if (!sessionStartTime) return;
    
    // Calcular duración en minutos (mínimo 1 minuto)
    const durationMinutes = Math.max(1, Math.floor((Date.now() - sessionStartTime) / 60000));
    const session = { 
      id: Date.now(), 
      date: new Date().toISOString(), 
      duration: durationMinutes, 
      projectName: currentProject 
    };
    
    try {
      // Guardar sesión en el historial
      const existing = await AsyncStorage.getItem('pomodoro_sessions');
      const history = existing ? JSON.parse(existing) : [];
      const newHistory = [session, ...history];
      await AsyncStorage.setItem('pomodoro_sessions', JSON.stringify(newHistory));
      
      // Fallback a localStorage para web
      if (typeof window !== 'undefined') {
        localStorage.setItem('pomodoro_sessions', JSON.stringify(newHistory));
      }
      
      setSessionsCount(history.length + 1);
      
      // Limpiar sesión activa
      await AsyncStorage.removeItem('active_session');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('active_session');
      }
    } catch (e) { 
      console.error('Error guardando sesión de código:', e); 
    }
    
    // Reiniciar estados
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
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <ThemedText type="label" themeColor="textSecondary">DEVWEAR</ThemedText>
          <ThemedText type="label" style={{ color: theme.accent }}>
            {isWorkMode ? '// work' : '// break'}
          </ThemedText>
        </View>

        <View style={[styles.timerSection, isTablet && styles.timerSectionTablet]}>
          <View style={[styles.ringOuter, isTablet && styles.ringOuterTablet, { borderColor: theme.backgroundElement }]}>
            <View style={[styles.ringInner, isTablet && styles.ringInnerTablet, {
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
  safeArea: { flex: 1, paddingHorizontal: isTablet ? Spacing.six : Spacing.four, maxWidth: isTablet ? 900 : MaxContentWidth },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Spacing.three, paddingBottom: Spacing.two,
  },
  headerTablet: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  timerSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.five },
  timerSectionTablet: { gap: Spacing.six },
  ringOuter: { width: 220, height: 220, borderRadius: 110, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  ringOuterTablet: { width: 280, height: 280, borderRadius: 140 },
  ringInner: { width: 196, height: 196, borderRadius: 98, borderWidth: 3, justifyContent: 'center', alignItems: 'center', gap: Spacing.one },
  ringInnerTablet: { width: 256, height: 256, borderRadius: 128 },
  timerText: { fontSize: isTablet ? 64 : 52, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: isTablet ? Spacing.six : Spacing.five },
  playBtn: { width: isTablet ? 88 : 72, height: isTablet ? 88 : 72, borderRadius: isTablet ? 44 : 36, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  controlBtn: { width: isTablet ? 52 : 44, height: isTablet ? 52 : 44, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: Radius.lg, marginBottom: BottomTabInset + Spacing.three, overflow: 'hidden' },
  cardRow: { paddingHorizontal: isTablet ? Spacing.six : Spacing.four, paddingTop: isTablet ? Spacing.four : Spacing.three, paddingBottom: isTablet ? Spacing.three : Spacing.two, gap: Spacing.one },
  projectInput: { fontSize: isTablet ? 18 : 16, fontWeight: '600', letterSpacing: 0.3, paddingVertical: Spacing.one },
  divider: { height: 1, marginHorizontal: isTablet ? Spacing.six : Spacing.four },
  statsRow: { flexDirection: 'row', paddingHorizontal: isTablet ? Spacing.six : Spacing.four, paddingVertical: isTablet ? Spacing.four : Spacing.three },
  statItem: { flex: 1, alignItems: 'center', gap: Spacing.one },
  statDivider: { width: 1, marginVertical: Spacing.one },
  statNumber: { fontSize: isTablet ? 32 : 28, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: isTablet ? Spacing.three : Spacing.two, margin: isTablet ? Spacing.five : Spacing.four, padding: isTablet ? Spacing.four : Spacing.three, borderRadius: Radius.sm, borderWidth: 1 },
  dot: { width: isTablet ? 10 : 8, height: isTablet ? 10 : 8, borderRadius: isTablet ? 5 : 4 },
});
