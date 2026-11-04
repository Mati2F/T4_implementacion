import { useState } from "react";
import { Button, Dialog, Field, Input, Portal, Stack } from "@chakra-ui/react";
import { gql, M } from "../api.js";

function Form({ onCreated }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return setError("Escribe un nombre para el canal.");
    setLoading(true);
    setError("");
    try {
      const data = await gql(M.createChannel, { name: value });
      onCreated(data.createChannel);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="4">
        <Field.Root invalid={!!error}>
          <Field.Label>Nombre del canal</Field.Label>
          <Input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="general" />
          {error && <Field.ErrorText>{error}</Field.ErrorText>}
        </Field.Root>
        <Button type="submit" colorPalette="blue" loading={loading}>Crear canal</Button>
      </Stack>
    </form>
  );
}

export default function CreateChannelDialog({ open, onClose, onCreated }) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center" lazyMount unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>Nuevo canal</Dialog.Title></Dialog.Header>
            <Dialog.Body pb="6"><Form onCreated={onCreated} /></Dialog.Body>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
