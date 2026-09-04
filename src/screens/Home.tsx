import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts, Theme } from '../theme';
import { Card } from '../components';
import { useApp, FREE_ENTRY_LIMIT } from '../state';
import { getEntries, getStats, Entry, Stats, fmtHours } from '../db';

export default function HomeScreen({
  onAddEntry,
  onOpenEntry,
}: {
  onAddEntry: () => void;
  onOpenEntry: (id: number) => void;
}) {
  const theme = useTheme();
  const { isPro, showPaywall, dataVersion, goal } = useApp();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    setEntries(await getEntries());
    setStats(await getStats());
  }, []);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const atFreeLimit = !isPro && (stats?.entryCount ?? 0) >= FREE_ENTRY_LIMIT;
  const nearFreeLimit =
    !isPro && !atFreeLimit && (stats?.entryCount ?? 0) >= FREE_ENTRY_LIMIT - 3;

  const handleAdd = () => {
    if (atFreeLimit) {
      showPaywall();
      return;
    }
    onAddEntry();
  };

  const totalGoalMin = goal.totalHours * 60;
  const totalMin = stats?.totalMin ?? 0;

  const subtitle = (e: Entry): string => {
    const parts: string[] = [fmtHours(e.durationMin)];
    if (e.organization) parts.push(e.organization);
    if (e.supervisor) parts.push(`with ${e.supervisor}`);
    return parts.join(' · ');
  };

  const renderItem = ({ item }: { item: Entry }) => (
    <Pressable onPress={() => onOpenEntry(item.id)}>
      <Card theme={theme} style={styles.itemCard}>
        <View style={styles.itemRow}>
          <View style={[styles.dateBadge, { backgroundColor: theme.cardAlt }]}>
            <Text style={[styles.dateBadgeDay, { color: theme.text }]}>
              {item.date.slice(8, 10)}
            </Text>
            <Text style={[styles.dateBadgeMon, { color: theme.textFaint }]}>
              {new Date(
                Number(item.date.slice(0, 4)),
                Number(item.date.slice(5, 7)) - 1,
                1
              )
                .toLocaleString('en-US', { month: 'short' })
                .toUpperCase()}
            </Text>
          </View>
          <View style={styles.itemBody}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {item.organization || `${fmtHours(item.durationMin)} of service`}
            </Text>
            <Text style={[styles.itemMeta, { color: theme.textFaint }]} numberOfLines={1}>
              {subtitle(item)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={entries}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <Text style={[styles.brand, { color: theme.accent }]}>Merit</Text>
            <Card theme={theme} style={styles.heroCard}>
              <Text style={[styles.heroValue, { color: theme.text }]}>
                {fmtHours(totalMin)}
              </Text>
              <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
                of {goal.totalHours}h · {goal.label}
              </Text>
              <ProgressBar
                theme={theme}
                value={totalMin}
                max={totalGoalMin}
                style={{ marginTop: 12 }}
              />
              <View style={styles.heroChips}>
                <Text style={[styles.heroChip, { color: theme.textFaint }]}>
                  {stats?.entryCount ?? 0} {(stats?.entryCount ?? 0) === 1 ? 'entry' : 'entries'}
                </Text>
                {(stats?.orgCount ?? 0) > 0 && (
                  <Text style={[styles.heroChip, { color: theme.textFaint }]}>
                    {stats?.orgCount} {(stats?.orgCount ?? 0) === 1 ? 'organization' : 'organizations'}
                  </Text>
                )}
                {totalMin >= totalGoalMin && totalGoalMin > 0 && (
                  <Text style={[styles.heroChip, { color: theme.success }]}>Goal reached 🎉</Text>
                )}
              </View>
            </Card>

            {(atFreeLimit || nearFreeLimit) && (
              <Pressable onPress={showPaywall}>
                <Card theme={theme} style={{ ...styles.limitCard, backgroundColor: theme.accentSoft }}>
                  <Text style={[styles.limitText, { color: theme.accent }]}>
                    {atFreeLimit
                      ? `Free plan is full (${FREE_ENTRY_LIMIT} entries). Go Pro for unlimited →`
                      : `${FREE_ENTRY_LIMIT - (stats?.entryCount ?? 0)} free entries left. Go Pro for unlimited →`}
                  </Text>
                </Card>
              </Pressable>
            )}
            <View style={{ height: 14 }} />
          </View>
        }
        ListEmptyComponent={
          <Card theme={theme} style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🤝</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Log your first hours</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Every shift counts toward your goal. Tap ＋ after you volunteer —
              date, hours, and where you served are all it takes.
            </Text>
          </Card>
        }
      />
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityLabel="Log volunteer hours"
      >
        <Text style={[styles.fabPlus, { color: theme.isDark ? '#121815' : '#FFFFFF' }]}>＋</Text>
      </Pressable>
    </View>
  );
}

function ProgressBar({
  theme,
  value,
  max,
  style,
}: {
  theme: Theme;
  value: number;
  max: number;
  style?: object;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View
      style={[
        styles.barTrack,
        { backgroundColor: theme.cardAlt },
        style,
      ]}
      accessibilityRole="progressbar"
    >
      <View
        style={[
          styles.barFill,
          {
            backgroundColor: pct >= 1 ? theme.success : theme.accent,
            width: `${Math.round(pct * 100)}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 120 },
  brand: { fontSize: 15, fontWeight: fonts.weight.bold, marginBottom: 8, letterSpacing: 0.3 },
  heroCard: { alignItems: 'center', paddingVertical: 22 },
  heroValue: { fontSize: 44, fontWeight: fonts.weight.bold, letterSpacing: -1 },
  heroLabel: { fontSize: 13, fontWeight: fonts.weight.medium, marginTop: 2, textAlign: 'center' },
  heroChips: { flexDirection: 'row', gap: 14, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' },
  heroChip: { fontSize: 13, fontWeight: fonts.weight.medium },
  barTrack: {
    alignSelf: 'stretch',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5 },
  limitCard: { marginTop: 10, paddingVertical: 12, borderWidth: 0 },
  limitText: { fontSize: 14, fontWeight: fonts.weight.semibold, textAlign: 'center' },
  itemCard: { marginBottom: 10, padding: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBadge: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeDay: { fontSize: 18, fontWeight: fonts.weight.bold },
  dateBadgeMon: { fontSize: 10, fontWeight: fonts.weight.semibold, letterSpacing: 0.5 },
  itemBody: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: fonts.weight.semibold },
  itemMeta: { fontSize: 13, marginTop: 2 },
  emptyCard: { alignItems: 'center', paddingVertical: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: fonts.weight.bold },
  emptyBody: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabPlus: { fontSize: 30, lineHeight: 34, fontWeight: fonts.weight.semibold },
});
