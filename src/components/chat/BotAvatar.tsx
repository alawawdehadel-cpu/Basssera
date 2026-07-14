import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';

/** Small gold-star medallion identifying bot messages. */
export default function BotAvatar() {
  return (
    <View style={styles.wrapper}>
      <Svg viewBox="0 0 14 14" width={14} height={14}>
        <Path
          d="M7 0l1.8 3.6L12.6 2 11 5.8 14 7l-3 1.2 1.6 3.8-3.8-1.6L7 14l-1.8-3.6L1.4 12 3 8.2 0 7l3-1.2L1.4 2l3.8 1.6z"
          fill={COLORS.gold}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.forest,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.4)',
    flexShrink: 0,
  },
});
