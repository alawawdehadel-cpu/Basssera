import { router } from 'expo-router';
import { View } from 'react-native';
import { useAppLanguage } from '../../../hooks/useAppLanguage';
import type { TranslationKey } from '../../../i18n/translations';
import { useTheme } from '../../../theme/ThemeContext';
import type { HadithResult, HadithStatus } from '../../../types/hadith.types';
import Icon from '../Icon';
import { Press } from '../primitives';
import Txt from '../Txt';
import HadithCard from './HadithCard';

/**
 * The "أحاديث ذات صلة" block inside an assistant answer.
 *
 * Renders the very same HadithCard as the hadith screen and the search
 * tab — one card, one parser, one ruling badge everywhere — so a
 * narration can never be presented with less provenance in chat than it
 * carries elsewhere in the app.
 */

interface Props {
  status?: HadithStatus;
  results?: HadithResult[];
  /** Keywords actually sent to Dorar, used to open the same search in full. */
  query?: string;
  messageKey?: TranslationKey;
  /** True when the user explicitly asked for a hadith. */
  led?: boolean;
}

export default function AssistantHadithSection({
  status,
  results,
  query,
  messageKey,
  led = false,
}: Props) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();

  // No lookup ran for this question (a ruling referral, say) — render nothing.
  if (!status) return null;

  const hasResults = status === 'ready' || status === 'offline';
  const items = results ?? [];

  // A silent miss on an ordinary question is not worth a block of chrome;
  // when the user explicitly asked for a hadith, we owe them an answer.
  if (!hasResults && !led && status !== 'loading') return null;

  const heading = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <Icon name="book" size={14} color={colors.text2} strokeWidth={1.8} />
      <Txt size={12} weight={700} color={colors.text2}>
        {t('assistant.hadith.title')}
      </Txt>
    </View>
  );

  if (status === 'loading') {
    return (
      <View style={{ marginBottom: 18 }}>
        {heading}
        <Txt size={12} color={colors.text3}>
          {t('hadith.searching')}
        </Txt>
      </View>
    );
  }

  if (!hasResults || items.length === 0) {
    return (
      <View style={{ marginBottom: 18 }}>
        {heading}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Icon name="info" size={15} color={colors.text3} strokeWidth={1.8} />
          <Txt size={12} lh={1.7} color={colors.text2} style={{ flex: 1 }}>
            {t(messageKey ?? (status === 'error' ? 'hadith.error' : 'hadith.empty'))}
          </Txt>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 18 }}>
      {heading}

      {/* Why these and not others — stated before the narrations, not after. */}
      <Txt size={11} lh={1.7} color={colors.text3} style={{ marginBottom: 10 }}>
        {t('assistant.hadith.authenticOnly')}
      </Txt>

      {status === 'offline' ? (
        <Txt size={11} color={colors.gold} style={{ marginBottom: 10 }}>
          {t('hadith.offline')}
        </Txt>
      ) : null}

      <View style={{ gap: 12 }}>
        {items.map((item) => (
          <HadithCard key={item.id} item={item} />
        ))}
      </View>

      <Txt size={11} lh={1.7} color={colors.text3} style={{ marginTop: 10 }}>
        {t('hadith.attribution')}
      </Txt>

      {query ? (
        <Press
          onPress={() => router.push({ pathname: '/hadith', params: { q: query } })}
          accessibilityLabel={t('assistant.hadith.seeAll')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 10,
            minHeight: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Txt size={12} weight={600} color={colors.emerald}>
            {t('assistant.hadith.seeAll')}
          </Txt>
          <Icon name="arrowGo" size={15} color={colors.emerald} strokeWidth={2} />
        </Press>
      ) : null}
    </View>
  );
}
