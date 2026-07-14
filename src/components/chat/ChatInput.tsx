import { useRef, useState } from 'react';
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import { MAX_MESSAGE_LENGTH, isValidMessage } from '../../utils/inputSanitizer';

interface ChatInputProps {
  placeholder: string;
  sendLabel: string;
  charCount: (n: number, max: number) => string;
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({
  placeholder,
  sendLabel,
  charCount,
  onSend,
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const canSend = !disabled && isValidMessage(value);

  const submit = () => {
    if (!canSend) return;
    onSend(value);
    setValue('');
  };

  // Hardware-keyboard Enter sends; Shift+Enter inserts a newline (on
  // platforms that report key events, e.g. web / external keyboards).
  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const key = (e.nativeEvent as unknown as { key?: string; shiftKey?: boolean }).key;
    const shiftKey = (e.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey;
    if (key === 'Enter' && !shiftKey) {
      submit();
    }
  };

  const nearLimit = value.length >= MAX_MESSAGE_LENGTH - 60;

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputBox}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(t) => setValue(t.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          placeholderTextColor="rgba(95,106,99,0.6)"
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          style={styles.input}
          accessibilityLabel={placeholder}
        />
        {nearLimit && (
          <Text style={styles.counter}>{charCount(value.length, MAX_MESSAGE_LENGTH)}</Text>
        )}
      </View>

      <Pressable
        onPress={submit}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={sendLabel}
        style={({ pressed }) => [
          styles.sendButton,
          !canSend && styles.sendButtonDisabled,
          pressed && canSend && styles.sendButtonPressed,
        ]}
      >
        <Svg
          viewBox="0 0 24 24"
          width={20}
          height={20}
          style={I18nManager.isRTL ? styles.flip : undefined}
        >
          <Path
            d="M22 2 11 13"
            stroke={COLORS.cream}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M22 2 15 22l-4-9-9-4z"
            stroke={COLORS.cream}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.3)',
    backgroundColor: COLORS.cream,
    padding: SPACING.sm,
    shadowColor: COLORS.forest,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  inputBox: {
    flex: 1,
    position: 'relative',
  },
  input: {
    maxHeight: 120,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.ink,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  counter: {
    position: 'absolute',
    bottom: 2,
    ...(I18nManager.isRTL ? { left: 8 } : { right: 8 }),
    fontSize: 11,
    color: 'rgba(138,104,42,0.8)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.forest,
    shadowColor: COLORS.forest,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  sendButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  flip: {
    transform: [{ scaleX: -1 }],
  },
});
