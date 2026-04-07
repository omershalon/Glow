import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Shadows } from '@/lib/theme';
import type { RankedItem } from '@/lib/database.types';

interface PickCardProps {
  item: RankedItem;
  isInRoutine: boolean;
  onPress: (item: RankedItem) => void;
  onToggleRoutine: (item: RankedItem) => void;
}

export default function PickCard({ item, isInRoutine, onPress, onToggleRoutine }: PickCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => onPress(item)}
    >
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{item.rationale}</Text>
      </View>

      <Text style={styles.chevron}>{'\u203A'}</Text>

      <TouchableOpacity
        style={[styles.addButton, isInRoutine && styles.addButtonActive]}
        activeOpacity={0.7}
        onPress={(e) => {
          e.stopPropagation?.();
          onToggleRoutine(item);
        }}
      >
        <Text style={[styles.addIcon, isInRoutine && styles.addIconActive]}>
          {isInRoutine ? '\u2713' : '+'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 18,
    marginBottom: 10,
    gap: 10,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: '#9B9488',
    letterSpacing: 0.1,
  },
  chevron: {
    fontSize: 22,
    color: '#C4BDB0',
    fontWeight: '300',
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EDE8DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonActive: {
    backgroundColor: '#2D4A3E',
  },
  addIcon: {
    fontSize: 20,
    color: '#8A8A7A',
    fontWeight: '400',
  },
  addIconActive: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
