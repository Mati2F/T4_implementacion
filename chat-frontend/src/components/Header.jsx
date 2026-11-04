import { Avatar, Box, Button, Flex, Heading, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { HashIcon, LoginIcon, MoonIcon, SunIcon } from "../icons.jsx";
import { toaster } from "../toaster.jsx";

export default function Header({ user, onLoginClick, onLogout, colorMode, onToggleColorMode }) {
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      toaster.create({ title: "ID copiado", description: "Úsalo para iniciar sesión en otro navegador.", type: "success" });
    } catch {
      toaster.create({ title: "Tu ID", description: user.id, type: "info", duration: 15000, closable: true });
    }
  };

  return (
    <Flex as="header" align="center" justify="space-between" px="4" py="3" borderBottomWidth="1px" bg="bg.panel">
      <Flex align="center" gap="2">
        <Box color="blue.solid"><HashIcon boxSize="6" /></Box>
        <Heading size="md">Chat</Heading>
      </Flex>

      <Flex align="center" gap="2" minW="0">
        <IconButton variant="ghost" flexShrink="0" aria-label={colorMode === "dark" ? "Activar modo claro" : "Activar modo oscuro"} title={colorMode === "dark" ? "Activar modo claro" : "Activar modo oscuro"} onClick={onToggleColorMode}>
          {colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
        </IconButton>
      {user ? (
        <Menu.Root onSelect={(d) => (d.value === "copy" ? copyId() : d.value === "logout" && onLogout())}>
          <Menu.Trigger asChild>
            <Button variant="ghost" aria-label="Menú de usuario">
              <Avatar.Root size="xs" colorPalette="blue">
                <Avatar.Fallback name={user.displayName} />
              </Avatar.Root>
              <Text maxW={{ base: "24", md: "40" }} truncate>{user.displayName}</Text>
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="copy">Copiar mi ID</Menu.Item>
                <Menu.Item value="logout" color="fg.error">Cerrar sesión</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      ) : (
        <Button variant="outline" onClick={onLoginClick} aria-label="Iniciar sesión" title="Iniciar sesión">
          <LoginIcon /> Iniciar sesión
        </Button>
      )}
      </Flex>
    </Flex>
  );
}
