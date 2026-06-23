import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, FlatList, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Interfaz para sesiones de Pomodoro
interface PomodoroSession {
  id: number; // Identificador único de la sesión
  date: string; // Fecha y hora de la sesión en formato ISO
  duration: number; // Duración en minutos
  projectName: string; // Nombre del proyecto en el que se trabajó
}

// Interfaz para tareas/notas
interface Task {
  id: string; // Identificador único de la tarea
  text: string; // Contenido de la tarea
  completed: boolean; // Si está completada o pendiente
  tag?: string; // Etiqueta opcional para categorizar
  createdAt: string; // Fecha de creación en formato ISO
}

// Interfaz para estadísticas semanales
interface WeeklyStats {
  date: string; // Fecha en formato YYYY-MM-DD
  totalDuration: number; // Duración total en minutos
  pomodoroCount: number; // Cantidad de pomodoros
}

// Interfaz para actividades diarias de Pomodoro
interface DailyActivity {
  date: string; // Fecha en formato YYYY-MM-DD
  sessions: PomodoroSession[]; // Lista de sesiones de ese día
  totalDuration: number; // Duración total del día en minutos
  totalPomodoros: number; // Cantidad total de ciclos del día
}

// Interfaz para actividades diarias de tareas
interface TaskActivity {
  date: string; // Fecha en formato YYYY-MM-DD
  tasks: Task[]; // Lista de tareas de ese día
  completedCount: number; // Cantidad de tareas completadas
  pendingCount: number; // Cantidad de tareas pendientes
}

// Umbral para advertencia de historial muy grande
const ARCHIVE_THRESHOLD = 500;

// Detección del tamaño de pantalla para diseño responsivo
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768; // Consideramos tablet si el ancho es >= 768px
const isDesktop = SCREEN_WIDTH >= 1024; // Consideramos desktop si el ancho es >= 1024px

export default function HistoryScreen() {
  // Estados de la pantalla de historial
  const [sessions, setSessions] = useState<PomodoroSession[]>([]); // Todas las sesiones de Pomodoro
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]); // Estadísticas de la semana actual
  const [dailyActivities, setDailyActivities] = useState<DailyActivity[]>([]); // Actividades agrupadas por día
  const [taskActivities, setTaskActivities] = useState<TaskActivity[]>([]); // Tareas agrupadas por día
  const [filterDate, setFilterDate] = useState<string | null>(null); // Fecha seleccionada para filtrar
  const [topProject, setTopProject] = useState<string>('—'); // Proyecto con más horas
  const [page, setPage] = useState(1); // Página actual para paginación
  const PAGE_SIZE = isTablet ? 20 : 10; // Más items por página en tablets
  const theme = useTheme(); // Tema actual de la aplicación

  // Agrupar tareas por día y calcular estadísticas
  const computeTaskActivities = useCallback((allTasks: Task[]) => {
    const taskMap = new Map<string, Task[]>();
    
    allTasks.forEach((task) => {
      try {
        // Validar que la fecha sea válida antes de procesarla
        const date = new Date(task.createdAt);
        if (isNaN(date.getTime())) return;
        
        // Obtener clave de fecha en formato YYYY-MM-DD
        const dateKey = date.toISOString().split('T')[0];
        if (!taskMap.has(dateKey)) {
          taskMap.set(dateKey, []);
        }
        taskMap.get(dateKey)!.push(task);
      } catch (e) {
        console.warn('Fecha de tarea inválida:', task.createdAt);
      }
    });

    // Convertir el mapa a array y calcular estadísticas
    const activities: TaskActivity[] = Array.from(taskMap.entries())
      .map(([date, tasks]) => ({
        date,
        tasks,
        completedCount: tasks.filter((t) => t.completed).length,
        pendingCount: tasks.filter((t) => !t.completed).length,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Ordenar por fecha descendente

    setTaskActivities(activities);
  }, []);

  // Cargar historial de tareas desde almacenamiento
  const loadTaskHistory = useCallback(async () => {
    try {
      let savedTasks = await AsyncStorage.getItem('tasks');
      
      // Fallback a localStorage para web
      if (!savedTasks && typeof window !== 'undefined') {
        const localStorageTasks = localStorage.getItem('tasks');
        if (localStorageTasks) {
          savedTasks = localStorageTasks;
          await AsyncStorage.setItem('tasks', localStorageTasks);
        }
      }
      
      if (savedTasks) {
        const parsedTasks: Task[] = JSON.parse(savedTasks);
        computeTaskActivities(parsedTasks);
      }
    } catch (e) {
      console.error('Error cargando historial de tareas:', e);
    }
  }, [computeTaskActivities]);

  // Calcular estadísticas semanales (últimos 7 días)
  const computeWeeklyData = useCallback((allSessions: PomodoroSession[]) => {
    const weeklyDataMap = new Map<string, { totalDuration: number; pomodoroCount: number }>();

    // Obtener el lunes de la semana actual
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);

    // Inicializar los 7 días de la semana con valores en 0
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      weeklyDataMap.set(dateKey, { totalDuration: 0, pomodoroCount: 0 });
    }

    // Agregar datos de sesiones a los días correspondientes
    allSessions.forEach((session) => {
      const dateKey = new Date(session.date).toISOString().split('T')[0];
      if (weeklyDataMap.has(dateKey)) {
        const current = weeklyDataMap.get(dateKey)!;
        current.totalDuration += session.duration;
        current.pomodoroCount += 1;
        weeklyDataMap.set(dateKey, current);
      }
    });

    // Convertir a array y ordenar por fecha
    const statsArray: WeeklyStats[] = Array.from(weeklyDataMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setWeeklyStats(statsArray);
  }, []);

  // Calcular el proyecto con más horas trabajadas
  const computeTopProject = useCallback((allSessions: PomodoroSession[]) => {
    const projectMap = new Map<string, number>();
    
    // Sumar duración por proyecto
    allSessions.forEach((s) => {
      projectMap.set(s.projectName, (projectMap.get(s.projectName) ?? 0) + s.duration);
    });
    
    if (projectMap.size === 0) return;
    
    // Ordenar por duración descendente y obtener el primero
    const top = [...projectMap.entries()].sort((a, b) => b[1] - a[1])[0];
    setTopProject(top[0]);
  }, []);

  // Agrupar sesiones de Pomodoro por día
  const computeDailyActivities = useCallback((allSessions: PomodoroSession[]) => {
    const dailyMap = new Map<string, PomodoroSession[]>();
    
    // Agrupar sesiones por fecha
    allSessions.forEach((session) => {
      const dateKey = new Date(session.date).toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, []);
      }
      dailyMap.get(dateKey)!.push(session);
    });

    // Convertir a array y calcular totales
    const activities: DailyActivity[] = Array.from(dailyMap.entries())
      .map(([date, sessions]) => ({
        date,
        sessions,
        totalDuration: sessions.reduce((sum, s) => sum + s.duration, 0),
        totalPomodoros: sessions.length,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Ordenar por fecha descendente

    setDailyActivities(activities);
  }, []);

  // Cargar todo el historial (sesiones y tareas)
  const loadHistory = useCallback(async () => {
    try {
      let saved = await AsyncStorage.getItem('pomodoro_sessions');
      
      // Fallback a localStorage para web
      if (!saved && typeof window !== 'undefined') {
        const localStorageData = localStorage.getItem('pomodoro_sessions');
        if (localStorageData) {
          saved = localStorageData;
          await AsyncStorage.setItem('pomodoro_sessions', localStorageData);
        }
      }
      
      if (saved) {
        const parsedSessions: PomodoroSession[] = JSON.parse(saved);
        
        // Advertir si el historial es muy grande
        if (parsedSessions.length > ARCHIVE_THRESHOLD) {
          console.warn('Historial supera 500 entradas. Considera archivar datos antiguos.');
        }
        
        // Ordenar por ID descendente (más reciente primero)
        const sorted = [...parsedSessions].sort((a, b) => b.id - a.id);
        setSessions(sorted);
        
        // Calcular todas las estadísticas
        computeWeeklyData(sorted);
        computeTopProject(sorted);
        computeDailyActivities(sorted);
      }

      // Cargar historial de tareas
      await loadTaskHistory();
    } catch (e) {
      console.error('Error cargando historial:', e);
    }
  }, [loadTaskHistory, computeWeeklyData, computeTopProject, computeDailyActivities]);

  // Cargar datos al iniciar la pantalla
  useEffect(() => {
    // Carga inicial de datos - caso de uso válido para setState en useEffect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, []);

  // Formatear duración en minutos a formato legible (ej: "2h 30min")
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${remainingMinutes}min`;
  };

  // Formatear fecha a formato legible (Hoy, Ayer, o fecha completa)
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate.getTime() === today.getTime()) return 'Hoy';
    if (targetDate.getTime() === yesterday.getTime()) return 'Ayer';
    
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Manejar presión en barra del gráfico (filtrar por fecha)
  const handleBarPress = (date: string) => {
    setFilterDate((prev) => (prev === date ? null : date));
    setPage(1); // Reiniciar paginación al filtrar
  };

  // Filtrar sesiones por fecha seleccionada
  const filteredSessions = filterDate
    ? sessions.filter((s) => new Date(s.date).toISOString().split('T')[0] === filterDate)
    : sessions;

  // Aplicar paginación
  const paginatedSessions = filteredSessions.slice(0, page * PAGE_SIZE);

  // Renderizar gráfico de barras de estadísticas semanales
  const renderBarChart = () => {
    const maxDuration = Math.max(...weeklyStats.map((s) => s.totalDuration), 1);
    const chartHeight = isTablet ? 160 : 120; // Altura del gráfico
    const barWidth = isTablet ? 36 : 28; // Ancho de barra
    const gap = isTablet ? 16 : 12; // Espacio entre barras
    const totalWidth = weeklyStats.length * (barWidth + gap);

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
        <View style={{ height: chartHeight + 30, width: totalWidth, flexDirection: 'row', alignItems: 'flex-end' }}>
          {weeklyStats.map((stat) => {
            const barHeight = Math.max(8, (stat.totalDuration / maxDuration) * chartHeight);
            const isSelected = filterDate === stat.date;

            return (
              <View key={stat.date} style={{ width: barWidth + gap, alignItems: 'center' }}>
                <TouchableOpacity
                  style={{
                    width: barWidth,
                    height: barHeight,
                    backgroundColor: isSelected ? '#208AEF' : (stat.totalDuration > 0 ? '#4A5568' : '#2D3748'),
                    borderRadius: 4,
                  }}
                  onPress={() => handleBarPress(stat.date)}
                  activeOpacity={0.7}
                />
                <ThemedText
                  style={{
                    fontSize: 9,
                    color: theme.text,
                    marginTop: 5,
                    textAlign: 'center',
                  }}
                >
                  {new Date(stat.date).toLocaleDateString('es-ES', { weekday: 'short' })}
                </ThemedText>
                {stat.totalDuration > 0 && (
                  <ThemedText
                    style={{
                      fontSize: 8,
                      color: theme.text,
                      marginTop: 2,
                      textAlign: 'center',
                    }}
                  >
                    {stat.totalDuration}m
                  </ThemedText>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Título de la pantalla */}
        <ThemedText type={isTablet ? 'title' : 'subtitle'} style={styles.title}>
          Historial y Estadísticas
        </ThemedText>

        {/* Sección de estadísticas semanales */}
        <ThemedView type="backgroundElement" style={styles.statsSection}>
          <ThemedText type="smallBold">Estadísticas</ThemedText>
          {weeklyStats.length > 0 ? (
            <>
              <TouchableOpacity onPress={() => {}} style={styles.chartContainer}>
                {renderBarChart()}
              </TouchableOpacity>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
                Toca una barra para filtrar · Proyecto top: {topProject}
              </ThemedText>
            </>
          ) : (
            <ThemedText style={styles.noDataText}>No hay datos semanales.</ThemedText>
          )}
        </ThemedView>

        {/* Badge de filtro activo */}
        {filterDate && (
          <TouchableOpacity onPress={() => setFilterDate(null)} style={styles.filterBadge}>
            <ThemedText type="small" style={{ color: '#208AEF' }}>
              Filtrando: {new Date(filterDate).toLocaleDateString('es-ES')} ✕
            </ThemedText>
          </TouchableOpacity>
        )}

        {/* Sección: Actividades por Día (Pomodoro) */}
        <ThemedText type="smallBold" style={styles.historyTitle}>
          Actividades por Día
        </ThemedText>

        {dailyActivities.length > 0 ? (
          <FlatList
            data={dailyActivities}
            keyExtractor={(item) => item.date}
            renderItem={({ item }) => (
              <ThemedView type="backgroundElement" style={styles.dayCard}>
                {/* Encabezado del día */}
                <View style={styles.dayHeader}>
                  <View style={styles.dayInfo}>
                    <ThemedText type="smallBold">{formatDate(item.date)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {new Date(item.date).toLocaleDateString('es-ES', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </ThemedText>
                  </View>
                  <View style={styles.dayStats}>
                    {/* Badge de ciclos */}
                    <View style={[styles.statBadge, { backgroundColor: theme.accent + '20' }]}>
                      <ThemedText type="small" style={{ color: theme.accent, fontWeight: '600' }}>
                        {item.totalPomodoros} {item.totalPomodoros === 1 ? 'ciclo' : 'ciclos'}
                      </ThemedText>
                    </View>
                    {/* Badge de duración */}
                    <View style={[styles.statBadge, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText type="small" style={{ color: theme.text, fontWeight: '600' }}>
                        {formatDuration(item.totalDuration)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
                
                {/* Lista de proyectos del día */}
                <View style={styles.projectsList}>
                  {item.sessions.map((session) => (
                    <View key={session.id} style={styles.projectItem}>
                      <View style={[styles.projectDot, { backgroundColor: theme.accent }]} />
                      <ThemedText type="small" style={{ flex: 1 }}>
                        {session.projectName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatDuration(session.duration)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </ThemedView>
            )}
            ListEmptyComponent={
              <ThemedText style={styles.noDataText}>No hay actividades registradas.</ThemedText>
            }
            style={styles.flatList}
            contentContainerStyle={{ paddingBottom: BottomTabInset }}
          />
        ) : (
          <ThemedText style={styles.noDataText}>No hay actividades registradas.</ThemedText>
        )}

        {/* Sección: Tareas y Notas por Día */}
        <ThemedText type="smallBold" style={styles.historyTitle}>
          Tareas y Notas por Día
        </ThemedText>

        {taskActivities.length > 0 ? (
          <FlatList
            data={taskActivities}
            keyExtractor={(item) => item.date + '-tasks'}
            renderItem={({ item }) => (
              <ThemedView type="backgroundElement" style={styles.dayCard}>
                {/* Encabezado del día */}
                <View style={styles.dayHeader}>
                  <View style={styles.dayInfo}>
                    <ThemedText type="smallBold">{formatDate(item.date)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {new Date(item.date).toLocaleDateString('es-ES', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </ThemedText>
                  </View>
                  <View style={styles.dayStats}>
                    {/* Badge de pendientes */}
                    {item.pendingCount > 0 && (
                      <View style={[styles.statBadge, { backgroundColor: theme.warning + '20' }]}>
                        <ThemedText type="small" style={{ color: theme.warning, fontWeight: '600' }}>
                          {item.pendingCount} pendiente{item.pendingCount !== 1 ? 's' : ''}
                        </ThemedText>
                      </View>
                    )}
                    {/* Badge de completadas */}
                    {item.completedCount > 0 && (
                      <View style={[styles.statBadge, { backgroundColor: theme.accent + '20' }]}>
                        <ThemedText type="small" style={{ color: theme.accent, fontWeight: '600' }}>
                          {item.completedCount} completada{item.completedCount !== 1 ? 's' : ''}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
                
                {/* Lista de tareas del día */}
                <View style={styles.projectsList}>
                  {item.tasks.map((task) => (
                    <View key={task.id} style={styles.projectItem}>
                      {/* Indicador visual de estado */}
                      <View style={[
                        styles.projectDot, 
                        { 
                          backgroundColor: task.completed ? theme.accent : theme.textSecondary,
                          opacity: task.completed ? 0.6 : 1
                        }
                      ]} />
                      {/* Texto de la tarea */}
                      <ThemedText 
                        type="small" 
                        style={{ 
                          flex: 1,
                          textDecorationLine: task.completed ? 'line-through' : 'none',
                          opacity: task.completed ? 0.6 : 1
                        }}
                      >
                        {task.text}
                      </ThemedText>
                      {/* Etiqueta de la tarea */}
                      {task.tag && (
                        <ThemedText type="label" style={{ color: theme.accent, marginLeft: Spacing.one }}>
                          #{task.tag}
                        </ThemedText>
                      )}
                    </View>
                  ))}
                </View>
              </ThemedView>
            )}
            ListEmptyComponent={
              <ThemedText style={styles.noDataText}>No hay tareas registradas.</ThemedText>
            }
            style={styles.flatList}
            contentContainerStyle={{ paddingBottom: BottomTabInset }}
          />
        ) : (
          <ThemedText style={styles.noDataText}>No hay tareas registradas.</ThemedText>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

// Estilos de la pantalla con diseño responsivo
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: isTablet ? Spacing.six : Spacing.four,
    maxWidth: isDesktop ? 1200 : MaxContentWidth,
    paddingTop: Spacing.three,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    textAlign: 'center',
    marginBottom: isTablet ? Spacing.four : Spacing.three,
    marginTop: isTablet ? Spacing.three : Spacing.two,
    fontSize: isTablet ? 28 : 24,
  },
  statsSection: {
    padding: isTablet ? Spacing.five : Spacing.four,
    borderRadius: isTablet ? Spacing.four : Spacing.three,
    alignItems: 'center',
    marginBottom: isTablet ? Spacing.four : Spacing.three,
  },
  chartContainer: {
    marginTop: isTablet ? Spacing.three : Spacing.two,
    alignItems: 'center',
  },
  historyTitle: {
    marginBottom: isTablet ? Spacing.three : Spacing.two,
    textAlign: 'center',
    fontSize: isTablet ? 18 : 16,
  },
  flatList: {
    flex: 1,
  },
  dayCard: {
    padding: isTablet ? Spacing.four : Spacing.three,
    borderRadius: isTablet ? Spacing.three : Spacing.two,
    marginBottom: isTablet ? Spacing.three : Spacing.two,
    borderWidth: 1,
    borderColor: 'transparent',
    ...(isTablet ? Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } }) : {}),
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTablet ? Spacing.three : Spacing.two,
  },
  dayInfo: {
    flex: 1,
  },
  dayStats: {
    flexDirection: 'row',
    gap: isTablet ? Spacing.two : Spacing.one,
  },
  statBadge: {
    paddingHorizontal: isTablet ? Spacing.three : Spacing.two,
    paddingVertical: isTablet ? Spacing.two : Spacing.one,
    borderRadius: Radius.sm,
  },
  projectsList: {
    marginTop: isTablet ? Spacing.two : Spacing.one,
    paddingTop: isTablet ? Spacing.three : Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTablet ? Spacing.three : Spacing.two,
    paddingVertical: isTablet ? Spacing.two : Spacing.one,
  },
  projectDot: {
    width: isTablet ? 8 : 6,
    height: isTablet ? 8 : 6,
    borderRadius: isTablet ? 4 : 3,
  },
  sessionItem: {
    padding: isTablet ? Spacing.four : Spacing.three,
    borderRadius: isTablet ? Spacing.three : Spacing.two,
    marginBottom: isTablet ? Spacing.three : Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noDataText: {
    textAlign: 'center',
    marginTop: isTablet ? Spacing.six : Spacing.four,
    opacity: 0.6,
    fontSize: isTablet ? 16 : 14,
  },
  filterBadge: {
    alignSelf: 'center',
    marginBottom: isTablet ? Spacing.three : Spacing.two,
    paddingHorizontal: isTablet ? Spacing.four : Spacing.three,
    paddingVertical: isTablet ? Spacing.two : Spacing.one,
    borderRadius: isTablet ? Spacing.three : Spacing.two,
    borderWidth: 1,
    borderColor: '#208AEF',
  },
  loadMore: {
    alignItems: 'center',
    padding: isTablet ? Spacing.four : Spacing.three,
  },
});