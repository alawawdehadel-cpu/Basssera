import React, { memo, useState } from 'react';
import { View } from 'react-native';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import { useTheme } from '../../theme/ThemeContext';
import type { TafsirDisplayItem, TafsirSourceGroup } from '../../types/answer.types';
import { formatNumber } from '../../utils/numerals';
import { stripTashkeel } from '../../utils/textNormalizer';
import { Press } from '../basirah/primitives';
import Txt from '../basirah/Txt';

/**
 * One tafsir SOURCE rendered as a single card: the source name is the card
 * title, followed by each matching passage (reference line + text + its own
 * independent expand/collapse). Multiple passages of the same source (e.g. an
 * ayah range that spans several tafsir groups) appear stacked under the one
 * title, in ayah order — never merged into another source and never combined
 * into one paragraph.
 *
 * A source that was requested but has no matching passage renders an honest
 * Arabic notice instead of being dropped or replaced by another source.
 *
 * Memoized: expanding a passage in one card never re-renders the others.
 */
export type TafsirResultCardProps = { group: TafsirSourceGroup };

/** "سورة البقرة — الآية 255" or "سورة الفاتحة — الآيات 1–5" (Arabic-Indic digits). */
function referenceLine(surahName: string, start: number, end: number): string {
  // Display-only cleanup: source datasets differ (As-Sa'di keeps tashkeel on
  // surah names, the others don't) — strip it so all cards read consistently.
  // The stored tafsir data is never modified.
  const name = stripTashkeel(surahName).replace(/^سورة\s+/, '').trim();
  const range =
    start === end
      ? `الآية ${formatNumber(start)}`
      : `الآيات ${formatNumber(start)}–${formatNumber(end)}`;
  return `سورة ${name} — ${range}`;
}

/** A single passage with its own collapse state (isolated for perf). */
const Passage = memo(function Passage({
  item,
  showReference,
}: {
  item: TafsirDisplayItem;
  showReference: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const [expanded, setExpanded] = useState(false);

  const truncated = item.explanation.trim() !== item.excerpt.trim();
  const body = expanded ? item.explanation : item.excerpt;

  return (
    <View style={{ marginTop: showReference ? 12 : 6 }}>
      {showReference ? (
        <Txt size={12} weight={600} color={colors.emerald} style={{ marginBottom: 6 }}>
          {referenceLine(item.surahName, item.ayahStart, item.ayahEnd)}
        </Txt>
      ) : null}
      <Txt
        size={13}
        lh={1.95}
        color={colors.text2}
        selectable
        style={{ writingDirection: 'rtl', textAlign: 'justify' }}
      >
        {formatNumber(body)}
      </Txt>
      {truncated ? (
        <Press
          onPress={() => setExpanded((v) => !v)}
          accessibilityLabel={expanded ? t('assistant.hideText') : t('assistant.showFullText')}
          style={{
            marginTop: 10,
            alignSelf: 'flex-start',
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.emerald,
          }}
        >
          <Txt size={11.5} weight={600} color={colors.emerald}>
            {expanded ? t('assistant.hideText') : t('assistant.showFullText')}
          </Txt>
        </Press>
      ) : null}
    </View>
  );
});

function TafsirResultCardBase({ group }: TafsirResultCardProps) {
  const { colors } = useTheme();

  const single = group.passages.length === 1;
  const firstRef = group.passages[0];

  return (
    <View
      accessibilityLabel={group.sourceArabic}
      style={{
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: group.notFound ? colors.surface2 : colors.surface,
        marginBottom: 12,
        opacity: group.notFound ? 0.8 : 1,
      }}
    >
      {/* source title (+ badge) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: single && !group.notFound ? 2 : 6,
        }}
      >
        <Txt size={14.5} weight={700} color={colors.text}>
          {group.sourceArabic}
        </Txt>
        <View
          style={{
            backgroundColor: colors.goldTint,
            paddingVertical: 3,
            paddingHorizontal: 9,
            borderRadius: 8,
          }}
        >
          <Txt size={10} weight={700} color={colors.gold}>
            تفسير
          </Txt>
        </View>
      </View>

      {group.notFound ? (
        <Txt size={12.5} lh={1.8} color={colors.text2} style={{ writingDirection: 'rtl' }}>
          {`لم أجد نصًا مطابقًا في ${group.sourceArabic} لهذه الآية ضمن بيانات التطبيق.`}
        </Txt>
      ) : single && firstRef ? (
        <>
          <Txt size={12} weight={600} color={colors.emerald} style={{ marginBottom: 6 }}>
            {referenceLine(firstRef.surahName, firstRef.ayahStart, firstRef.ayahEnd)}
          </Txt>
          <Passage item={firstRef} showReference={false} />
        </>
      ) : (
        group.passages.map((p, i) => (
          <Passage key={`${p.ayahStart}-${p.ayahEnd}-${i}`} item={p} showReference />
        ))
      )}
    </View>
  );
}

/** Memoized so one card's expand toggle never re-renders sibling source cards. */
export default memo(TafsirResultCardBase);
