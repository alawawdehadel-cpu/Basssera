import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import Txt from './Txt';

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * App-wide toast/snackbar: dark pill floating above the bottom nav,
 * fade-up in, auto-hide after 1.8s — used for bookmark confirmations,
 * copy feedback, etc.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (msg: string) => {
      setMessage(msg);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(anim, {
          toValue: 0,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => setMessage(''));
      }, 1800);
    },
    [anim],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {message ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 96,
              left: 0,
              right: 0,
              alignItems: 'center',
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
              ],
            }}
          >
            <View
              style={{
                backgroundColor: colors.text,
                paddingHorizontal: 20,
                paddingVertical: 11,
                borderRadius: 14,
                shadowColor: '#000',
                shadowOpacity: 0.35,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              <Txt size={12.5} weight={600} color={colors.bg} align="center">
                {message}
              </Txt>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
