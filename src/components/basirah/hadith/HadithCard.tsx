import * as Clipboard from 'expo-clipboard';
import { useMemo } from 'react';
import { Share, Text, View } from 'react-native';
import { useAppLanguage } from '../../../hooks/useAppLanguage';
import { FONT } from '../../../theme/fonts';
import { useTheme } from '../../../theme/ThemeContext';
import { DORAR_SITE_URL, type HadithResult } from '../../../types/hadith.types';
import { splitHighlights } from '../../../utils/hadithParser';
import Icon from '../Icon';
import { Card, Press } from '../primitives';
import { useToast } from '../Toast';
import Txt from '../Txt';
import HadithGradeBadge from './HadithGradeBadge';

/**
 * One hadith result: the matn with matched terms highlighted, the chain of
 * attribution (narrator / muhaddith / source / page), the ruling badge, and
 * copy + share actions.
 *
 * The matn is always Arabic — it is scripture-adjacent source text, so it is
 * rendered in the Quran/Amiri face and never translated, exactly like the
 * Quran and Tafsir content elsewhere in the app.
 */
export default function HadithCard({ item }: { item: HadithResult }) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { showToast } = useToast();

  const segments = useMemo(
    () => splitHighlights(item.matn, item.highlights),
    [item.matn, item.highlights],
  );

  const plainText = useMemo(() => {
    const lines = [item.matn];
    if (item.narrator) lines.push(`${t('hadith.narrator')}: ${item.narrator}`);
    if (item.muhaddith) lines.push(`${t('hadith.muhaddith')}: ${item.muhaddith}`);
    if (item.source) lines.push(`${t('hadith.source')}: ${item.source}`);
    if (item.pageOrNumber) lines.push(`${t('hadith.pageOrNumber')}: ${item.pageOrNumber}`);
    if (item.gradeText) lines.push(`${t('hadith.ruling')}: ${item.gradeText}`);
    lines.push(`${t('hadith.attribution')} — ${DORAR_SITE_URL}`);
    return lines.join('\n');
  }, [item, t]);

  const metaRow = (labelKey: Parameters<typeof t>[0], value?: string) => {
    if (!value) return null;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        <Txt size={11.5} weight={600} color={colors.text3} style={{ minWidth: 62 }}>
          {t(labelKey)}
        </Txt>
        <Txt size={11.5} lh={1.6} color={colors.text2} style={{ flex: 1 }}>
          {value}
        </Txt>
      </View>
    );
  };

  return (
    <Card padding={16} radius={18} style={{ gap: 12 }}>
      {/* matn */}
      <Text
        style={{
          fontFamily: FONT.quran,
          fontSize: 19,
          lineHeight: 19 * 1.95,
          color: colors.readerText,
          textAlign: 'right',
          writingDirection: 'rtl',
        }}
      >
        {segments.map((seg, i) =>
          seg.match ? (
            <Text key={i} style={{ backgroundColor: colors.goldTintStrong, color: colors.readerText }}>
              {seg.text}
            </Text>
          ) : (
            <Text key={i}>{seg.text}</Text>
          ),
        )}
      </Text>

      {/* attribution chain */}
      <View
        style={{
          gap: 5,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 12,
        }}
      >
        {metaRow('hadith.narrator', item.narrator)}
        {metaRow('hadith.muhaddith', item.muhaddith)}
        {metaRow('hadith.source', item.source)}
        {metaRow('hadith.pageOrNumber', item.pageOrNumber)}
      </View>

      {/* ruling */}
      <HadithGradeBadge category={item.gradeCategory} gradeText={item.gradeText} />

      {/* actions */}
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 10,
        }}
      >
        <Press
          onPress={async () => {
            try {
              await Clipboard.setStringAsync(plainText);
              showToast(t('common.copied'));
            } catch {
              showToast(t('common.copyFailed'));
            }
          }}
          accessibilityLabel={t('verse.copy')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            flex: 1,
            minHeight: 44,
            borderRadius: 11,
            backgroundColor: colors.surface2,
          }}
        >
          <Icon name="copy" size={15} color={colors.text} strokeWidth={1.7} />
          <Txt size={12} weight={600} color={colors.text}>
            {t('verse.copy')}
          </Txt>
        </Press>
        <Press
          onPress={async () => {
            try {
              await Share.share({ message: plainText });
            } catch {
              /* user dismissed the sheet */
            }
          }}
          accessibilityLabel={t('verse.share')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            flex: 1,
            minHeight: 44,
            borderRadius: 11,
            backgroundColor: colors.surface2,
          }}
        >
          <Icon name="share" size={15} color={colors.text} strokeWidth={1.7} />
          <Txt size={12} weight={600} color={colors.text}>
            {t('verse.share')}
          </Txt>
        </Press>
      </View>
    </Card>
  );
}
