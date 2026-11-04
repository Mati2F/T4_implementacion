import { useEffect, useRef, useState } from "react";
import { Box, Button, Center, Dialog, HStack, Input, Portal, Spinner, Stack, Text } from "@chakra-ui/react";
import { attachmentDownloadUrl, gql, Q, uploadAttachment } from "../api.js";
import { formatMessageTime } from "../utils.js";
import { toaster } from "../toaster.jsx";

const PAGE_SIZE = 20;

function Files({ channel, user, onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const input = useRef(null);
  const active = useRef(true);
  const uploadingRef = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems(null);
    gql(Q.attachments, { channelId: channel.id, userId: user.id, limit: PAGE_SIZE, offset })
      .then((data) => { if (!cancelled) setItems(data.attachments.items); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channel.id, user.id, offset, revision]);

  const upload = async (event) => {
    event.preventDefault();
    if (!file || uploadingRef.current) return;
    if (file.size === 0) { setUploadError("El archivo está vacío. Elige otro archivo."); return; }
    uploadingRef.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadAttachment(channel.id, user.id, file);
      onUploaded?.();
      toaster.create({ title: "Archivo subido", description: `Disponible en los archivos de #${channel.name}.`, type: "success" });
      if (!active.current) return;
      setFile(null);
      if (input.current) input.current.value = "";
      setOffset(0);
      setRevision((value) => value + 1);
    } catch (err) {
      if (active.current) setUploadError(err.message);
    } finally {
      uploadingRef.current = false;
      if (active.current) setUploading(false);
    }
  };

  return (
    <Stack gap="5">
      <form onSubmit={upload}>
        <Stack gap="2">
          <Text as="label" htmlFor="channel-file" fontWeight="semibold">Seleccionar archivo</Text>
          <Input ref={input} id="channel-file" type="file" p="1" disabled={uploading} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setUploadError(null); }} />
          <Text fontSize="xs" color="fg.muted">El archivo se comparte con el canal, separado de los mensajes.</Text>
          {uploadError && <Text role="alert" color="fg.error">{uploadError}</Text>}
          <Button type="submit" colorPalette="blue" disabled={!file || uploading} loading={uploading}>Subir archivo</Button>
        </Stack>
      </form>
      <HStack justify="space-between"><Text fontWeight="semibold">Archivos del canal</Text><Button size="xs" variant="ghost" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Actualizar</Button></HStack>
      {loading && <Center py="4"><Spinner /></Center>}
      {error && <Box role="alert"><Text color="fg.error">{error}</Text><Button size="sm" variant="outline" onClick={() => setRevision((value) => value + 1)}>Reintentar</Button></Box>}
      {items?.length === 0 && <Text color="fg.muted">{offset === 0 ? "Todavía no hay archivos en este canal." : "No hay más archivos."}</Text>}
      {items?.map((item) => {
        const url = attachmentDownloadUrl(item.downloadUrl);
        return (
          <Box key={item.id} p="3" borderWidth="1px" borderRadius="md">
            <Text fontWeight="semibold" wordBreak="break-word">{item.filename ?? "Adjunto"}</Text>
            <Text fontSize="xs" color="fg.muted">{item.uploader?.displayName ?? "Usuario desconocido"} · {formatMessageTime(item.createdAt)}{item.sizeBytes != null ? ` · ${(item.sizeBytes / 1024).toFixed(1)} KB` : ""}</Text>
            {url ? <Button asChild size="sm" mt="2" variant="outline"><a href={url} target="_blank" rel="noopener noreferrer">Descargar</a></Button> : <Text fontSize="xs" color="fg.muted">Descarga no disponible</Text>}
          </Box>
        );
      })}
      <HStack justify="space-between">
        <Button size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>Anterior</Button>
        <Text fontSize="xs">Página {offset / PAGE_SIZE + 1}</Text>
        <Button size="sm" variant="outline" disabled={loading || !items || items.length < PAGE_SIZE} onClick={() => setOffset((value) => value + PAGE_SIZE)}>Siguiente</Button>
      </HStack>
    </Stack>
  );
}

export default function AttachmentsDialog({ open, onClose, channel, user, onUploaded }) {
  return (
    <Dialog.Root open={open} onOpenChange={(event) => !event.open && onClose()} placement="center" scrollBehavior="inside" lazyMount unmountOnExit>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>Archivos de #{channel.name}</Dialog.Title></Dialog.Header>
        <Dialog.Body pb="6">{open && <Files channel={channel} user={user} onUploaded={onUploaded} />}</Dialog.Body>
        <Dialog.Footer><Button variant="outline" onClick={onClose}>Cerrar</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  );
}
