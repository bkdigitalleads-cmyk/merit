import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, fonts } from '../theme';
import { PillButton } from '../components';
import { useApp } from '../state';
import { GOAL_PRESETS } from '../goals';

const { width } = Dimensions.get('window');

/**
 * Stored locally only (never leaves the device). Doubles as backup
 * attribution and as a future paywall-routing signal by traffic source.
 */
export const SOURCE_KEY = 'merit.source.v1';

const SOURCES = [
  'App Store search',
  'TikTok / Instagram',
  'School, club, or program',
  'Somewhere else',
];

const SLIDES: { icon: string; title: string; body: string }[] = [
  {
    icon: '🤝',
    title: 'Every volunteer hour,\nlogged in seconds',
    body: 'Tap ＋ after your shift — date, hours, organization, and who supervised. Captured before you leave the parking lot.',
  },
  {
    icon: '🎯',
    title: 'Watch the hours\nadd up',
    body: 'NHS, college applications, a scholarship, or a program requirement — set your target and watch it fill, shift by shift.',
  },
  {
    icon: '📄',
    title: 'A log your school\nwill accept',
    body: 'One tap turns your entries into an official-style PDF with totals and a supervisor signature line. No lost paper forms.',
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { updateSettings } = useApp();
  const [page, setPage] = useState(0);
  const [step, setStep] = useState<'slides' | 'goal' | 'source'>('slides');
  const scrollRef = useRef<ScrollView>(null);
  const last = page === SLIDES.length - 1;

  const next = () => {
    if (last) {
      setStep('goal');
      return;
    }
    const target = page + 1;
    scrollRef.current?.scrollTo({ x: target * width, animated: true });
    setPage(target);
  };

  const pickGoal = (key: string) => {
    updateSettings({ goalKey: key }).catch(() => {});
    setStep('source');
  };

  const pickSource = (source: string) => {
    AsyncStorage.setItem(SOURCE_KEY, source).catch(() => {});
    onDone();
  };

  if (step === 'goal') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.goalWrap}>
          <Text style={[styles.title, { color: theme.text }]}>
            What are you tracking toward?
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary, marginTop: 8 }]}>
            We'll suggest a target — you can change the hours or the goal any time
            in Settings.
          </Text>
        </View>
        <FlatList
          data={GOAL_PRESETS}
          keyExtractor={(p) => p.key}
          contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pickGoal(item.key)}
              style={({ pressed }) => [
                styles.goalBtn,
                {
                  backgroundColor: pressed ? theme.accentSoft : theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.goalName, { color: theme.text }]}>{item.label}</Text>
              <Text style={[styles.goalReq, { color: theme.textFaint }]}>
                {item.hours}h
              </Text>
            </Pressable>
          )}
        />
      </View>
    );
  }

  if (step === 'source') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.sourceWrap}>
          <Text style={[styles.title, { color: theme.text }]}>
            Where did you hear about Merit?
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary, marginTop: 10 }]}>
            One tap — it helps us make the app better.
          </Text>
          <View style={styles.sourceList}>
            {SOURCES.map((s) => (
              <Pressable
                key={s}
                onPress={() => pickSource(s)}
                style={({ pressed }) => [
                  styles.sourceBtn,
                  {
                    backgroundColor: pressed ? theme.accentSoft : theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.sourceText, { color: theme.text }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{s.icon}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{s.title}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === page ? theme.accent : theme.border },
              ]}
            />
          ))}
        </View>
        <PillButton theme={theme} label={last ? 'Set up my log' : 'Continue'} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  icon: { fontSize: 56, marginBottom: 20 },
  title: {
    fontSize: 28,
    fontWeight: fonts.weight.bold,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
  footer: { padding: 24, paddingBottom: 40, gap: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  goalWrap: { paddingTop: 40, paddingHorizontal: 32, paddingBottom: 16 },
  goalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  goalName: { fontSize: 16, fontWeight: fonts.weight.medium },
  goalReq: { fontSize: 13 },
  sourceWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  sourceList: { marginTop: 28, gap: 12 },
  sourceBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  sourceText: { fontSize: 17, fontWeight: fonts.weight.medium },
});
