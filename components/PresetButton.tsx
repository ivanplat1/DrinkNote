import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { PresetDrink } from '../types/preset';

type Props = {
  preset: PresetDrink;
  onPress: (preset: PresetDrink) => void;
};

export default function PresetButton({ preset, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.button} onPress={() => onPress(preset)}>
      <Text style={styles.text}>{preset.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
  },
});


