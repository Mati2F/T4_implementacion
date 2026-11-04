import { useState } from "react";
import { Button, Dialog, Field, Input, Portal, Stack, Text, Textarea } from "@chakra-ui/react";
import { gql, M } from "../api.js";
import { formatDateTime, toLocalInputValue } from "../utils.js";
import { toaster } from "../toaster.jsx";

function Form({ user, channel, onScheduled }) {
  const [text, setText] = useState("");
  const [at, setAt] = useState(() => toLocalInputValue(new Date(Date.now() + 10 * 60_000)));
  const [error, setError] = useState(null); // { field: "text" | "date" | "server", message }
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return setError({ field: "text", message: "Escribe el mensaje que quieres programar." });
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return setError({ field: "date", message: "Elige una fecha y hora." });
    if (date.getTime() <= Date.now()) return setError({ field: "date", message: "La fecha debe estar en el futuro." });

    setLoading(true);
    setError(null);
    try {
      await gql(M.scheduleMessage, { channelId: channel.id, authorId: user.id, content, at: date.toISOString() });
      toaster.create({
        title: "Mensaje programado",
        description: `Se enviará a #${channel.name} el ${formatDateTime(date)}.`,
        type: "success",
      });
      onScheduled();
    } catch (err) {
      setError({ field: "server", message: err.message });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="4">
        <Field.Root invalid={error?.field === "text"}>
          <Field.Label>Mensaje para #{channel.name}</Field.Label>
          <Textarea
            autoFocus
            rows={4}
            maxLength={4000}
            resize="none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe el mensaje que se enviará más tarde"
            aria-label="Mensaje a programar"
          />
          {error?.field === "text" && <Field.ErrorText>{error.message}</Field.ErrorText>}
        </Field.Root>
        <Field.Root invalid={error?.field === "date"}>
          <Field.Label>Enviar el</Field.Label>
          <Input type="datetime-local" value={at} min={toLocalInputValue(new Date())} onChange={(e) => setAt(e.target.value)} />
          {error?.field === "date" ? <Field.ErrorText>{error.message}</Field.ErrorText> : <Field.HelperText>Hora local de tu navegador.</Field.HelperText>}
        </Field.Root>
        {error?.field === "server" && <Text fontSize="sm" color="fg.error">{error.message}</Text>}
        <Button type="submit" colorPalette="blue" loading={loading}>Programar</Button>
      </Stack>
    </form>
  );
}

export default function ScheduleDialog({ open, onClose, ...formProps }) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center" lazyMount unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>Programar mensaje</Dialog.Title></Dialog.Header>
            <Dialog.Body pb="6"><Form {...formProps} /></Dialog.Body>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
