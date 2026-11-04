import { useState } from "react";
import { Box, Flex, IconButton, Textarea } from "@chakra-ui/react";
import { gql, M } from "../api.js";
import { AttachmentIcon, ClockIcon, SendIcon } from "../icons.jsx";
import { toaster } from "../toaster.jsx";
import ScheduleDialog from "./ScheduleDialog.jsx";

export default function Composer({ user, channel, onSent, onScheduled, onAttach }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const content = draft.trim();
  const canSubmit = content.length > 0 && !sending;

  const send = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      await gql(M.sendMessage, { channelId: channel.id, authorId: user.id, content });
      setDraft("");
      onSent();
    } catch (err) {
      toaster.create({ title: "No se pudo enviar el mensaje", description: err.message, type: "error" });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <Box px="4" pb="4" pt="2">
      <Flex gap="2" wrap="wrap" align="flex-end" borderWidth="1px" borderRadius="lg" p="2" bg="bg.panel">
        <Textarea
          variant="subtle"
          rows={2}
          maxLength={4000}
          resize="none"
          placeholder={`Escribe en #${channel.name}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Mensaje"
          flex="1"
          minW="0"
          w={{ base: "full", md: "auto" }}
          flexBasis={{ base: "100%", md: "0" }}
        />
        <IconButton aria-label="Subir archivos al canal" title="Subir archivos y ver adjuntos" variant="outline" onClick={onAttach}>
          <AttachmentIcon />
        </IconButton>
        <IconButton
          aria-label="Programar mensaje"
          title="Programar envío"
          variant="outline"
          onClick={() => setScheduleOpen(true)}
        >
          <ClockIcon />
        </IconButton>
        <IconButton aria-label="Enviar mensaje" title="Enviar (Enter)" colorPalette="blue" disabled={!canSubmit} loading={sending} onClick={send}>
          <SendIcon />
        </IconButton>
      </Flex>

      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        user={user}
        channel={channel}
        onScheduled={() => {
          setScheduleOpen(false);
          onScheduled?.();
        }}
      />
    </Box>
  );
}
