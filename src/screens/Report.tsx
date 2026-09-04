import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts } from '../theme';
import { Card, PillButton, ProBadge, SectionTitle } from '../components';
import { useApp } from '../state';
import { getStats, Stats, exportCsv, fmtHours } from '../db';
import { generateAndSharePdf } from '../report';
import { maybeRequestReviewAfterExport } from '../reviews';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

export default function ReportScreen() {
  const theme = useTheme();
  const { isPro, showPaywall, dataVersion, goal } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStats().then(setStats);
  }, [dataVersion]);

  const requirePro = (fn: () => void) => () => {
    if (!isPro) {
      showPaywall();
      return;
    }
    fn();
  };

  const onPdf = requirePro(async () => {
    if ((stats?.entryCount ?? 0) === 0) {
      Alert.alert('Nothing to export yet', 'Log a few volunteer shifts first, then create the report.');
      return;
    }
    try {
      setBusy(true);
      await generateAndSharePdf();
      maybeRequestReviewAfterExport();
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  });

  const onCsv = requirePro(async () => {
    try {
      setBusy(true);
      const csv = await exportCsv();
      const file = new File(Paths.cache, 'merit-volunteer-hours.csv');
      if (file.exists) file.delete();
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export your volunteer hours',
        });
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  });

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, { color: theme.text }]}>Hours report</Text>
      <Text style={[styles.sub, { color: theme.textSecondary }]}>
        Every volunteer shift in one clean log — dated entries with organization
        and supervisor, plus a signature block, ready to hand to your school,
        chapter, or program.
      </Text>

      <Card theme={theme} style={styles.statsCard}>
        <View style={styles.statRow}>
          <Stat label="Entries" value={String(stats?.entryCount ?? 0)} theme={theme} />
          <Stat label="Total" value={fmtHours(stats?.totalMin ?? 0)} theme={theme} />
          <Stat label="Orgs" value={String(stats?.orgCount ?? 0)} theme={theme} />
        </View>
        <Text style={[styles.goalLine, { color: theme.textFaint }]}>
          Goal: {goal.totalHours}h · {goal.label}
        </Text>
      </Card>

      <SectionTitle theme={theme}>Export</SectionTitle>
      <Card theme={theme} style={styles.exportCard}>
        <View style={styles.exportRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.exportTitleRow}>
              <Text style={[styles.exportTitle, { color: theme.text }]}>PDF hours log</Text>
              {!isPro && <ProBadge theme={theme} />}
            </View>
            <Text style={[styles.exportBody, { color: theme.textSecondary }]}>
              An official-style service log with totals and a supervisor
              signature line — print it or share it straight from your phone.
            </Text>
          </View>
        </View>
        <PillButton theme={theme} label={busy ? 'Working…' : 'Create PDF'} onPress={onPdf} disabled={busy} />
      </Card>

      <Card theme={theme} style={styles.exportCard}>
        <View style={styles.exportRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.exportTitleRow}>
              <Text style={[styles.exportTitle, { color: theme.text }]}>CSV spreadsheet</Text>
              {!isPro && <ProBadge theme={theme} />}
            </View>
            <Text style={[styles.exportBody, { color: theme.textSecondary }]}>
              Every entry as a spreadsheet — your data, yours to keep and back up.
            </Text>
          </View>
        </View>
        <PillButton theme={theme} label={busy ? 'Working…' : 'Export CSV'} onPress={onCsv} disabled={busy} kind="ghost" />
      </Card>

      <Text style={[styles.tip, { color: theme.textFaint }]}>
        Tip: some schools and programs want hours on their own form — this log has
        everything you need to fill one out in a minute.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textFaint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: fonts.weight.bold, letterSpacing: -0.5 },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  statsCard: { marginTop: 16, paddingVertical: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: fonts.weight.bold },
  statLabel: { fontSize: 12, marginTop: 2 },
  goalLine: { textAlign: 'center', fontSize: 12, marginTop: 10 },
  exportCard: { marginBottom: 12, gap: 12 },
  exportRow: { flexDirection: 'row' },
  exportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportTitle: { fontSize: 16, fontWeight: fonts.weight.semibold },
  exportBody: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  tip: { fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
