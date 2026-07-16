import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface RealBookPageFlipProps {
  /** Current Mushaf page number (1–604); changes drive the auto flip. */
  pageNumber: number;
  currentPage: ReactNode;
  /** Rendered content of pageNumber + 1, revealed beneath a NEXT drag. */
  nextPage?: ReactNode;
  /** Rendered content of pageNumber - 1, revealed beneath a PREVIOUS drag. */
  previousPage?: ReactNode;
  onNextPage: () => void;
  onPreviousPage: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

type DragDirection = 'next' | 'previous';

/** A snapshot of the outgoing page while a button/jump auto-flip plays. */
interface AutoLeaf {
  node: ReactNode;
}

/** Drag distance (fraction of width) that commits the flip on release. */
const COMPLETE_RATIO = 0.28;
/** A flick this fast (px/ms) commits the flip even on a shorter drag… */
const FLICK_VELOCITY = 0.65;
/** …as long as it travelled at least this fraction of the width. */
const FLICK_MIN_RATIO = 0.06;
/** Blocked directions (page 1 / 604) drag with heavy resistance, capped. */
const RESIST = 0.12;
const RESIST_MAX = 32;
/** Leaf swing angle at full travel (deg) — paper-like, never cartoonish. */
const ANGLE = 18;
const PERSPECTIVE = 1200;
const AUTO_MS = 440;
const COMPLETE_MS = 260;
const RETURN_MS = 240;

// Web-only: stop mouse-drag flips from selecting Quran text mid-gesture.
const WEB_NO_SELECT: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ userSelect: 'none' } as unknown as ViewStyle) : undefined;

/** Soft gradient along one paper edge; fades in as the leaf turns that way. */
function EdgeShade({ side }: { side: 'left' | 'right' }) {
  const id = side === 'left' ? 'bookEdgeShadeL' : 'bookEdgeShadeR';
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient
          id={id}
          x1={side === 'left' ? '0' : '1'}
          y1="0"
          x2={side === 'left' ? '1' : '0'}
          y2="0"
        >
          <Stop offset="0" stopColor="#000" stopOpacity="0.2" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * A real, finger-driven page turn for a right-to-left Mushaf.
 *
 * The current page is a physical "leaf" lying on top of the book. An Arabic
 * book is bound on the RIGHT: advancing turns the leaf you just read from the
 * left side over onto the right-hand stack. So dragging RIGHT slides/turns
 * the leaf away to reveal the NEXT page already rendered beneath it, and
 * dragging LEFT brings you back to the PREVIOUS page — never Western/LTR book
 * logic. Release either commits the flip — the leaf glides off and the page
 * number changes — or eases the leaf back to rest if the pull was too small.
 * A fast flick commits even on a short drag. At page 1 / page 604 the blocked
 * direction only gives a heavily-resisted tug that always settles back, and
 * never changes the page.
 *
 * Button/jump navigation still animates: when `pageNumber` changes without a
 * gesture, a snapshot of the old page plays the same leaf motion
 * automatically, in the direction of travel.
 *
 * Built on core PanResponder + Animated (JS-driven, works identically in
 * Expo Go, Android, iOS and web) — no new native dependencies. The live page
 * element is never remounted by the flip; neighbours stay mounted beneath so
 * nothing has to load mid-drag.
 */
export default function RealBookPageFlip({
  pageNumber,
  currentPage,
  nextPage,
  previousPage,
  onNextPage,
  onPreviousPage,
  canGoNext,
  canGoPrevious,
}: RealBookPageFlipProps) {
  /** Leaf position in px: 0 at rest, positive (rightward) = turning to NEXT. */
  const drag = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(() => Dimensions.get('window').width);
  const [dragDir, setDragDir] = useState<DragDirection | null>(null);
  const [autoLeaf, setAutoLeaf] = useState<AutoLeaf | null>(null);

  // Mirrors so the once-created PanResponder always sees fresh values.
  const widthRef = useRef(width);
  const canNextRef = useRef(canGoNext);
  const canPrevRef = useRef(canGoPrevious);
  const pageRef = useRef(pageNumber);
  const onNextRef = useRef(onNextPage);
  const onPrevRef = useRef(onPreviousPage);
  const dirRef = useRef<DragDirection | null>(null);
  const autoLeafRef = useRef<AutoLeaf | null>(null);
  const startOffsetRef = useRef(0);
  /** Page number a just-committed gesture asked for (skips the auto flip). */
  const pendingPageRef = useRef<number | null>(null);
  const lastRef = useRef<{ page: number; node: ReactNode }>({ page: pageNumber, node: currentPage });

  widthRef.current = width;
  canNextRef.current = canGoNext;
  canPrevRef.current = canGoPrevious;
  pageRef.current = pageNumber;
  onNextRef.current = onNextPage;
  onPrevRef.current = onPreviousPage;
  autoLeafRef.current = autoLeaf;

  const panResponder = useRef(
    PanResponder.create({
      // Claim only clearly horizontal drags, so vertical scrolling on packed
      // pages keeps working; never claim while an auto flip is playing.
      onMoveShouldSetPanResponder: (_e, g) =>
        !autoLeafRef.current && Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderGrant: () => {
        // Catching a leaf mid-settle: continue from where it is.
        drag.stopAnimation((v) => {
          startOffsetRef.current = v;
        });
      },
      onPanResponderMove: (_e, g) => {
        const w = Math.max(widthRef.current, 1);
        let value = startOffsetRef.current + g.dx;
        // RTL Mushaf: right = forward (next), left = back (previous) — the
        // leaf turns onto the right-hand stack, as in a physical Arabic book.
        if (value > 0 && !canNextRef.current) {
          value = Math.min(value * RESIST, RESIST_MAX);
        } else if (value < 0 && !canPrevRef.current) {
          value = Math.max(value * RESIST, -RESIST_MAX);
        }
        value = Math.min(Math.max(value, -w), w);
        const dir: DragDirection | null = value > 0 ? 'next' : value < 0 ? 'previous' : null;
        if (dir !== dirRef.current) {
          dirRef.current = dir;
          setDragDir(dir);
        }
        drag.setValue(value);
      },
      onPanResponderRelease: (_e, g) => {
        const w = Math.max(widthRef.current, 1);
        const value = startOffsetRef.current + g.dx;
        const vx = g.vx;
        const commitNext =
          canNextRef.current &&
          (value > w * COMPLETE_RATIO || (value > w * FLICK_MIN_RATIO && vx > FLICK_VELOCITY));
        const commitPrev =
          canPrevRef.current &&
          (value < -w * COMPLETE_RATIO ||
            (value < -w * FLICK_MIN_RATIO && vx < -FLICK_VELOCITY));

        if (commitNext || commitPrev) {
          const target = commitNext ? w * 1.05 : -w * 1.05;
          const targetPage = pageRef.current + (commitNext ? 1 : -1);
          Animated.timing(drag, {
            toValue: target,
            duration: COMPLETE_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(({ finished }) => {
            if (!finished) return;
            // The new page is already fully revealed beneath the leaf; the
            // pageNumber change swaps it in seamlessly (see layout effect).
            pendingPageRef.current = targetPage;
            (commitNext ? onNextRef : onPrevRef).current();
          });
        } else {
          Animated.timing(drag, {
            toValue: 0,
            duration: RETURN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(({ finished }) => {
            if (finished) {
              dirRef.current = null;
              setDragDir(null);
            }
          });
        }
      },
      onPanResponderTerminate: () => {
        Animated.timing(drag, {
          toValue: 0,
          duration: RETURN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) {
            dirRef.current = null;
            setDragDir(null);
          }
        });
      },
    }),
  ).current;

  // Reacts to pageNumber changes BEFORE paint: a gesture-committed change is
  // finalised silently (its animation already played); a button/jump change
  // plays the same leaf motion automatically using a snapshot of the old page.
  useLayoutEffect(() => {
    const last = lastRef.current;
    lastRef.current = { page: pageNumber, node: currentPage };
    if (last.page === pageNumber) return undefined;

    if (pendingPageRef.current === pageNumber) {
      pendingPageRef.current = null;
      drag.setValue(0);
      dirRef.current = null;
      setDragDir(null);
      return undefined;
    }

    const dir: DragDirection = pageNumber > last.page ? 'next' : 'previous';
    const w = Math.max(widthRef.current, 1);
    dirRef.current = dir;
    setDragDir(dir);
    setAutoLeaf({ node: last.node });
    drag.setValue(0);
    const anim = Animated.timing(drag, {
      toValue: dir === 'next' ? w * 1.05 : -w * 1.05,
      duration: AUTO_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) {
        dirRef.current = null;
        setAutoLeaf(null);
        setDragDir(null);
      }
    });
    return () => anim.stop();
  }, [pageNumber, currentPage, drag]);

  // Once the auto-flip snapshot is gone from the tree, rest the leaf at 0 —
  // pre-paint, so the old page can never flash back at centre.
  useLayoutEffect(() => {
    if (autoLeaf === null) drag.setValue(0);
  }, [autoLeaf, drag]);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0 && next !== width) setWidth(next);
  };

  const w = Math.max(width, 1);
  const range = { inputRange: [-w, 0, w], extrapolate: 'clamp' as const };

  const leafStyle = {
    transform: [
      { perspective: PERSPECTIVE },
      { translateX: drag },
      {
        rotateY: drag.interpolate({
          ...range,
          outputRange: [`-${ANGLE}deg`, '0deg', `${ANGLE}deg`],
        }),
      },
      { scale: drag.interpolate({ ...range, outputRange: [0.965, 1, 0.965] }) },
    ],
    shadowOpacity: drag.interpolate({ ...range, outputRange: [0.28, 0, 0.28] }),
  };
  const leftShadeOpacity = drag.interpolate({ ...range, outputRange: [1, 0, 0] });
  const rightShadeOpacity = drag.interpolate({ ...range, outputRange: [0, 0, 1] });
  // The uncovered page settles as the leaf clears it — depth, not darkness.
  const underStyle = {
    transform: [{ scale: drag.interpolate({ ...range, outputRange: [1, 0.988, 1] }) }],
  };
  const veilOpacity = drag.interpolate({ ...range, outputRange: [0, 0.1, 0] });

  const turning = dragDir !== null || autoLeaf !== null;
  const showNextUnder = dragDir === 'next' && autoLeaf === null;
  const showPrevUnder = dragDir === 'previous' && autoLeaf === null;

  return (
    <View style={[styles.fill, WEB_NO_SELECT]} onLayout={onLayout} {...panResponder.panHandlers}>
      {/* Neighbouring pages stay mounted beneath the leaf, so the reveal is
          instant and nothing loads mid-drag. Only the active side shows. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, underStyle, !showNextUnder && styles.hidden]}
        pointerEvents="none"
      >
        {nextPage ?? null}
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, underStyle, !showPrevUnder && styles.hidden]}
        pointerEvents="none"
      >
        {previousPage ?? null}
      </Animated.View>

      {/* During a button/jump auto-flip the NEW page is the base layer. */}
      {autoLeaf !== null && (
        <Animated.View style={[StyleSheet.absoluteFill, underStyle]} pointerEvents="none">
          {currentPage}
        </Animated.View>
      )}

      {turning && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.veil, { opacity: veilOpacity }]}
          pointerEvents="none"
        />
      )}

      {/* The leaf: the page under the reader's finger. */}
      <Animated.View style={[styles.fill, styles.leaf, leafStyle]}>
        {autoLeaf !== null ? autoLeaf.node : currentPage}
        <Animated.View
          style={[styles.shadeStrip, styles.shadeLeft, { opacity: leftShadeOpacity }]}
          pointerEvents="none"
        >
          <EdgeShade side="left" />
        </Animated.View>
        <Animated.View
          style={[styles.shadeStrip, styles.shadeRight, { opacity: rightShadeOpacity }]}
          pointerEvents="none"
        >
          <EdgeShade side="right" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { opacity: 0 },
  veil: { backgroundColor: '#000' },
  leaf: {
    shadowColor: '#000',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  shadeStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 56,
  },
  shadeLeft: { left: 0 },
  shadeRight: { right: 0 },
});
