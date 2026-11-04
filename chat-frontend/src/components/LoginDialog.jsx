import { useState } from "react";
import { Button, Dialog, Field, Input, Portal, Stack, Tabs, Text } from "@chakra-ui/react";
import { gql, M, Q } from "../api.js";
import { toaster } from "../toaster.jsx";

function IdForm({ onLogin }) {
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const value = id.trim();
    if (!value) return setError("Escribe tu ID de usuario.");
    setLoading(true);
    setError("");
    try {
      const data = await gql(Q.user, { id: value });
      if (!data.user) setError("No existe un usuario con ese ID.");
      else onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="4">
        <Field.Root invalid={!!error}>
          <Field.Label>ID de usuario</Field.Label>
          <Input autoFocus value={id} onChange={(e) => setId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          {error ? <Field.ErrorText>{error}</Field.ErrorText> : <Field.HelperText>No es una contraseña: solo indica quién escribe.</Field.HelperText>}
        </Field.Root>
        <Button type="submit" colorPalette="blue" loading={loading}>Entrar</Button>
      </Stack>
    </form>
  );
}

function CreateForm({ onLogin }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return setError("Escribe un nombre.");
    setLoading(true);
    setError("");
    try {
      const data = await gql(M.createUser, { name: value });
      toaster.create({
        title: `Usuario creado: ${data.createUser.displayName}`,
        description: `Tu ID es ${data.createUser.id}. Guárdalo para volver a entrar (también está en el menú de tu usuario).`,
        type: "success",
        duration: 20000,
        closable: true,
      });
      onLogin(data.createUser);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="4">
        <Field.Root invalid={!!error}>
          <Field.Label>Nombre</Field.Label>
          <Input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ana" />
          {error && <Field.ErrorText>{error}</Field.ErrorText>}
        </Field.Root>
        <Text fontSize="sm" color="fg.muted">Se creará un usuario nuevo y recibirás su ID.</Text>
        <Button type="submit" colorPalette="blue" loading={loading}>Crear y entrar</Button>
      </Stack>
    </form>
  );
}

export default function LoginDialog({ open, onClose, onLogin }) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center" lazyMount unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>Iniciar sesión</Dialog.Title></Dialog.Header>
            <Dialog.Body pb="6">
              <Tabs.Root defaultValue="id" fitted>
                <Tabs.List mb="4">
                  <Tabs.Trigger value="id">Tengo un ID</Tabs.Trigger>
                  <Tabs.Trigger value="create">Crear usuario</Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="id"><IdForm onLogin={onLogin} /></Tabs.Content>
                <Tabs.Content value="create"><CreateForm onLogin={onLogin} /></Tabs.Content>
              </Tabs.Root>
            </Dialog.Body>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
