import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import AppHeader from '../src/components/ui/AppHeader';
import ChatScreen from '../src/components/chat/ChatScreen';
import { COLORS } from '../src/constants/colors';
import { SPACING } from '../src/constants/spacing';
import { useAppLanguage } from '../src/hooks/useAppLanguage';
import { useChat } from '../src/hooks/useChat';
import type { DataStatus } from '../src/types/data.types';
import { loadTafseerData } from '../src/utils/dataLoader';

function BackIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18}>
      <Path
        d="M15 18l-6-6 6-6"
        stroke={COLORS.cream}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function ClearIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16}>
      <Path
        d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"
        stroke={COLORS.cream}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function ChatRoute() {
  const { lang, strings } = useAppLanguage();
  const [dataStatus, setDataStatus] = useState<DataStatus>('loading');
  const { messages, isTyping, streamingId, finishStreaming, send, clear } = useChat(
    lang,
    strings.rateLimit,
  );

  useEffect(() => {
    let mounted = true;
    loadTafseerData()
      .then(() => mounted && setDataStatus('ready'))
      .catch(() => mounted && setDataStatus('error'));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.headerWrap}>
        <AppHeader
          title={strings.appTitle}
          subtitle={strings.appSubtitle}
          right={
            <>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel={strings.navHome}
                style={styles.iconButton}
              >
                <BackIcon />
              </Pressable>
              {messages.length > 0 && (
                <Pressable
                  onPress={clear}
                  accessibilityRole="button"
                  accessibilityLabel={strings.clearChat}
                  style={styles.iconButton}
                >
                  <ClearIcon />
                </Pressable>
              )}
            </>
          }
        />
      </View>

      <View style={styles.body}>
        <ChatScreen
          messages={messages}
          isTyping={isTyping}
          streamingId={streamingId}
          dataStatus={dataStatus}
          strings={strings}
          onSend={send}
          onStreamDone={finishStreaming}
        />
      </View>

      <Text style={styles.footer}>{strings.footer}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.parchment,
  },
  headerWrap: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,253,246,0.2)',
  },
  body: {
    flex: 1,
    paddingTop: SPACING.sm,
  },
  footer: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.sm,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: 'center',
    color: 'rgba(41,51,46,0.7)',
  },
});
