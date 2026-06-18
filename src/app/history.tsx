import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

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

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const theme = useTheme();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('pomodoro_sessions');
      if (saved) {
        const parsedSessions: PomodoroSession[] = JSON.parse(saved);
        const sortedSessions = parsedSessions.sort((a, b) => b.id - a.id);
        setSessions(sortedSessions);
        computeWeeklyData(sortedSessions);
      }
    } catch (e) {
      console.error("Error loading history", e);
    }
  };

  const computeWeeklyData = (allSessions: PomodoroSession[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weeklyDataMap = new Map<string, { totalDuration: number; pomodoroCount: number }>();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      weeklyDataMap.set(date.toISOString().split('T')[0], { totalDuration: 0, pomodoroCount: 0 });
    }

    allSessions.forEach(session => {
      const sessionDate = new Date(session.date);
      sessionDate.setHours(0, 0, 0, 0);
      const dateKey = sessionDate.toISOString().split('T')[0];

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

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${remainingMinutes}min`;
  };

  const renderBarChart = () => {
    if (weeklyStats.length === 0 || Math.max(...weeklyStats.map(s => s.totalDuration)) === 0) {
      return <ThemedText style={styles.noDataText}>No hay datos semanales para mostrar.</ThemedText>;
    }

    const maxDuration = Math.max(...weeklyStats.map(s => s.totalDuration));
    const chartHeight = 150;
    const barWidth = 30;
    const gap = 10;
    const totalWidth = weeklyStats.length * (barWidth + gap);

    return (
      <Svg height={chartHeight + 30} width={totalWidth}>
        {weeklyStats.map((stat, index) => {
          const barHeight = (stat.totalDuration / maxDuration) * chartHeight;
          const x = index * (barWidth + gap);
          const y = chartHeight - barHeight;

          return (
            <View key={stat.date}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={theme.textSecondary}
              />
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight + 15}
                fill={theme.text}
                fontSize="10"
                textAnchor="middle"
              >
                {new Date(stat.date).toLocaleDateString('es-ES', { weekday: 'short' })}
              </SvgText>
              {stat.totalDuration > 0 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 5}
                  fill={theme.text}
                  fontSize="8"
                  textAnchor="middle"
                >
                  {stat.totalDuration}m
                </SvgText>
              )}
            </View>
          );
        })}
      </Svg>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>Historial y Estadísticas</ThemedText>

        <ThemedView type="backgroundElement" style={styles.statsSection}>
          <ThemedText type="smallBold">Estadísticas Semanales</ThemedText>
          <View style={styles.chartContainer}>
            {renderBarChart()}
          </View>
        </ThemedView>

        <ThemedText type="smallBold" style={styles.historyTitle}>Sesiones Recientes</ThemedText>
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.sessionItem}>
              <ThemedText type="smallBold">{item.projectName}</ThemedText>
              <ThemedText type="small">
                {new Date(item.date).toLocaleDateString()} - {formatDuration(item.duration)}
              </ThemedText>
            </ThemedView>
          )}
          ListEmptyComponent={<ThemedText style={styles.noDataText}>No hay sesiones registradas.</ThemedText>}
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
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  statsSection: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  chartContainer: {
    marginTop: Spacing.two,
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
});