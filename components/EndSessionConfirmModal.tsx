import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Theme from "@/constants/theme";
import { Button } from "@/components/ui";

interface EndSessionConfirmModalProps {
  visible: boolean;
  marshmallowName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation gate for ending a focus session early — requires typing the
 * marshmallow's exact name so ending a block is a deliberate action, not a
 * stray tap.
 */
export default function EndSessionConfirmModal({
  visible,
  marshmallowName,
  onConfirm,
  onCancel,
}: EndSessionConfirmModalProps) {
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    if (visible) setTypedName("");
  }, [visible]);

  const isMatch = typedName === marshmallowName;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>End Focus Session?</Text>
          <Text style={styles.subtitle}>
            Type in your marshmallow&apos;s name to end focus session
          </Text>

          <TextInput
            style={styles.input}
            placeholder={marshmallowName}
            placeholderTextColor={Theme.colors.gray}
            value={typedName}
            onChangeText={setTypedName}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />

          <Button
            variant="danger"
            label="End Focus Session"
            onPress={onConfirm}
            disabled={!isMatch}
            style={styles.confirmButton}
          />
          <Button variant="ghost" label="Cancel" onPress={onCancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    backgroundColor: Theme.colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    backgroundColor: Theme.colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    textAlign: "center",
    marginBottom: 16,
  },
  confirmButton: {
    width: "100%",
    marginBottom: 4,
  },
});
