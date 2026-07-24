import { ActivityIndicator, Linking, View } from 'react-native';
import { useAppLanguage } from '../../../hooks/useAppLanguage';
import type { UseHadithSearch } from '../../../hooks/useHadithSearch';
import { useTheme } from '../../../theme/ThemeContext';
import { DEGREE_FILTERS, DEGREE_FILTER_KEYS, DORAR_SITE_URL } from '../../../types/hadith.types';
import { formatNumber } from '../../../utils/numerals';
import Icon from '../Icon';
import { Chip, Press } from '../primitives';
import { EmptyState, Skeleton } from '../states';
import Txt from '../Txt';
import HadithCard from './HadithCard';

/**
 * The result list shared by the dedicated الحديث screen and the hadith tab
 * inside Smart Search, so both render identical cards, states and filters.
 */
export default function HadithResults({ search }: { search: UseHadithSearch }) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { results, status, degree, setDegree, errorKey, hasMore, loadingMore, loadMore, retry } =
    search;

  const filters = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {DEGREE_FILTERS.map((key) => (
        <Chip
          key={key}
          label={t(DEGREE_FILTER_KEYS[key])}
          active={degree === key}
          onPress={() => setDegree(key)}
        />
      ))}
    </View>
  );

  /** Weak/fabricated hadith appear in results, so say so once, up front. */
  const gradeNotice = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 11,
        borderRadius: 12,
        backgroundColor: colors.goldTint,
        borderWidth: 1,
        borderColor: colors.gold,
        marginBottom: 14,
      }}
    >
      <Icon name="info" size={15} color={colors.gold} strokeWidth={1.8} />
      <Txt size={11} lh={1.65} color={colors.text2} style={{ flex: 1 }}>
        {t('hadith.gradeNotice')}
      </Txt>
    </View>
  );

  const attribution = (
    <Press
      onPress={() => Linking.openURL(DORAR_SITE_URL).catch(() => {})}
      accessibilityLabel={t('hadith.openDorar')}
      style={{ minHeight: 44, justifyContent: 'center', marginTop: 16 }}
    >
      <Txt size={10.5} lh={1.6} color={colors.text3} align="center">
        {t('hadith.attribution')}
      </Txt>
      <Txt size={10.5} color={colors.emerald} align="center" style={{ marginTop: 2 }}>
        dorar.net
      </Txt>
    </Press>
  );

  if (status === 'idle') {
    return (
      <View>
        {filters}
        <EmptyState icon="search" title={t('hadith.start')} body={t('hadith.startBody')} />
        {attribution}
      </View>
    );
  }

  if (status === 'loading') {
    return (
      <View>
        {filters}
        <View style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={150} radius={18} />
          ))}
        </View>
        <Txt size={12.5} color={colors.text3} align="center" style={{ marginTop: 14 }}>
          {t('hadith.searching')}
        </Txt>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View>
        {filters}
        <EmptyState
          icon="wifiOff"
          title={t(errorKey ?? 'hadith.error')}
          body={t('hadith.emptyBody')}
          ctaLabel={t('common.retry')}
          onCta={retry}
        />
        {attribution}
      </View>
    );
  }

  if (status === 'empty') {
    return (
      <View>
        {filters}
        <EmptyState icon="search" title={t('hadith.empty')} body={t('hadith.emptyBody')} />
        {attribution}
      </View>
    );
  }

  return (
    <View>
      {filters}
      {status === 'offline' ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 11,
            borderRadius: 12,
            backgroundColor: colors.goldTint,
            marginBottom: 14,
          }}
        >
          <Icon name="wifiOff" size={14} color={colors.gold} strokeWidth={1.8} />
          <Txt size={11.5} color={colors.text2} style={{ flex: 1 }}>
            {t('hadith.offline')}
          </Txt>
        </View>
      ) : null}

      {gradeNotice}

      <Txt size={12} color={colors.text2} style={{ marginBottom: 10 }}>
        {t('hadith.results', { count: formatNumber(results.length) })}
      </Txt>

      <View style={{ gap: 12 }}>
        {results.map((item) => (
          <HadithCard key={item.id} item={item} />
        ))}
      </View>

      {hasMore ? (
        <Press
          onPress={loadMore}
          disabled={loadingMore}
          accessibilityLabel={t('hadith.loadMore')}
          style={{
            minHeight: 46,
            marginTop: 14,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: loadingMore ? 0.6 : 1,
          }}
        >
          {loadingMore ? (
            <ActivityIndicator color={colors.emerald} />
          ) : (
            <Txt size={13} weight={600} color={colors.emerald}>
              {t('hadith.loadMore')}
            </Txt>
          )}
        </Press>
      ) : null}

      <Txt size={10.5} lh={1.6} color={colors.text3} align="center" style={{ marginTop: 14 }}>
        {t('hadith.arabicOnlyNote')}
      </Txt>
      {attribution}
    </View>
  );
}
