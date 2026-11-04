import { useState } from "react";
import { Avatar, Badge, Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { attachmentDownloadUrl } from "../api.js";
import { formatMessageTime } from "../utils.js";
import { AttachmentIcon } from "../icons.jsx";

export default function AttachmentItem({ attachment, userId, onImageLoad }) {
  const [imageFailed, setImageFailed] = useState(false);
  const url = attachmentDownloadUrl(attachment.downloadUrl);
  const mine = attachment.uploaderId === userId;
  const name = attachment.uploader?.displayName ?? "Usuario desconocido";
  const preview = url && attachment.category === "IMAGE" && attachment.mimeType?.startsWith("image/") && !imageFailed;

  return (
    <Flex gap="3" align="flex-start" px="4" py="2">
      <Avatar.Root size="sm" colorPalette={mine ? "blue" : "gray"}><Avatar.Fallback name={name} /></Avatar.Root>
      <Box minW="0" maxW="full">
        <HStack gap="2" wrap="wrap">
          <Text fontWeight="semibold">{name}</Text>
          {mine && <Badge colorPalette="blue" size="xs">Tú</Badge>}
          <Text fontSize="xs" color="fg.muted">{formatMessageTime(attachment.createdAt)}</Text>
        </HStack>
        <Box borderWidth="1px" borderRadius="lg" overflow="hidden" mt="1" maxW="sm">
          {preview && (
            <Box p="2" bg="bg.subtle">
              <img src={url} alt={attachment.filename ?? "Imagen compartida"} loading="lazy"
                style={{ display: "block", maxWidth: "100%", maxHeight: "280px", objectFit: "contain" }}
                onLoad={onImageLoad} onError={() => setImageFailed(true)} />
            </Box>
          )}
          <Box p="3">
            <HStack align="flex-start"><AttachmentIcon flexShrink="0" /><Text fontWeight="medium" wordBreak="break-word">{attachment.filename ?? "Archivo adjunto"}</Text></HStack>
            <Text fontSize="xs" color="fg.muted" mt="1">Archivo del canal{attachment.sizeBytes != null ? ` · ${(attachment.sizeBytes / 1024).toFixed(1)} KB` : ""}</Text>
            {imageFailed && <Text fontSize="xs" color="fg.muted">No se pudo cargar la vista previa. Puedes intentar descargar el archivo.</Text>}
            {url ? <Button asChild size="sm" variant="outline" mt="2"><a href={url} target="_blank" rel="noopener noreferrer">Descargar archivo</a></Button> : <Text fontSize="xs" color="fg.muted">Descarga no disponible</Text>}
          </Box>
        </Box>
      </Box>
    </Flex>
  );
}
