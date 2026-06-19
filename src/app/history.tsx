import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface PomodoroSession {
  id: number;
  date: string;
  duration: number;
  projectName: string;
}

interface WeeklyStats {
  date: string;
  totalDuration: number;
  pomodoroCount: number;
}

const ARCHIVE_THRESHOLD = 500;

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [topProject, setTopProject] = useState<string>('—');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const theme = useTheme();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      let saved = await AsyncStorage.getItem('pomodoro_sessions');
      
      // Fallback to localStorage for web if AsyncStorage is empty
      if (!saved && typeof window !== 'undefined') {
        const localStorageData = localStorage.getItem('pomodoro_sessions');
        if (localStorageData) {
          saved = localStorageData;
          // Sync to AsyncStorage
          await AsyncStorage.setItem('pomodoro_sessions', localStorageData);
        }
      }
      
      console.log('Raw data from storage:', saved);
      if (saved) {
        const parsedSessions: PomodoroSession[] = JSON.parse(saved);
        console.log('Parsed sessions:', parsedSessions);
        if (parsedSessions.length > ARCHIVE_THRESHOLD) {
          console.warn('Historial supera 500 entradas. Considera archivar datos antiguos.');
        }
        const sorted = [...parsedSessions].sort((a, b) => b.id - a.id);
        setSessions(sorted);
        computeWeeklyData(sorted);
        computeTopProject(sorted);
      } else {
        console.log('No sessions found in storage');
      }
    } catch (e) {
      console.error('Error loading history', e);
    }
  };

  const computeWeeklyData = (allSessions: PomodoroSession[]) => {
    const weeklyDataMap = new Map<string, { totalDuration: number; pomodoroCount: number }>();

    // Get Monday of the current week
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);

    // Initialize with all 7 days of the current week (Monday to Sunday)
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      weeklyDataMap.set(dateKey, { totalDuration: 0, pomodoroCount: 0 });
    }

    // Aggregate data for each date
    allSessions.forEach((session) => {
      const dateKey = new Date(session.date).toISOString().split('T')[0];
      if (weeklyDataMap.has(dateKey)) {
        const current = weeklyDataMap.get(dateKey)!;
        current.totalDuration += session.duration;
        current.pomodoroCount += 1;
        weeklyDataMap.set(dateKey, current);
      }
    });

    const statsArray: WeeklyStats[] = Array.from(weeklyDataMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setWeeklyStats(statsArray);
  };

  // getTopProject: returns project with most accumulated hours
  const computeTopProject = (allSessions: PomodoroSession[]) => {
    const projectMap = new Map<string, number>();
    allSessions.forEach((s) => {
      projectMap.set(s.projectName, (projectMap.get(s.projectName) ?? 0) + s.duration);
    });
    if (projectMap.size === 0) return;
    const top = [...projectMap.entries()].sort((a, b) => b[1] - a[1])[0];
    setTopProject(top[0]);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${remainingMinutes}min`;
  };

  // filterByDate: toggle filter for a specific day
  const handleBarPress = (date: string) => {
    setFilterDate((prev) => (prev === date ? null : date));
    setPage(1);
  };

  const filteredSessions = filterDate
    ? sessions.filter((s) => new Date(s.date).toISOString().split('T')[0] === filterDate)
    : sessions;

  const paginatedSessions = filteredSessions.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedSessions.length < filteredSessions.length;

  const renderBarChart = () => {
    const maxDuration = Math.max(...weeklyStats.map((s) => s.totalDuration), 1);
    const chartHeight = 120;
    const barWidth = 28;
    const gap = 12;
    const totalWidth = weeklyStats.length * (barWidth + gap);

    console.log('Chart data:', { weeklyStats, maxDuration });

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
        <View style={{ height: chartHeight + 30, width: totalWidth, flexDirection: 'row', alignItems: 'flex-end' }}>
          {weeklyStats.map((stat, index) => {
            const barHeight = Math.max(8, (stat.totalDuration / maxDuration) * chartHeight);
            const x = index * (barWidth + gap);
            const isSelected = filterDate === stat.date;

            console.log(`Bar ${index}:`, { date: stat.date, totalDuration: stat.totalDuration, barHeight });

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
        <ThemedText type="subtitle" style={styles.title}>
          Historial y Estadísticas
        </ThemedText>

        {/* Stats Chart */}
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

        {filterDate && (
          <TouchableOpacity onPress={() => setFilterDate(null)} style={styles.filterBadge}>
            <ThemedText type="small" style={{ color: '#208AEF' }}>
              Filtrando: {new Date(filterDate).toLocaleDateString('es-ES')} ✕
            </ThemedText>
          </TouchableOpacity>
        )}

        <ThemedText type="smallBold" style={styles.historyTitle}>
          Sesiones Recientes
        </ThemedText>

        <FlatList
          data={paginatedSessions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.sessionItem}>
              <ThemedText type="smallBold">{item.projectName}</ThemedText>
              <ThemedText type="small">
                {new Date(item.date).toLocaleDateString('es-ES')} · {formatDuration(item.duration)}
              </ThemedText>
            </ThemedView>
          )}
          ListEmptyComponent={
            <ThemedText style={styles.noDataText}>No hay sesiones registradas.</ThemedText>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity onPress={() => setPage((p) => p + 1)} style={styles.loadMore}>
                <ThemedText type="link">Cargar más</ThemedText>
              </TouchableOpacity>
            ) : null
          }
          style={styles.flatList}
          contentContainerStyle={{ paddingBottom: BottomTabInset }}
        />
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
    paddingTop: Spacing.three,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.three,
    marginTop: Spacing.two,
  },
  statsSection: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  chartContainer: {
    marginTop: Spacing.two,
    alignItems: 'center',
  },
  historyTitle: {
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  flatList: {
    flex: 1,
  },
  sessionItem: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noDataText: {
    textAlign: 'center',
    marginTop: Spacing.four,
    opacity: 0.6,
  },
  filterBadge: {
    alignSelf: 'center',
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#208AEF',
  },
  loadMore: {
    alignItems: 'center',
    padding: Spacing.three,
  },
});
