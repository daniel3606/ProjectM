import React from "react";
import NameGateModal from "@/components/NameGateModal";

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
export default function EndSessionConfirmModal(props: EndSessionConfirmModalProps) {
  return (
    <NameGateModal
      {...props}
      title="End Focus Session?"
      subtitle="Type in your marshmallow's name to end focus session"
      confirmLabel="End Focus Session"
      confirmVariant="danger"
    />
  );
}
