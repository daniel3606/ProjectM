import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput } from "react-native";
import Theme from "@/constants/theme";
import { Button } from "@/components/ui";

interface NameGateModalProps {
  visible: boolean;
  marshmallowName: string;
  title: string;
  subtitle: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Generic "type the marshmallow's name to proceed" gate. Used to make
 * disruptive block actions (ending, editing) deliberate rather than a stray
 * tap — see `EndSessionConfirmModal` and the "Edit Block" flows.
 */
export default function NameGateModal({
  visible,
  marshmallowName,
  title,
  subtitle,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: NameGateModalProps) {
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    if (visible) setTypedName("");
  }, [visible]);

  const isMatch = typedName === marshmallowName;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

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
            variant={confirmVariant}
            label={confirmLabel}
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
