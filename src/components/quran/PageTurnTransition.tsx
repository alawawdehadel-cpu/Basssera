import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

export type PageTurnDirection = 'next' | 'previous' | 'none';

interface PageTurnTransitionProps {
  /** Current page; a change triggers the turn animation. */
  pageNumber: number;
  /** Travel direction, so the swing pivots the correct way. */
  direction: PageTurnDirection;
  children: ReactNode;
}

const DURATION = 460;
/** Horizontal slide distance (px) of the incoming page. */
const SHIFT = 46;
/** Page-swing angle (deg). Modest so it reads as a turn, never glitchy. */
const ANGLE = 22;
/** 3D depth for the swing; without perspective rotateY looks flat. */
const PERSPECTIVE = 1000;

/**
 * Wraps the Mushaf page content and plays a paper-turn each time `pageNumber`
 * changes: the incoming page swings in on a hinge at the leading edge
 * (transformOrigin) with perspective rotateY, slides from that edge, lifts and
 * settles (scale) and fades — so it reads like a real leaf being turned. It
 * never remounts its children — only the animated wrapper updates — so scroll
 * position and state survive the turn.
 *
 * Direction pairs with the swipe/buttons: NEXT swings in from the right edge,
 * PREVIOUS mirrors it, and "none" (initial mount / deep link) is a calm
 * fade-in with no swing.
 *
 * rotateY + perspective + transformOrigin are supported on iOS, Android (Expo
 * Go) and web; the modest angle keeps it stable. If a device ever renders the
 * swing poorly, dropping the rotateY transform still leaves a clean
 * slide/scale/fade.
 */
export default function PageTurnTransition({
  pageNumber,
  direction,
  children,
}: PageTurnTransitionProps) {
  const progress = useRef(new Animated.Value(0)).current;

  // useLayoutEffect resets to 0 BEFORE paint, so the new page never flashes at
  // full opacity before animating in.
  useLayoutEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      // Native driver isn't supported on web; fall back to JS-driven there.
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [pageNumber, progress]);

  const swing = direction === 'next' ? 1 : direction === 'previous' ? -1 : 0;
  const startX = swing * SHIFT;
  const startDeg = `${swing * ANGLE}deg`;
  // Hinge the swing on the edge the page turns from.
  const transformOrigin = swing > 0 ? '100% 50%' : swing < 0 ? '0% 50%' : '50% 50%';

  const animatedStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.2, 0.9, 1] }),
    transformOrigin,
    transform: [
      { perspective: PERSPECTIVE },
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [startX, 0] }) },
      { rotateY: progress.interpolate({ inputRange: [0, 1], outputRange: [startDeg, '0deg'] }) },
      // slight lift-and-settle for a tactile paper feel
      { scale: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.955, 1.006, 1] }) },
    ],
  };

  return <Animated.View style={[styles.fill, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
