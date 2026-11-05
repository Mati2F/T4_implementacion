import { useEffect, useRef, useState } from "react";
import { Avatar, Badge, Box, Button, Center, Flex, Heading, HStack, IconButton, Spinner, Stack, Text, Textarea } from "@chakra-ui/react";
import { gql, M, Q } from "../api.js";
import { usePolling } from "../hooks.js";
import { ACTIVE_STATUSES, formatMessageTime } from "../utils.js";
import { AttachmentIcon, BackIcon, CalendarIcon, HashIcon, ReplyIcon } from "../icons.jsx";
import Composer from "./Composer.jsx";
import ScheduledDialog from "./ScheduledDialog.jsx";
import AttachmentsDialog from "./AttachmentsDialog.jsx";
import AttachmentItem from "./AttachmentItem.jsx";

const MESSAGES_POLL_MS = 3_000;
const SCHEDULED_POLL_MS = 5_000;

function MessageItem({ message, mine, user, channel, onReplied }) {
  const name = message.author?.displayName ?? "Usuario desconocido";
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [replies, setReplies] = useState([]);

  useEffect(() => {
    let cancelled = false;
    gql(Q.replies, { channelId: channel.id, messageId: message.id })
      .then((data) => {
        if (!cancelled) setReplies(data.replies);
      })
      // El chat sigue funcionando si Threads aún no está disponible.
      .catch(() => {
        if (!cancelled) setReplies([]);
      });
    return () => { cancelled = true; };
  }, [channel.id, message.id]);

  const sendReply = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await gql(M.createReply, {
        channelId: channel.id,
        messageId: message.id,
        authorId: user.id,
        content,
      });
      setDraft("");
      setReplyOpen(false);
      setReplies((current) => [...current, data.createReply]);
      onReplied();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Flex gap="3" align="flex-start" px="4" py="2" _hover={{ bg: "bg.subtle" }}>
      <Avatar.Root size="sm" colorPalette={mine ? "blue" : "gray"}>
        <Avatar.Fallback name={name} />
      </Avatar.Root>
      <Box minW="0">
        <HStack gap="2" wrap="wrap">
          <Text fontWeight="semibold">{name}</Text>
          {mine && <Badge colorPalette="blue" size="xs">Tú</Badge>}
          <Text fontSize="xs" color="fg.muted">{formatMessageTime(message.createdAt)}</Text>
        </HStack>
        <Text whiteSpace="pre-wrap" wordBreak="break-word">{message.content}</Text>
        <HStack gap="1" mt="1">
          <Button size="xs" variant="ghost" onClick={() => setReplyOpen((open) => !open)} aria-expanded={replyOpen} aria-label={`Responder al mensaje de ${name}`}>
            <ReplyIcon boxSize="3" /> Responder
          </Button>
          {replies.length > 0 && <Text fontSize="xs" color="fg.muted">{replies.length} {replies.length === 1 ? "respuesta" : "respuestas"}</Text>}
        </HStack>

        {replies.length > 0 && (
          <Stack gap="2" mt="2" pl="3" borderLeftWidth="2px" borderColor="border.emphasized">
            {replies.map((reply) => {
              const replyName = reply.author?.displayName ?? "Usuario desconocido";
              return (
                <Box key={reply.id}>
                  <HStack gap="2" wrap="wrap">
                    <Text fontWeight="semibold" fontSize="sm">{replyName}</Text>
                    {reply.author?.id === user.id && <Badge colorPalette="blue" size="xs">Tú</Badge>}
                    <Text fontSize="xs" color="fg.muted">{formatMessageTime(reply.createdAt)}</Text>
                  </HStack>
                  <Text whiteSpace="pre-wrap" wordBreak="break-word">{reply.content}</Text>
                </Box>
              );
            })}
          </Stack>
        )}

        {replyOpen && (
          <Box as="form" mt="2" onSubmit={sendReply}>
            <Stack gap="2">
              <Textarea autoFocus rows={2} maxLength={4000} resize="none" value={draft} disabled={sending}
                onChange={(event) => setDraft(event.target.value)} placeholder="Escribe una respuesta…" aria-label="Respuesta" />
              {error && <Text role="alert" fontSize="sm" color="fg.error">{error}</Text>}
              <HStack>
                <Button type="submit" size="sm" colorPalette="blue" loading={sending} disabled={!draft.trim() || sending}>Responder</Button>
                <Button type="button" size="sm" variant="ghost" disabled={sending} onClick={() => { setReplyOpen(false); setError(null); }}>Cancelar</Button>
              </HStack>
            </Stack>
          </Box>
        )}
      </Box>
    </Flex>
  );
}

export default function ChatPanel({ user, channel, onBack, hiddenOnMobile }) {
  const containerProps = {
    flex: "1",
    minW: "0",
    minH: "0",
    direction: "column",
    display: { base: hiddenOnMobile ? "none" : "flex", md: "flex" },
  };

  if (!channel) {
    return (
      <Flex {...containerProps}>
        <Center flex="1" color="fg.muted" p="6" textAlign="center">
          <Stack align="center" gap="2">
            <HashIcon boxSize="10" />
            <Text>Selecciona un canal para ver sus mensajes.</Text>
          </Stack>
        </Center>
      </Flex>
    );
  }
  return (
    <Flex {...containerProps}>
      <Conversation key={channel.id} user={user} channel={channel} onBack={onBack} />
    </Flex>
  );
}

function Conversation({ user, channel, onBack }) {
  const [messages, setMessages] = useState(null); // null = cargando
  const [error, setError] = useState(null);
  const [scheduled, setScheduled] = useState([]);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachments, setAttachments] = useState(null);
  const [attachmentsError, setAttachmentsError] = useState(null);
  const attachmentRequest = useRef(0);
  const active = useRef(true);
  const scroller = useRef(null);
  const stickToBottom = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const refreshAttachments = usePolling(async (cancelled) => {
    const requestId = ++attachmentRequest.current;
    try {
      const collected = new Map();
      let offset = 0;
      // Media pagina los archivos; se reúnen antes de ordenarlos con los mensajes.
      while (true) {
        const data = await gql(Q.attachments, { channelId: channel.id, userId: user.id, limit: 100, offset });
        if (cancelled() || !active.current || requestId !== attachmentRequest.current) return;
        const page = data.attachments.items;
        for (const item of page) collected.set(item.id, item);
        if (page.length < 100) break;
        offset += 100;
      }
      setAttachments([...collected.values()]);
      setAttachmentsError(null);
    } catch (err) {
      if (!cancelled() && active.current && requestId === attachmentRequest.current) setAttachmentsError(err.message);
    }
  }, 8000, true, `${channel.id}:${user.id}`);

  const refresh = usePolling(
    async (cancelled) => {
      try {
        const data = await gql(Q.channelMessages, { id: channel.id });
        if (cancelled()) return;
        if (!data.channel) return setError("Este canal ya no existe.");
        const sorted = [...data.channel.messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(sorted);
        setError(null);
      } catch (e) {
        if (!cancelled()) setError(e.message);
      }
    },
    MESSAGES_POLL_MS,
    true,
    channel.id
  );

  const refreshScheduled = usePolling(
    async (cancelled) => {
      try {
        const data = await gql(Q.myScheduled, { a: user.id });
        if (!cancelled()) setScheduled(data.scheduledMessages.filter((s) => s.channelId === channel.id));
      } catch {
        /* el panel solo se alimenta cuando hay conexión */
      }
    },
    SCHEDULED_POLL_MS,
    true,
    channel.id
  );
  const activeCount = scheduled.filter((s) => ACTIVE_STATUSES.has(s.status)).length;
  const timeline = [
    ...(messages ?? []).map((item) => ({ type: "message", item })),
    ...(attachments ?? []).map((item) => ({ type: "attachment", item })),
  ].sort((a, b) => new Date(a.item.createdAt) - new Date(b.item.createdAt) || `${a.type}:${a.item.id}`.localeCompare(`${b.type}:${b.item.id}`));

  const scrollToLatest = () => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, attachments]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const handleSent = () => {
    stickToBottom.current = true;
    refresh();
  };

  return (
    <>
      <Flex align="center" gap="2" px="4" py="3" borderBottomWidth="1px">
        <IconButton display={{ base: "inline-flex", md: "none" }} aria-label="Volver a canales" size="sm" variant="ghost" onClick={onBack}>
          <BackIcon />
        </IconButton>
        <HashIcon boxSize="4" color="fg.muted" />
        <Heading size="md" truncate>{channel.name}</Heading>
        <IconButton ml="auto" flexShrink="0" size="sm" variant="ghost" aria-label="Ver archivos del canal" title="Archivos del canal" onClick={() => setAttachmentsOpen(true)}><AttachmentIcon boxSize="4" /></IconButton>
        <Button flexShrink="0" size="sm" variant="ghost" onClick={() => setScheduledOpen(true)} aria-label="Mensajes programados" title="Mensajes programados">
          <CalendarIcon boxSize="4" />
          <Text display={{ base: "none", md: "inline" }}>Programados</Text>
          {activeCount > 0 && <Badge colorPalette="blue" variant="solid" borderRadius="full">{activeCount}</Badge>}
        </Button>
      </Flex>

      <Box ref={scroller} onScroll={onScroll} flex="1" minH="0" overflowY="auto" py="2" role="log" aria-live="polite">
        {messages === null && !error && <Center py="10"><Spinner /></Center>}

        {messages === null && error && (
          <Center py="10">
            <Stack align="center" gap="2">
              <Text color="fg.error">{error}</Text>
              <Button size="sm" variant="outline" onClick={refresh}>Reintentar</Button>
            </Stack>
          </Center>
        )}

        {messages && attachments && timeline.length === 0 && (
          <Center py="10" color="fg.muted"><Text>Aún no hay mensajes ni archivos en este canal. ¡Comparte el primero!</Text></Center>
        )}

        {attachments === null && !attachmentsError && <Text px="4" py="2" fontSize="xs" color="fg.muted">Cargando archivos…</Text>}
        {timeline.map(({ type, item }) => type === "message" ? (
          <MessageItem key={`message:${item.id}`} message={item} mine={item.author?.id === user.id} user={user} channel={channel} onReplied={refresh} />
        ) : (
          <AttachmentItem key={`attachment:${item.id}`} attachment={item} userId={user.id} onImageLoad={scrollToLatest} />
        ))}
      </Box>

      {attachmentsError && <HStack px="4" py="1"><Text fontSize="xs" color="fg.error">No se pudieron actualizar los archivos: {attachmentsError}</Text><Button size="xs" variant="ghost" onClick={refreshAttachments}>Reintentar</Button></HStack>}

      {messages && error && (
        <Text px="4" py="1" fontSize="xs" color="fg.error">No se pudo actualizar: {error} Reintentando…</Text>
      )}

      <Composer user={user} channel={channel} onSent={handleSent} onScheduled={refreshScheduled} onAttach={() => setAttachmentsOpen(true)} />
      <AttachmentsDialog open={attachmentsOpen} onClose={() => setAttachmentsOpen(false)} channel={channel} user={user} onUploaded={() => { stickToBottom.current = true; refreshAttachments(); }} />

      <ScheduledDialog
        open={scheduledOpen}
        onClose={() => setScheduledOpen(false)}
        channel={channel}
        items={scheduled}
        onChanged={refreshScheduled}
      />
    </>
  );
}
