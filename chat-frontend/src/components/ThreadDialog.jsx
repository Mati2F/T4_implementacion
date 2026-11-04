import { useEffect, useRef, useState } from "react";
import { Box, Button, Center, Dialog, Portal, Spinner, Stack, Text, Textarea } from "@chakra-ui/react";
import { gql, M, Q } from "../api.js";
import { usePolling } from "../hooks.js";
import { formatMessageTime } from "../utils.js";

function Thread({ message, channel, user }) {
  const [replies, setReplies] = useState(null);
  const [error, setError] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const active = useRef(true);
  const sendingRef = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const refresh = usePolling(async (cancelled) => {
    try {
      const data = await gql(Q.replies, { channelId: channel.id, messageId: message.id });
      if (cancelled() || !active.current) return;
      setReplies(data.replies);
      setError(null);
    } catch (err) {
      if (!cancelled() && active.current) setError(err.message);
    }
  }, 4000, true, message.id);

  const send = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    try {
      const data = await gql(M.createReply, {
        channelId: channel.id, messageId: message.id, authorId: user.id, content,
      });
      if (!active.current) return;
      setDraft("");
      setReplies((previous) => [...(previous ?? []).filter((item) => item.id !== data.createReply.id), data.createReply]);
      refresh();
    } catch (err) {
      if (active.current) setSendError(err.message);
    } finally {
      sendingRef.current = false;
      if (active.current) setSending(false);
    }
  };

  return (
    <Stack gap="4">
      <Box borderWidth="1px" borderRadius="md" p="3" bg="bg.subtle">
        <Text fontSize="xs" color="fg.muted">Mensaje principal · #{channel.name}</Text>
        <Text fontWeight="semibold">{message.author?.displayName ?? "Usuario desconocido"}</Text>
        <Text whiteSpace="pre-wrap" wordBreak="break-word">{message.content}</Text>
      </Box>
      <Text fontWeight="semibold">Respuestas{replies ? ` (${replies.length})` : ""}</Text>
      {replies === null && !error && <Center py="4"><Spinner /></Center>}
      {error && <Box role="alert"><Text color="fg.error">{error}</Text><Button size="sm" variant="outline" onClick={refresh}>Reintentar</Button></Box>}
      {replies?.length === 0 && <Text color="fg.muted">Aún no hay respuestas. Puedes escribir la primera.</Text>}
      <Stack gap="3" role="log" aria-live="polite">
        {replies?.map((item) => (
          <Box key={item.id} borderLeftWidth="2px" pl="3">
            <Text fontWeight="semibold" fontSize="sm">{item.author?.displayName ?? "Usuario desconocido"}{item.author?.id === user.id ? " · Tú" : ""}</Text>
            <Text fontSize="xs" color="fg.muted">{formatMessageTime(item.createdAt)}</Text>
            <Text whiteSpace="pre-wrap" wordBreak="break-word">{item.content}</Text>
          </Box>
        ))}
      </Stack>
      <form onSubmit={send}>
        <Stack gap="2">
          <Textarea aria-label="Respuesta al mensaje principal" placeholder="Responde al mensaje principal…" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} rows={3} disabled={sending} />
          <Text fontSize="xs" color="fg.muted">Las respuestas se guardan en este hilo, sin respuestas anidadas.</Text>
          {sendError && <Text role="alert" color="fg.error">{sendError}</Text>}
          <Button type="submit" colorPalette="blue" disabled={!draft.trim() || sending} loading={sending}>Enviar respuesta</Button>
        </Stack>
      </form>
    </Stack>
  );
}

export default function ThreadDialog({ message, channel, user, onClose }) {
  return (
    <Dialog.Root open={!!message} onOpenChange={(event) => !event.open && onClose()} placement="center" scrollBehavior="inside" lazyMount unmountOnExit>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>Respuestas al mensaje</Dialog.Title></Dialog.Header>
        <Dialog.Body pb="6">{message && <Thread key={message.id} message={message} channel={channel} user={user} />}</Dialog.Body>
        <Dialog.Footer><Button variant="outline" onClick={onClose}>Cerrar</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  );
}
