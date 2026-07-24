import { useState } from 'react';
import { View } from 'react-native';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import { useTheme } from '../../theme/ThemeContext';
import type { TafsirReference } from '../../types/answer.types';
import { formatNumber } from '../../utils/numerals';
import { Press } from './primitives';
import Txt from './Txt';

/**
 * A single source-labeled tafsir card (السعدي / ابن كثير / الطبري).
 *
 * Renders the source badge + ayah reference, a collapsed excerpt, and a
 * toggle to reveal the full verbatim tafsir text ("عرض النص كاملًا"). A
 * source that has no matching passage renders an honest muted "not found"
 * card — never another source's text in its place. Design (colors, radii,
 * borders) matches the existing evidence/tafsir cards on this screen.
 */
export default function TafsirSourceCard({ reference }: { reference: TafsirReference }) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const [expanded, setExpanded] = useState(false);

  const hasFull = !!reference.fullText && reference.fullText.trim() !== reference.excerpt.trim();
  const body = expanded && reference.fullText ? reference.fullText : reference.excerpt;

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: reference.notFound ? colors.border : colors.border,
        backgroundColor: reference.notFound ? colors.surface2 : colors.surface,
        marginBottom: 12,
        opacity: reference.notFound ? 0.75 : 1,
      }}
    >
      {/* header: source badge + ayah reference */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        {reference.sourceLabel ? (
          <View
            style={{
              backgroundColor: colors.goldTint,
              paddingVertical: 3,
              paddingHorizontal: 9,
              borderRadius: 8,
            }}
          >
            <Txt size={10.5} weight={700} color={colors.gold}>
              {reference.sourceLabel}
            </Txt>
          </View>
        ) : (
          <View />
        )}
        {reference.surah || reference.ayah ? (
          <Txt size={11.5} weight={600} color={colors.emerald}>
            {reference.surah}
            {reference.ayah ? ` • ${formatNumber(reference.ayah)}` : ''}
          </Txt>
        ) : null}
      </View>

      <Txt
        size={13}
        lh={1.9}
        color={reference.notFound ? colors.text2 : colors.text2}
        style={{ textAlign: 'justify' }}
      >
        {formatNumber(body)}
      </Txt>

      {hasFull ? (
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
}
