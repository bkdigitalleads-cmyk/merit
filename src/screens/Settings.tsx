import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme, fonts } from '../theme';
import { Card, SectionTitle, ProBadge } from '../components';
import { useApp } from '../state';
import { deleteAllData } from '../db';
import { GOAL_PRESETS, getGoalPreset } from '../goals';
import { restorePurchases, isBillingAvailable } from '../purchases';

const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://bkdigitalleads-cmyk.github.io/merit/privacy.html';

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, updateSettings, isPro, setIsPro, showPaywall, bumpData, goal } = useApp();
  const [busy, setBusy] = useState(false);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);

  const preset = getGoalPreset(settings.goalKey);

  const pickGoal = async (key: string) => {
    await updateSettings({ goalKey: key, goalHours: null });
    setGoalPickerOpen(false);
  };

  const onToggleLock = async () => {
    if (!isPro) {
      showPaywall();
      return;
    }
    if (!settings.lockEnabled) {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hw || !enrolled) {
        Alert.alert(
          'Face ID unavailable',
          'Set up Face ID or a device passcode in iOS Settings first.'
        );
        return;
      }
    }
    await updateSettings({ lockEnabled: !settings.lockEnabled });
  };

  const onRestore = async () => {
    if (!isBillingAvailable()) {
      Alert.alert('Unavailable', 'Purchases are not available right now.');
      return;
    }
    setBusy(true);
    const res = await restorePurchases();
    setBusy(false);
    if (res.ok) {
      setIsPro(res.isPro);
      Alert.alert(
        res.isPro ? 'Restored!' : 'No purchases found',
        res.isPro
          ? 'Your Pro access is back.'
          : 'We couldn’t find a previous purchase on this Apple ID.'
      );
    } else {
      Alert.alert('Restore failed', res.error ?? 'Please try again.');
    }
  };

  const onDeleteAll = () => {
    Alert.alert(
      'Delete your entire log?',
      'Every entry is permanently erased from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await deleteAllData();
            bumpData();
          },
        },
      ]
    );
  };

  const rowText = (label: string, pro?: boolean) => (
    <View style={styles.rowLabel}>
      <Text style={[styles.rowText, { color: theme.text }]}>{label}</Text>
      {pro && !isPro ? <ProBadge theme={theme} /> : null}
    </View>
  );

  const goalLabel = preset ? preset.label : 'Choose your goal';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      {!isPro && (
        <Pressable onPress={showPaywall}>
          <Card theme={theme} style={{ ...styles.upsell, backgroundColor: theme.accentSoft }}>
            <Text style={[styles.upsellTitle, { color: theme.accent }]}>Merit Pro</Text>
            <Text style={[styles.upsellSub, { color: theme.text }]}>
              Unlimited entries · Verification-ready PDF · CSV export · Face ID lock
            </Text>
          </Card>
        </Pressable>
      )}

      <SectionTitle theme={theme}>Volunteer goal</SectionTitle>
      <Card theme={theme}>
        <Pressable onPress={() => setGoalPickerOpen(true)} style={styles.row}>
          {rowText('Tracking toward')}
          <Text style={[styles.rowValue, { color: theme.accent }]}>{goalLabel} ›</Text>
        </Pressable>
        <View style={styles.customRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customLabel, { color: theme.textSecondary }]}>Target hours</Text>
            <TextInput
              style={[styles.customInput, { color: theme.text, borderColor: theme.border }]}
              keyboardType="number-pad"
              maxLength={4}
              value={String(settings.goalHours ?? goal.totalHours)}
              onChangeText={(v) =>
                updateSettings({ goalHours: Math.max(1, Number(v) || 0) || 1 })
              }
            />
          </View>
          <View style={{ flex: 2, justifyContent: 'flex-end' }}>
            <Text style={[styles.goalNote, { color: theme.textFaint }]}>
              {preset?.note ?? 'Set the number your school or program requires.'}
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle theme={theme}>Names on the log</SectionTitle>
      <Card theme={theme}>
        <Text style={[styles.customLabel, { color: theme.textSecondary }]}>Volunteer</Text>
        <TextInput
          style={[styles.nameInput, { color: theme.text }]}
          value={settings.volunteerName}
          onChangeText={(v) => updateSettings({ volunteerName: v })}
          placeholder="Jordan Rivera"
          placeholderTextColor={theme.textFaint}
        />
        <Text style={[styles.customLabel, { color: theme.textSecondary, marginTop: 12 }]}>
          Usual supervisor or coordinator
        </Text>
        <TextInput
          style={[styles.nameInput, { color: theme.text }]}
          value={settings.supervisorName}
          onChangeText={(v) => updateSettings({ supervisorName: v })}
          placeholder="Ms. Rivera"
          placeholderTextColor={theme.textFaint}
        />
      </Card>

      <SectionTitle theme={theme}>Security</SectionTitle>
      <Card theme={theme}>
        <View style={styles.row}>
          {rowText('Lock with Face ID', true)}
          <Switch
            value={settings.lockEnabled}
            onValueChange={onToggleLock}
            trackColor={{ true: theme.accent }}
          />
        </View>
      </Card>

      <SectionTitle theme={theme}>Privacy & data</SectionTitle>
      <Card theme={theme}>
        <Text style={[styles.privacyNote, { color: theme.textSecondary }]}>
          Your volunteer log never leaves this iPhone. No account, no cloud, no
          tracking. Use the Report tab to export a copy whenever you like.
        </Text>
      </Card>

      <SectionTitle theme={theme}>Purchases</SectionTitle>
      <Card theme={theme}>
        <Pressable onPress={onRestore} disabled={busy} style={styles.row}>
          {rowText('Restore purchases')}
          <Text style={{ color: theme.textFaint }}>›</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(TERMS_URL)} style={styles.row}>
          {rowText('Terms of Use (EULA)')}
          <Text style={{ color: theme.textFaint }}>›</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.row}>
          {rowText('Privacy Policy')}
          <Text style={{ color: theme.textFaint }}>›</Text>
        </Pressable>
      </Card>

      <SectionTitle theme={theme}>Danger zone</SectionTitle>
      <Card theme={theme}>
        <Pressable onPress={onDeleteAll} style={styles.row}>
          <Text style={[styles.rowText, { color: theme.danger }]}>Delete all entries</Text>
        </Pressable>
      </Card>

      <Text style={[styles.version, { color: theme.textFaint }]}>
        Merit v1.0.0 · Made with care in NYC
      </Text>

      <Modal
        visible={goalPickerOpen}
        animationType="slide"
        onRequestClose={() => setGoalPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={[styles.pickerHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Your goal</Text>
            <Pressable onPress={() => setGoalPickerOpen(false)} hitSlop={10}>
              <Text style={[styles.rowText, { color: theme.accent }]}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={GOAL_PRESETS}
            keyExtractor={(p) => p.key}
            contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
            renderItem={({ item }) => {
              const active = item.key === settings.goalKey;
              return (
                <Pressable
                  onPress={() => pickGoal(item.key)}
                  style={[
                    styles.goalRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.rowText,
                      { color: active ? theme.accent : theme.text },
                      active && { fontWeight: fonts.weight.bold },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={[styles.goalReqText, { color: theme.textFaint }]}>
                    {item.hours}h
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: fonts.weight.bold, letterSpacing: -0.5, marginBottom: 8 },
  upsell: { marginTop: 8, borderWidth: 0 },
  upsellTitle: { fontSize: 17, fontWeight: fonts.weight.bold, marginBottom: 4 },
  upsellSub: { fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    minHeight: 40,
  },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { fontSize: 16 },
  rowValue: { fontSize: 16, fontWeight: fonts.weight.semibold },
  customRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  customLabel: { fontSize: 12, fontWeight: fonts.weight.semibold, marginBottom: 4 },
  customInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  goalNote: { fontSize: 11, lineHeight: 16 },
  nameInput: { fontSize: 17, paddingVertical: 2 },
  privacyNote: { fontSize: 13, lineHeight: 19, paddingVertical: 4 },
  version: { textAlign: 'center', marginTop: 28, fontSize: 12 },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerTitle: { fontSize: 17, fontWeight: fonts.weight.bold },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  goalReqText: { fontSize: 13 },
});
