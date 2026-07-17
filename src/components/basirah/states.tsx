import { useEffect, useRef } from 'react';
import { Animated, Modal, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import Icon, { type IconName } from './Icon';
import { Press } from './primitives';
import Txt from './Txt';

/** Shimmering skeleton line (loading state). */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: object;
}) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surface2, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Centered empty state: icon tile, title, body, optional CTA. */
export function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  onCta,
}: {
  icon: IconName;
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 50, paddingHorizontal: 40 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          backgroundColor: colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Icon name={icon} size={36} color={colors.text3} strokeWidth={1.5} />
      </View>
      <Txt size={16} weight={700} color={colors.text} align="center" style={{ marginBottom: 8 }}>
        {title}
      </Txt>
      <Txt size={13} lh={1.8} color={colors.text2} align="center">
        {body}
      </Txt>
      {ctaLabel ? (
        <Press
          onPress={onCta}
          style={{
            marginTop: 22,
            height: 46,
            paddingHorizontal: 24,
            borderRadius: 14,
            backgroundColor: colors.emerald,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt size={14} weight={700} color="#fff" align="center">
            {ctaLabel}
          </Txt>
        </Press>
      ) : null}
    </View>
  );
}

/** Dashed-gold "source unavailable" notice. */
export function SourceUnavailable({ title, body }: { title?: string; body?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.gold,
        backgroundColor: colors.goldTint,
        padding: 18,
        alignItems: 'center',
      }}
    >
      <Txt size={13} weight={700} color={colors.text} align="center" style={{ marginBottom: 6 }}>
        {title ?? 'مصدر غير متوفر'}
      </Txt>
      <Txt size={12.5} lh={1.7} color={colors.text2} align="center">
        {body ?? 'لم أجد مصدرًا موثوقًا كافيًا للإجابة بدقة.'}
      </Txt>
    </View>
  );
}

/** Destructive confirmation dialog (e.g. حذف سجل المحادثات). */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = 'إلغاء',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(6,20,16,.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <View
          style={{
            width: '100%',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 20,
          }}
        >
          <Txt size={14} weight={700} color={colors.text} align="center" style={{ marginBottom: 8 }}>
            {title}
          </Txt>
          <Txt size={12.5} lh={1.7} color={colors.text2} align="center" style={{ marginBottom: 16 }}>
            {body}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Press
              onPress={onCancel}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt size={13} weight={600} color={colors.text} align="center">
                {cancelLabel}
              </Txt>
            </Press>
            <Press
              onPress={onConfirm}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.error,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt size={13} weight={600} color="#fff" align="center">
                {confirmLabel}
              </Txt>
            </Press>
          </View>
        </View>
      </View>
    </Modal>
  );
}
