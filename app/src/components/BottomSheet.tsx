import React, { ReactNode } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, spacing } from '../theme/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  contentStyle,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, contentStyle]}>
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.borderSubtle,
  },
});
