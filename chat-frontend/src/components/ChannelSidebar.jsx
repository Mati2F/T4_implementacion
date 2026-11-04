import { useMemo, useState } from "react";
import { Button, Flex, Heading, IconButton, Input, Spinner, Stack, Text } from "@chakra-ui/react";
import { HashIcon, PlusIcon } from "../icons.jsx";

export default function ChannelSidebar({ channels, error, selectedId, onSelect, onCreate, onRetry, hiddenOnMobile }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = channels ?? [];
    return term ? list.filter((c) => c.name.toLowerCase().includes(term)) : list;
  }, [channels, search]);

  return (
    <Flex
      as="nav"
      aria-label="Canales"
      direction="column"
      w={{ base: "full", md: "300px" }}
      flexShrink="0"
      borderRightWidth={{ base: "0", md: "1px" }}
      bg="bg.subtle"
      display={{ base: hiddenOnMobile ? "none" : "flex", md: "flex" }}
      minH="0"
    >
      <Flex align="center" justify="space-between" px="4" pt="4" pb="2">
        <Heading size="sm">Canales</Heading>
        <IconButton aria-label="Crear canal" title="Crear canal" size="sm" variant="subtle" colorPalette="blue" onClick={onCreate}>
          <PlusIcon />
        </IconButton>
      </Flex>

      <Flex px="4" pb="3">
        <Input size="sm" placeholder="Buscar canal…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar canal" />
      </Flex>

      <Stack gap="1" px="2" pb="3" flex="1" overflowY="auto">
        {channels === null && !error && <Flex justify="center" py="6"><Spinner /></Flex>}

        {error && (
          <Stack px="2" py="2" gap="2">
            <Text fontSize="sm" color="fg.error">{error}</Text>
            <Button size="xs" variant="outline" onClick={onRetry}>Reintentar</Button>
          </Stack>
        )}

        {channels && channels.length === 0 && (
          <Text px="3" py="2" fontSize="sm" color="fg.muted">Todavía no hay canales. Crea el primero con el botón +.</Text>
        )}
        {channels && channels.length > 0 && filtered.length === 0 && (
          <Text px="3" py="2" fontSize="sm" color="fg.muted">Ningún canal coincide con “{search}”.</Text>
        )}

        {filtered.map((c) => (
          <Button
            key={c.id}
            variant={c.id === selectedId ? "subtle" : "ghost"}
            colorPalette={c.id === selectedId ? "blue" : "gray"}
            justifyContent="flex-start"
            w="full"
            onClick={() => onSelect(c.id)}
            aria-current={c.id === selectedId ? "true" : undefined}
          >
            <HashIcon boxSize="4" />
            <Text truncate>{c.name}</Text>
          </Button>
        ))}
      </Stack>
    </Flex>
  );
}
