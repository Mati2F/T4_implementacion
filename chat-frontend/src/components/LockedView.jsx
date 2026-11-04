import { Button, Center, Heading, Stack, Text } from "@chakra-ui/react";
import { LockIcon } from "../icons.jsx";

export default function LockedView({ onLoginClick }) {
  return (
    <Center flex="1" p="6">
      <Stack align="center" gap="3" textAlign="center" maxW="sm">
        <LockIcon boxSize="10" color="fg.muted" />
        <Heading size="lg">Inicia sesión para entrar al chat</Heading>
        <Text color="fg.muted">
          Con tu ID de usuario podrás ver los canales, leer sus mensajes y enviar los tuyos.
        </Text>
        <Button colorPalette="blue" onClick={onLoginClick}>Iniciar sesión</Button>
      </Stack>
    </Center>
  );
}
