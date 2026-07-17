import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EvidenceCard from '../../src/components/basirah/EvidenceCard';
import Icon from '../../src/components/basirah/Icon';
import { Press } from '../../src/components/basirah/primitives';
import { useToast } from '../../src/components/basirah/Toast';
import Txt from '../../src/components/basirah/Txt';
import { useAssistant, type AssistantTurn } from '../../src/hooks/useAssistant';
import { useUserData } from '../../src/hooks/useUserData';
import { toArabicDigits } from '../../src/utils/numerals';
import { FONT } from '../../src/theme/fonts';
import { useTheme } from '../../src/theme/ThemeContext';
import { LAYOUT } from '../../src/theme/tokens';

const SUGGESTED = [
  'ما معنى قوله تعالى في سورة الرعد؟',
  'أعطني آيات عن الصبر',
  'ما الفرق بين التفسير والترجمة؟',
  'اشرح لي موضوع سورة الملك باختصار',
];

const FOLLOWUPS = ['كيف أتدبر هذه الآيات؟', 'اذكر آية أخرى في الموضوع'];

/** Pulsing three-dot thinking indicator. */
function ThinkingDots() {
  const { colors } = useTheme();
  const dots = [useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current];

  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(d, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.25, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay((2 - i) * 200),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.emerald, opacity: d, transform: [{ scale: d }] }}
          />
        ))}
      </View>
      <Txt size={12.5} color={colors.text2}>
        أبحث في المصادر الموثّقة...
      </Txt>
    </View>
  );
}

/** Pulsing ring around the spark logo in the assistant header. */
function PulsingSpark() {
  const { colors } = useTheme();
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [ring]);
  return (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 44,
          height: 44,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: colors.gold,
          opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.6] }) }],
        }}
      />
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.emerald,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="spark" size={22} color="#DFC96C" strokeWidth={1.8} />
      </View>
    </View>
  );
}

function AnswerBlock({ turn }: { turn: AssistantTurn }) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { saveAnswer } = useUserData();
  const answer = turn.answer!;

  const feedbackRow = (
    <View style={{ flexDirection: 'row', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Press
        onPress={() => showToast('شكرًا لتقييمك')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Icon name="thumbUp" size={14} color={colors.text} strokeWidth={1.8} />
        <Txt size={11.5} weight={600} color={colors.text}>
          مفيد
        </Txt>
      </Press>
      <Press
        onPress={() => showToast('شكرًا لملاحظتك')}
        accessibilityLabel="غير مفيد"
        style={{
          width: 38,
          height: 36,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="thumbDown" size={14} color={colors.text2} strokeWidth={1.8} />
      </Press>
      <Press
        onPress={async () => {
          try {
            await Clipboard.setStringAsync(answer.summary);
            showToast('تم النسخ');
          } catch {
            showToast('تعذّر النسخ');
          }
        }}
        accessibilityLabel="نسخ"
        style={{
          width: 38,
          height: 36,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="copy" size={14} color={colors.text2} strokeWidth={1.7} />
      </Press>
      <Press
        onPress={() => {
          saveAnswer(turn.question, answer.summary);
          showToast('حُفظت الإجابة');
        }}
        accessibilityLabel="حفظ"
        style={{
          width: 38,
          height: 36,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="bookmark" size={14} color={colors.text2} strokeWidth={1.8} />
      </Press>
    </View>
  );

  return (
    <View>
      {/* شرح مساعد */}
      <View
        style={{
          padding: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          marginBottom: 14,
        }}
      >
        <Txt size={10} weight={700} color={colors.gold} style={{ marginBottom: 8 }}>
          شرح مساعد
        </Txt>
        {answer.title ? (
          <Txt size={14} weight={700} color={colors.text} style={{ marginBottom: 6 }}>
            {toArabicDigits(answer.title)}
          </Txt>
        ) : null}
        <Txt size={14} lh={1.9} color={colors.text}>
          {toArabicDigits(answer.summary)}
        </Txt>
        {answer.safetyNote ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 12,
              padding: 11,
              borderRadius: 12,
              backgroundColor: colors.goldTint,
              borderWidth: 1,
              borderColor: colors.gold,
            }}
          >
            <Icon name="info" size={15} color={colors.gold} strokeWidth={1.8} />
            <Txt size={11.5} lh={1.6} color={colors.text2} style={{ flex: 1 }}>
              {answer.safetyNote}
            </Txt>
          </View>
        ) : null}
      </View>

      {/* الأدلة القرآنية */}
      {answer.quranReferences.length > 0 ? (
        <>
          <Txt size={12} weight={700} color={colors.text2} style={{ marginBottom: 10 }}>
            الأدلة القرآنية
          </Txt>
          <View style={{ gap: 12, marginBottom: 18 }}>
            {answer.quranReferences.map((ref, i) => (
              <EvidenceCard key={`${ref.surah}-${ref.ayah}-${i}`} reference={ref} index={i} />
            ))}
          </View>
        </>
      ) : null}

      {/* tafsir excerpt(s) */}
      {answer.tafsirReferences.length > 0 ? (
        <View style={{ marginBottom: 18 }}>
          <Txt size={12} weight={700} color={colors.text2} style={{ marginBottom: 10 }}>
            من تفسير السعدي
          </Txt>
          {answer.tafsirReferences.map((ref, i) => (
            <View
              key={i}
              style={{
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Txt size={13} lh={1.9} color={colors.text2} style={{ textAlign: 'justify' }}>
                {toArabicDigits(ref.excerpt)}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      {feedbackRow}
    </View>
  );
}

export default function AssistantScreen() {
  const params = useLocalSearchParams<{ ask?: string }>();
  const { colors } = useTheme();
  const { turns, thinking, ask } = useAssistant();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const lastAsked = useRef<string | null>(null);

  // Deep-link: a question passed from tafsir/search/verse-sheet.
  useEffect(() => {
    if (params.ask && params.ask !== lastAsked.current) {
      lastAsked.current = params.ask;
      ask(params.ask);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.ask]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [turns, thinking]);

  const submit = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    ask(q);
    setInput('');
  };

  const hasConversation = turns.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          paddingHorizontal: LAYOUT.screenX,
          paddingTop: 8,
          paddingBottom: 14,
          borderBottomWidth: hasConversation ? 1 : 0,
          borderBottomColor: colors.border,
        }}
      >
        <PulsingSpark />
        <View>
          <Txt size={22} weight={700} color={colors.text}>
            اسأل بصيرة
          </Txt>
          <Txt size={11.5} color={colors.emerald}>
            ● متّصل • إجابات مرتبطة بالمصادر
          </Txt>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingTop: 16, paddingBottom: 20, flexGrow: 1 }}
      >
        {!hasConversation ? (
          <>
            <View
              style={{
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                marginBottom: 16,
              }}
            >
              <Txt size={19} weight={700} amiri color={colors.emerald} style={{ marginBottom: 6 }}>
                مرحبًا بك
              </Txt>
              <Txt size={14} lh={1.8} color={colors.text2}>
                كيف يمكنني مساعدتك في فهم القرآن اليوم؟
              </Txt>
            </View>

            <View style={{ gap: 10, marginBottom: 16 }}>
              {SUGGESTED.map((q) => (
                <Press
                  key={q}
                  onPress={() => submit(q)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Txt size={13.5} color={colors.text} style={{ flex: 1 }}>
                    {q}
                  </Txt>
                  <Icon name="arrowGo" size={16} color={colors.emerald} strokeWidth={2} />
                </Press>
              ))}
            </View>
          </>
        ) : (
          <View style={{ gap: 16 }}>
            {turns.map((turn) => (
              <View key={turn.id} style={{ gap: 16 }}>
                {/* user bubble — right aligned per RTL */}
                <View style={{ alignItems: 'flex-start' }}>
                  <View
                    style={{
                      maxWidth: '82%',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 16,
                      borderBottomRightRadius: 4,
                      backgroundColor: colors.emerald,
                    }}
                  >
                    <Txt size={13.5} lh={1.6} color="#fff">
                      {turn.question}
                    </Txt>
                  </View>
                </View>
                {turn.answer ? <AnswerBlock turn={turn} /> : null}
              </View>
            ))}
            {thinking ? <ThinkingDots /> : null}

            {/* follow-up chips after the latest answered turn */}
            {!thinking && turns[turns.length - 1]?.answer ? (
              <View style={{ gap: 8 }}>
                <Txt size={12} weight={700} color={colors.text2}>
                  أسئلة مقترحة للمتابعة
                </Txt>
                {FOLLOWUPS.map((f) => (
                  <Press
                    key={f}
                    onPress={() => submit(f)}
                    style={{
                      paddingVertical: 11,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: colors.emerald,
                    }}
                  >
                    <Txt size={12.5} color={colors.emerald}>
                      {f}
                    </Txt>
                  </Press>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {!hasConversation ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 9,
                padding: 13,
                borderRadius: 14,
                backgroundColor: colors.goldTint,
                borderWidth: 1,
                borderColor: colors.gold,
                marginTop: 'auto',
              }}
            >
              <Icon name="info" size={16} color={colors.gold} strokeWidth={1.8} />
              <Txt size={11.5} lh={1.7} color={colors.text2} style={{ flex: 1 }}>
                يقدّم المساعد إجابات تعليمية مرتبطة بالمصادر، ولا يُعد بديلًا عن سؤال أهل العلم في الفتاوى
                والمسائل الشرعية الخاصة.
              </Txt>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* composer */}
      <View style={{ paddingHorizontal: LAYOUT.screenX, paddingBottom: 10, paddingTop: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 8,
            borderRadius: 18,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              backgroundColor: colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="attach" size={18} color={colors.emerald} strokeWidth={1.7} />
          </View>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => submit()}
            returnKeyType="send"
            placeholder="اكتب سؤالك هنا..."
            placeholderTextColor={colors.text2}
            style={{
              flex: 1,
              fontFamily: FONT.ui400,
              fontSize: 13,
              color: colors.text,
              textAlign: 'right',
              paddingVertical: 0,
            }}
          />
          <Press
            onPress={() => submit()}
            accessibilityLabel="إرسال"
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              backgroundColor: colors.emerald,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="send" size={19} color="#fff" />
          </Press>
        </View>
      </View>
    </SafeAreaView>
  );
}
