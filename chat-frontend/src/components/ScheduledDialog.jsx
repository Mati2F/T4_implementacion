import { useMemo, useState } from "react";
import { Badge, Box, Button, Center, Dialog, Flex, HStack, Portal, Stack, Tabs, Text } from "@chakra-ui/react";
import { gql, M } from "../api.js";
import { ACTIVE_STATUSES, CANCELLABLE_STATUSES, STATUS_COLORS, STATUS_LABELS, formatDateTime } from "../utils.js";
import { toaster } from "../toaster.jsx";

function Row({ item, confirming, busy, onAskCancel, onKeep, onConfirm }) {
  const cancellable = CANCELLABLE_STATUSES.has(item.status);
  const inFlight = item.status === "QUEUED" || item.status === "PROCESSING";

  return (
    <Box borderWidth="1px" borderRadius="md" p="3">
      <Flex justify="space-between" align="center" gap="2" mb="1">
        <Text fontSize="sm" color="fg.muted">{formatDateTime(new Date(item.scheduledFor))}</Text>
        <Badge colorPalette={STATUS_COLORS[item.status] ?? "gray"}>{STATUS_LABELS[item.status] ?? item.status}</Badge>
      </Flex>
      <Text whiteSpace="pre-wrap" wordBreak="break-word" lineClamp="3">{item.content}</Text>
      {item.lastError && <Text mt="1" fontSize="xs" color="fg.error">Último error: {item.lastError}</Text>}

      {cancellable && (
        <HStack mt="3" gap="2">
          {confirming ? (
            <>
              <Button size="xs" colorPalette="red" loading={busy} onClick={onConfirm}>Sí, anular envío</Button>
              <Button size="xs" variant="ghost" disabled={busy} onClick={onKeep}>No</Button>
            </>
          ) : (
            <Button size="xs" variant="outline" colorPalette="red" onClick={onAskCancel}>Anular envío</Button>
          )}
        </HStack>
      )}
      {inFlight && <Text mt="2" fontSize="xs" color="fg.muted">Ya se está enviando: no se puede anular.</Text>}
    </Box>
  );
}

function List({ channel, items, onChanged }) {
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const { active, history } = useMemo(() => {
    const byDate = (a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor);
    return {
      active: items.filter((s) => ACTIVE_STATUSES.has(s.status)).sort(byDate),
      history: items.filter((s) => !ACTIVE_STATUSES.has(s.status)).sort((a, b) => byDate(b, a)),
    };
  }, [items]);

  const cancel = async (item) => {
    setBusyId(item.id);
    try {
      await gql(M.cancelScheduled, { id: item.id });
      toaster.create({ title: "Envío anulado", description: `El mensaje no se enviará a #${channel.name}.`, type: "success" });
    } catch (err) {
      toaster.create({ title: "No se pudo anular", description: err.message, type: "error" });
    } finally {
      setBusyId(null);
      setConfirmId(null);
      onChanged();
    }
  };

  const render = (list, emptyText) =>
    list.length === 0 ? (
      <Center py="8"><Text color="fg.muted" textAlign="center">{emptyText}</Text></Center>
    ) : (
      <Stack gap="3">
        {list.map((item) => (
          <Row
            key={item.id}
            item={item}
            confirming={confirmId === item.id}
            busy={busyId === item.id}
            onAskCancel={() => setConfirmId(item.id)}
            onKeep={() => setConfirmId(null)}
            onConfirm={() => cancel(item)}
          />
        ))}
      </Stack>
    );

  return (
    <Tabs.Root defaultValue="active" fitted>
      <Tabs.List mb="4">
        <Tabs.Trigger value="active">Activos ({active.length})</Tabs.Trigger>
        <Tabs.Trigger value="history">Historial ({history.length})</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="active">{render(active, "No tienes mensajes programados en este canal.")}</Tabs.Content>
      <Tabs.Content value="history">{render(history, "Aquí aparecerán los mensajes enviados, anulados o fallidos.")}</Tabs.Content>
    </Tabs.Root>
  );
}

export default function ScheduledDialog({ open, onClose, ...listProps }) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center" scrollBehavior="inside" lazyMount unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>Mensajes programados en #{listProps.channel.name}</Dialog.Title></Dialog.Header>
            <Dialog.Body pb="6"><List {...listProps} /></Dialog.Body>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
