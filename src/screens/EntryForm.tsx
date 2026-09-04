import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, Theme } from '../theme';
import { Card, PillButton } from '../components';
import { useApp } from '../state';
import {
  countEntries,
  deleteEntry,
  getEntry,
  getRecentOrganizations,
  insertEntry,
  updateEntry,
  Category,
  CATEGORY_OPTIONS,
  fmtHours,
} from '../db';
import { maybeRequestReview } from '../reviews';

interface Props {
  visible: boolean;
  entryId: number | null; // null = new entry
  onClose: () => void;
}

const TIMER_KEY = 'merit.shiftTimer.startedAt.v1';

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Parse "2.5" / "2" / "2,5" as decimal hours → minutes. */
function parseHoursToMin(text: string): number {
  const n = Number(text.replace(',', '.'));
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n * 60);
}

export default function EntryFormModal({ visible, entryId, onClose }: Props) {
  const theme = useTheme();
  const { settings, updateSettings, bumpData } = useApp();
  const [date, setDate] = useState(todayIso());
  const [hoursText, setHoursText] = useState('');
  const [organization, setOrganization] = useState('');
  const [recentOrgs, setRecentOrgs] = useState<string[]>([]);
  const [category, setCategory] = useState<Category>('');
  const [supervisor, setSupervisor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const editing = entryId !== null;

  const reset = useCallback(() => {
    setDate(todayIso());
    setHoursText('');
    setOrganization('');
    setCategory('');
    setSupervisor(settings.supervisorName);
    setNotes('');
  }, [settings.supervisorName]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setRecentOrgs(await getRecentOrganizations());
      if (entryId !== null) {
        const e = await getEntry(entryId);
        if (e) {
          setDate(e.date);
          setHoursText(e.durationMin > 0 ? String(Math.round((e.durationMin / 60) * 100) / 100) : '');
          setOrganization(e.organization);
          setCategory(e.category);
          setSupervisor(e.supervisor);
          setNotes(e.notes);
        }
      } else {
        reset();
        try {
          const raw = await AsyncStorage.getItem(TIMER_KEY);
          if (raw) setTimerStart(Number(raw));
        } catch {
          // timer state is a convenience only
        }
      }
    })();
  }, [visible, entryId, reset]);

  // Tick twice a minute while the timer runs so the elapsed label stays live.
  useEffect(() => {
    if (timerStart != null && visible) {
      tick.current = setInterval(() => setNow(Date.now()), 30_000);
      return () => {
        if (tick.current) clearInterval(tick.current);
      };
    }
    return undefined;
  }, [timerStart, visible]);

  const startTimer = async () => {
    const t = Date.now();
    setTimerStart(t);
    setNow(t);
    try {
      await AsyncStorage.setItem(TIMER_KEY, String(t));
    } catch {
      // non-fatal
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const stopTimer = async () => {
    if (timerStart == null) return;
    const elapsedMin = Math.max(1, Math.round((Date.now() - timerStart) / 60000));
    setHoursText(String(Math.round((elapsedMin / 60) * 100) / 100));
    setTimerStart(null);
    try {
      await AsyncStorage.removeItem(TIMER_KEY);
    } catch {
      // non-fatal
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const discardTimer = async () => {
    setTimerStart(null);
    try {
      await AsyncStorage.removeItem(TIMER_KEY);
    } catch {
      // non-fatal
    }
  };

  const save = async () => {
    const durationMin = parseHoursToMin(hoursText);
    if (durationMin <= 0) {
      Alert.alert('How many hours?', 'Enter the hours you volunteered, like 2 or 2.5 (or use the timer).');
      return;
    }
    setSaving(true);
    try {
      const input = {
        date,
        durationMin,
        organization: organization.trim(),
        category,
        supervisor: supervisor.trim(),
        notes,
      };
      if (editing && entryId !== null) {
        await updateEntry(entryId, input);
      } else {
        await insertEntry(input);
        if (supervisor.trim() && !settings.supervisorName) {
          updateSettings({ supervisorName: supervisor.trim() });
        }
        maybeRequestReview(await countEntries());
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bumpData();
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editing || entryId === null) return;
    Alert.alert('Delete this entry?', 'Its hours come off your totals. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(entryId);
          bumpData();
          onClose();
        },
      },
    ]);
  };

  const cancel = () => {
    reset();
    onClose();
  };

  const durationMin = parseHoursToMin(hoursText);
  const elapsed =
    timerStart != null ? Math.max(0, Math.round((now - timerStart) / 60000)) : 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cancel}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={cancel} hitSlop={10}>
            <Text style={[styles.headerBtn, { color: theme.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {editing ? 'Edit entry' : 'Log hours'}
          </Text>
          <Pressable onPress={save} hitSlop={10} disabled={saving}>
            <Text style={[styles.headerBtn, { color: theme.accent, fontWeight: fonts.weight.bold }]}>
              {saving ? '…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!editing && (
            <Card theme={theme} style={{ ...styles.fieldCard, backgroundColor: theme.cardAlt }}>
              {timerStart == null ? (
                <View style={styles.timerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timerTitle, { color: theme.text }]}>Shift timer</Text>
                    <Text style={[styles.timerSub, { color: theme.textFaint }]}>
                      Start when you arrive, stop when you wrap up.
                    </Text>
                  </View>
                  <PillButton theme={theme} label="Start" onPress={startTimer} />
                </View>
              ) : (
                <View style={styles.timerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timerTitle, { color: theme.accent }]}>
                      Volunteering… {fmtHours(Math.max(1, elapsed))}
                    </Text>
                    <Pressable onPress={discardTimer} hitSlop={6}>
                      <Text style={[styles.timerSub, { color: theme.textFaint }]}>
                        discard timer
                      </Text>
                    </Pressable>
                  </View>
                  <PillButton theme={theme} label="Stop" onPress={stopTimer} />
                </View>
              )}
            </Card>
          )}

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
            <View style={styles.dateRow}>
              <Pressable onPress={() => setDate(shiftDate(date, -1))} hitSlop={8}>
                <Text style={[styles.dateArrow, { color: theme.accent }]}>‹</Text>
              </Pressable>
              <Text style={[styles.dateText, { color: theme.text }]}>{prettyDate(date)}</Text>
              <Pressable
                onPress={() => date < todayIso() && setDate(shiftDate(date, 1))}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.dateArrow,
                    { color: date < todayIso() ? theme.accent : theme.border },
                  ]}
                >
                  ›
                </Text>
              </Pressable>
            </View>
          </Card>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Hours volunteered{durationMin > 0 ? `  ·  ${fmtHours(durationMin)}` : ''}
            </Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={hoursText}
              onChangeText={setHoursText}
              placeholder="2.5"
              placeholderTextColor={theme.textFaint}
              keyboardType="decimal-pad"
              maxLength={5}
            />
            <View style={styles.quickRow}>
              {[
                { label: '1h', v: '1' },
                { label: '1.5h', v: '1.5' },
                { label: '2h', v: '2' },
                { label: '3h', v: '3' },
                { label: '4h', v: '4' },
              ].map((c) => (
                <QuickChip key={c.label} theme={theme} label={c.label} onPress={() => setHoursText(c.v)} />
              ))}
            </View>
          </Card>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Organization</Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={organization}
              onChangeText={setOrganization}
              placeholder="City Harvest food bank"
              placeholderTextColor={theme.textFaint}
            />
            {recentOrgs.length > 0 && (
              <View style={styles.quickRow}>
                {recentOrgs.map((o) => (
                  <QuickChip key={o} theme={theme} label={o} onPress={() => setOrganization(o)} />
                ))}
              </View>
            )}
          </Card>

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Category</Text>
          <View style={styles.chipsRow}>
            {CATEGORY_OPTIONS.map((c) => {
              const active = category === c;
              return (
                <SelectChip
                  key={c}
                  theme={theme}
                  label={c}
                  active={active}
                  onPress={() => setCategory(active ? '' : c)}
                />
              );
            })}
          </View>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Supervisor or coordinator (verifies your hours)
            </Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={supervisor}
              onChangeText={setSupervisor}
              placeholder="Ms. Rivera"
              placeholderTextColor={theme.textFaint}
            />
          </Card>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notes, { color: theme.text }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Sorted donations and packed 40 grocery boxes"
              placeholderTextColor={theme.textFaint}
              multiline
            />
          </Card>

          {editing && (
            <View style={{ marginTop: 18 }}>
              <PillButton theme={theme} label="Delete entry" kind="ghost" onPress={onDelete} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function QuickChip({
  theme,
  label,
  onPress,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.quickChip, { backgroundColor: theme.cardAlt }]}
    >
      <Text style={[styles.quickChipText, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SelectChip({
  theme,
  label,
  active,
  onPress,
}: {
  theme: Theme;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.selectChip,
        {
          backgroundColor: active ? theme.accent : theme.card,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <Text
        style={[
          styles.selectChipText,
          { color: active ? (theme.isDark ? '#121815' : '#FFFFFF') : theme.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: fonts.weight.bold },
  scroll: { padding: 20, paddingBottom: 60 },
  fieldCard: { marginBottom: 12, paddingVertical: 12 },
  label: { fontSize: 12, fontWeight: fonts.weight.semibold, marginBottom: 4 },
  input: { fontSize: 17, paddingVertical: 2 },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerTitle: { fontSize: 16, fontWeight: fonts.weight.bold },
  timerSub: { fontSize: 12, marginTop: 2 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dateArrow: { fontSize: 30, fontWeight: fonts.weight.bold, paddingHorizontal: 10 },
  dateText: { fontSize: 17, fontWeight: fonts.weight.semibold },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  quickChip: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, maxWidth: 200 },
  quickChipText: { fontSize: 13, fontWeight: fonts.weight.medium },
  sectionLabel: { fontSize: 12, fontWeight: fonts.weight.semibold, marginBottom: 8, marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  selectChip: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  selectChipText: { fontSize: 13, fontWeight: fonts.weight.medium },
});
