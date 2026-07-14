import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../../types/chat.types';
import type { AnswerReference } from '../../types/data.types';
import { TAFSIR_SOURCE_LABEL } from '../../types/answer.types';
import type { UIStrings } from '../../utils/strings';
import { useTypewriter } from '../../hooks/useTypewriter';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import SourceBadge from './SourceBadge';
import RelatedAyahs from './RelatedAyahs';
import BotAvatar from './BotAvatar';

interface ChatBubbleProps {
  message: ChatMessage;
  strings: UIStrings;
  /** True while this message's text is being revealed letter by letter. */
  isStreaming?: boolean;
  /** Called once the reveal animation finishes (or is skipped). */
  onStreamDone?: () => void;
}

/** Answers longer than this are clamped behind a "read more" control. */
const CLAMP_THRESHOLD = 850;
const VERSE_CLAMP_THRESHOLD = 300;
const CLAMP_LINES = 12;
const VERSE_CLAMP_LINES = 6;

/** Digit runs incl. grouping separators (Western + Arabic-Indic). */
const NUMBER_RUN_RE = /([0-9٠-٩۰-۹]+(?:[,.٫٬][0-9٠-٩۰-۹]+)*)/g;

/** Render numbers inside analytics answers as separate bold spans. */
function TextWithEmphasis({ text, emphasize }: { text: string; emphasize: boolean }) {
  if (!emphasize) return <Text style={styles.bodyText}>{text}</Text>;
  const parts = text.split(NUMBER_RUN_RE);
  return (
    <Text style={styles.bodyText}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={styles.number}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/** Legacy generic reference card — book/hadith/"other" references only (Quran ayahs render via RelatedAyahs). */
function ReferenceCard({ reference, strings }: { reference: AnswerReference; strings: UIStrings }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = reference.text.length > VERSE_CLAMP_THRESHOLD;

  return (
    <View style={styles.refCard}>
      <View style={styles.refHeader}>
        <Text style={styles.refStar}>✦</Text>
        <Text style={styles.refHeaderText}>{strings.bookLabel}</Text>
        <Text style={styles.refDot}>•</Text>
        <Text style={styles.refHeaderText}>
          {strings.surahLabel} {reference.surah}
        </Text>
        {reference.ayah && reference.ayah !== '—' && (
          <>
            <Text style={styles.refDot}>•</Text>
            <Text style={styles.refHeaderText}>
              {strings.ayahLabel} {reference.ayah}
            </Text>
          </>
        )}
      </View>
      <View style={styles.refBody}>
        <Text
          style={styles.refText}
          numberOfLines={isLong && !expanded ? VERSE_CLAMP_LINES : undefined}
        >
          {reference.text}
        </Text>
        {isLong && (
          <Pressable onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.linkText}>{expanded ? strings.readLess : strings.readMore}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function ChatBubble({
  message,
  strings,
  isStreaming = false,
  onStreamDone,
}: ChatBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { displayed, done, skip } = useTypewriter(message.text, isStreaming);

  useEffect(() => {
    if (isStreaming && done) {
      setExpanded(true);
      onStreamDone?.();
    }
  }, [isStreaming, done, onStreamDone]);

  const isUser = message.role === 'user';
  const isLong = message.text.length > CLAMP_THRESHOLD;
  const clamped = isLong && !expanded && !isStreaming;
  const revealing = isStreaming && !done;
  const noAnswer = message.source === 'fallback' || message.source === 'clarify';
  const time = strings.formatTime(message.timestamp);

  const copyAnswer = async () => {
    const parts = [message.title, message.text].filter(Boolean);
    await Clipboard.setStringAsync(parts.join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
          <Text style={styles.userTime}>{time}</Text>
        </View>
      </View>
    );
  }

  // Prefer the new unified-answer fields; fall back to the legacy
  // `references` list (older persisted messages, or a Q&A answer whose
  // reference is a book/hadith rather than a Quran ayah) so nothing a
  // previous version of the app rendered ever silently disappears.
  const legacyQuranRefs = message.references?.filter((r) => r.type === 'quran') ?? [];
  const legacyOtherRefs = message.references?.filter((r) => r.type !== 'quran') ?? [];
  const quranRefs =
    message.quranReferences && message.quranReferences.length > 0
      ? message.quranReferences
      : legacyQuranRefs.map((r) => ({ surah: r.surah, ayah: r.ayah, text: r.text }));

  return (
    <View style={styles.botRow}>
      <BotAvatar />
      <Pressable
        onPress={revealing ? skip : undefined}
        style={[styles.botBubble, noAnswer && styles.botBubbleNoAnswer]}
      >
        {message.title && (
          <View style={styles.titleRow}>
            <Text style={styles.titleStar}>✦</Text>
            <Text style={styles.title}>{message.title}</Text>
          </View>
        )}

        {!revealing && message.answerSources && message.answerSources.length > 0 && (
          <View style={styles.badgeRow}>
            {message.answerSources.map((s, i) => (
              <SourceBadge key={`${s.type}-${i}`} source={s} />
            ))}
          </View>
        )}

        <Text
          style={styles.body}
          numberOfLines={clamped ? CLAMP_LINES : undefined}
        >
          <TextWithEmphasis
            text={revealing ? displayed : displayed}
            emphasize={message.source === 'analytics'}
          />
        </Text>

        {isLong && !revealing && (
          <Pressable onPress={() => setExpanded((v) => !v)} style={styles.expandButton}>
            <Text style={styles.expandButtonText}>
              {clamped ? strings.readMore : strings.readLess}
            </Text>
          </Pressable>
        )}

        {!revealing && <RelatedAyahs references={quranRefs} strings={strings} />}

        {!revealing &&
          message.tafsirReferences?.map((ref, i) => (
            <View key={i} style={styles.tafsirCard}>
              <View style={styles.tafsirHeader}>
                <Text style={styles.tafsirOrnament}>✦</Text>
                <Text style={styles.tafsirHeaderText}>{TAFSIR_SOURCE_LABEL}</Text>
                {ref.surah ? (
                  <>
                    <Text style={styles.refDot}>•</Text>
                    <Text style={styles.tafsirHeaderText}>
                      {strings.surahLabel} {ref.surah}
                    </Text>
                  </>
                ) : null}
              </View>
              <View style={styles.refBody}>
                <Text style={styles.tafsirExcerptText}>{ref.excerpt}</Text>
              </View>
            </View>
          ))}

        {!revealing &&
          legacyOtherRefs.map((ref, i) => <ReferenceCard key={i} reference={ref} strings={strings} />)}

        {!revealing && message.stats && message.stats.items.length > 0 && (
          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Text style={styles.refStar}>۞</Text>
              <Text style={styles.statsTitle}>{message.stats.title}</Text>
            </View>
            <View style={{ gap: SPACING.sm }}>
              {message.stats.items.map((item) => {
                const max = Math.max(...message.stats!.items.map((i) => i.value));
                const pct = max > 0 ? Math.max(4, (item.value / max) * 100) : 0;
                return (
                  <View key={item.label} style={styles.statRow}>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <View style={styles.statBarTrack}>
                      <View style={[styles.statBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.statValue}>{strings.formatNumber(item.value)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {!revealing && message.safetyNote && (
          <View style={styles.safetyCard}>
            <View style={styles.safetyIconWrap}>
              <Text style={styles.safetyIcon}>⚠</Text>
            </View>
            <Text style={styles.safetyText}>{message.safetyNote}</Text>
          </View>
        )}

        {!revealing && message.note && <Text style={styles.note}>{message.note}</Text>}

        {!revealing && (
          <View style={styles.footerRow}>
            <Text style={styles.time}>{time}</Text>
            {!noAnswer && message.source !== 'notice' && message.text && (
              <Pressable onPress={copyAnswer}>
                <Text style={styles.copyText}>{copied ? strings.copied : strings.copy}</Text>
              </Pressable>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '85%',
    borderRadius: RADIUS.xl,
    borderBottomRightRadius: 6,
    backgroundColor: COLORS.forest,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    shadowColor: COLORS.forestDeep,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.cream,
  },
  userTime: {
    marginTop: 4,
    textAlign: 'right',
    fontSize: 10,
    color: 'rgba(255,253,246,0.6)',
  },
  botRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  botBubble: {
    flex: 1,
    maxWidth: '88%',
    borderRadius: RADIUS.xl,
    borderBottomLeftRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(178,138,62,0.35)',
    backgroundColor: COLORS.cream,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    shadowColor: COLORS.forest,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  botBubbleNoAnswer: {
    borderColor: 'rgba(178,138,62,0.5)',
    backgroundColor: 'rgba(178,138,62,0.1)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  titleStar: {
    color: COLORS.gold,
    fontSize: 13,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.forest,
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm + 2,
  },
  body: {},
  bodyText: {
    fontSize: 15,
    lineHeight: 26,
    color: COLORS.ink,
  },
  number: {
    fontWeight: '700',
    fontSize: 16,
    color: COLORS.forest,
  },
  expandButton: {
    marginTop: SPACING.xs,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.4)',
    backgroundColor: COLORS.cream,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
  },
  expandButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.goldDeep,
  },
  refCard: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.35)',
    backgroundColor: 'rgba(246,240,225,0.7)',
    overflow: 'hidden',
  },
  refHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(178,138,62,0.2)',
    backgroundColor: 'rgba(178,138,62,0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  refStar: {
    color: COLORS.gold,
    fontSize: 12,
  },
  refHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.goldDeep,
  },
  refDot: {
    fontSize: 12,
    color: 'rgba(138,104,42,0.4)',
  },
  refBody: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  refText: {
    fontSize: 17,
    lineHeight: 32,
    color: COLORS.forest,
  },
  linkText: {
    marginTop: SPACING.xs,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.goldDeep,
    textDecorationLine: 'underline',
  },
  tafsirCard: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.25,
    borderColor: 'rgba(23,117,82,0.35)',
    backgroundColor: 'rgba(23,117,82,0.05)',
    overflow: 'hidden',
  },
  tafsirHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(23,117,82,0.18)',
    backgroundColor: 'rgba(23,117,82,0.09)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  tafsirOrnament: {
    color: COLORS.emerald,
    fontSize: 12,
  },
  tafsirHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  tafsirExcerptText: {
    fontSize: 13.5,
    lineHeight: 22,
    fontStyle: 'italic',
    color: COLORS.forestDeep,
  },
  safetyCard: {
    marginTop: SPACING.sm + 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.4)',
    backgroundColor: 'rgba(230,214,174,0.35)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  safetyIconWrap: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(178,138,62,0.2)',
    flexShrink: 0,
  },
  safetyIcon: {
    fontSize: 12,
    color: COLORS.goldDeep,
  },
  safetyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.goldDeep,
  },
  statsCard: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.3)',
    backgroundColor: 'rgba(246,240,225,0.6)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm + 2,
  },
  statsTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: COLORS.goldDeep,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statLabel: {
    width: 100,
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  statBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(178,138,62,0.15)',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gold,
  },
  statValue: {
    width: 52,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.forest,
  },
  note: {
    marginTop: SPACING.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(178,138,62,0.2)',
    paddingTop: SPACING.sm,
    fontSize: 12.5,
    fontStyle: 'italic',
    lineHeight: 19,
    color: COLORS.inkSoft,
  },
  footerRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  time: {
    fontSize: 10,
    color: 'rgba(95,106,99,0.6)',
  },
  copyText: {
    fontSize: 11.5,
    color: 'rgba(95,106,99,0.7)',
  },
});
