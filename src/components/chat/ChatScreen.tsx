import { useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import type { ChatMessage as ChatMessageType } from '../../types/chat.types';
import type { DataStatus } from '../../types/data.types';
import type { UIStrings } from '../../utils/strings';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import SuggestedQuestions from './SuggestedQuestions';
import EmptyState from '../ui/EmptyState';
import Alert from '../ui/Alert';
import { SPACING } from '../../constants/spacing';

interface ChatScreenProps {
  messages: ChatMessageType[];
  isTyping: boolean;
  streamingId: string | null;
  dataStatus: DataStatus;
  strings: UIStrings;
  onSend: (text: string) => void;
  onStreamDone: () => void;
}

type ListItem =
  | { kind: 'message'; message: ChatMessageType }
  | { kind: 'typing' };

export default function ChatScreen({
  messages,
  isTyping,
  streamingId,
  dataStatus,
  strings,
  onSend,
  onStreamDone,
}: ChatScreenProps) {
  const listRef = useRef<FlatList<ListItem>>(null);
  const isEmpty = messages.length === 0;

  const data: ListItem[] = [
    ...messages.map((message): ListItem => ({ kind: 'message', message })),
    ...(isTyping ? [{ kind: 'typing' } as ListItem] : []),
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.flex}>
        {dataStatus === 'loading' && (
          <View style={styles.banner}>
            <Alert variant="info">{strings.dataLoading}</Alert>
          </View>
        )}
        {dataStatus === 'error' && (
          <View style={styles.banner}>
            <Alert variant="error">{strings.dataError}</Alert>
          </View>
        )}

        {isEmpty ? (
          <View style={styles.emptyWrapper}>
            <EmptyState welcome={strings.welcome} hint={strings.welcomeHint} />
            <SuggestedQuestions
              title={strings.suggestedTitle}
              categories={strings.suggestionCategories}
              onSelect={onSend}
              disabled={isTyping}
            />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(item, i) => (item.kind === 'message' ? item.message.id : `typing-${i}`)}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) =>
              item.kind === 'typing' ? (
                <View style={styles.itemSpacing}>
                  <TypingIndicator label={strings.typing} />
                </View>
              ) : (
                <View style={styles.itemSpacing}>
                  <ChatBubble
                    message={item.message}
                    strings={strings}
                    isStreaming={item.message.id === streamingId}
                    onStreamDone={onStreamDone}
                  />
                </View>
              )
            }
          />
        )}
      </View>

      <View style={styles.inputBar}>
        <ChatInput
          placeholder={strings.inputPlaceholder}
          sendLabel={strings.send}
          charCount={strings.charCount}
          onSend={onSend}
          disabled={isTyping}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  banner: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  itemSpacing: {
    marginBottom: SPACING.sm,
  },
  inputBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(178,138,62,0.2)',
    backgroundColor: 'rgba(246,240,225,0.6)',
    padding: SPACING.md,
  },
});
