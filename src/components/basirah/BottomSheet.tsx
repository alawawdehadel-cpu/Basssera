import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Slide-up bottom sheet with scrim, per the design: 26px top radius,
 * drag-handle bar, dismiss on scrim tap, max height 82%.
 * Calm motion only — 260ms ease, no bounce.
 */
export default function BottomSheet({
  visible,
  onClose,
  children,
  scrollable = true,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  const { colors } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slide, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slide, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible, slide]);

  if (!mounted) return null;

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });
  const scrimOpacity = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const body = (
    <>
      <View
        style={{
          width: 42,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.border,
          alignSelf: 'center',
          marginTop: 6,
          marginBottom: 16,
        }}
      />
      {children}
    </>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,20,16,.5)', opacity: scrimOpacity }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="إغلاق" />
        </Animated.View>
        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: colors.surface,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingHorizontal: 20,
            paddingBottom: 26,
            maxHeight: '82%',
          }}
        >
          {scrollable ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
