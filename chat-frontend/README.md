# Chat · frontend (React + Chakra UI)

Interfaz web del chat. Habla **solo** con el gateway: usa GraphQL (`/graphql`) para datos y subidas, y la ruta HTTP del mismo gateway para descargar archivos. No consulta directamente a los servicios.

## Ejecutar
Requisitos: Node 18+ y el gateway levantado (por defecto en `http://localhost:5000`).

```bash
npm install
npm run dev          # http://localhost:5173
```
Otra URL de gateway: copia `.env.example` a `.env` y cambia `VITE_GATEWAY_URL`.
Build de producción: `npm run build` (queda en `dist/`).

## Con Docker
```bash
docker compose up --build        # http://localhost:3000
```
La URL del gateway se compila dentro del JavaScript y la usa el **navegador**, así que debe ser una dirección
accesible desde tu máquina (por defecto `http://localhost:5000/graphql`, el puerto que publica el gateway).
Para otra: `VITE_GATEWAY_URL=http://mi-host:5000/graphql docker compose up --build` (hay que reconstruir).

## Qué hace
- **Iniciar sesión** (icono arriba a la derecha): pegar un ID de usuario existente, o crear un usuario nuevo (pestaña "Crear usuario"). No es autenticación: solo indica quién escribe. El ID queda guardado en el navegador (`localStorage`) y se puede copiar desde el menú del usuario.
- Sin sesión, canales y mensajes están bloqueados.
- **Canales**: lista, buscador y creación de canales. Se actualiza cada 10 s.
- **Mensajes**: autor, hora (hora local) y contenido. Se actualizan cada 3 s (*polling*); el scroll baja solo salvo que hayas subido a leer.
- **Enviar**: Enter envía, Shift+Enter salto de línea.
- **Responder** (en cada mensaje): abre el mensaje principal y su hilo. Permite consultar y enviar respuestas de un solo nivel. El hilo se actualiza cada 4 s mientras está abierto; si el envío falla, conserva el texto para reintentar.
- **Archivos** (icono de clip junto al campo de mensaje o en la cabecera): permite seleccionar y subir un archivo, listar los adjuntos del canal en páginas de 20 y descargarlos. Se actualiza al abrir la ventana, cambiar de página, subir un archivo o pulsar Actualizar. Los archivos pertenecen al canal y no se vinculan a un mensaje específico.
- **Archivos en la conversación**: se muestran junto a los mensajes por fecha, con autor, nombre, tamaño y descarga. Las imágenes tienen vista previa. Los adjuntos se actualizan cada 8 s y después de una subida; un fallo de Media no impide leer los mensajes. El historial de adjuntos se consulta por páginas de 100 para mostrarlo completo.
- Las subidas usan GraphQL multipart con `FormData` y `fetch` del navegador. Las descargas se abren desde el gateway, que envía a Media la identificación del usuario. No se agregan dependencias.
- **Programar** (icono de reloj): abre un diálogo con su propio campo de mensaje y un selector de fecha y hora futura (no usa ni borra lo que estés escribiendo en el chat); el mensaje lo envía el servicio de mensajes programados (p2).
- **Programados** (botón con calendario en la cabecera del canal, con contador): lista tus mensajes programados en ese canal.
  Pestaña *Activos* y pestaña *Historial* (enviados, anulados, fallidos). **Anular envío** pide confirmación y solo está
  disponible mientras el mensaje está *Pendiente* o *Reintentando*; si ya está *En cola* o *Enviando*, p2 no permite anularlo.
  Anular no borra el registro: queda en el Historial como *Anulado* (p2 no tiene borrado físico).

## Estructura
```
src/
  api.js            cliente GraphQL (fetch) y consultas/mutaciones
  hooks.js          usePolling (sin solaparse, pausa con la pestaña oculta)
  App.jsx           sesión + layout
  components/       incluye ChatPanel, Composer, ThreadDialog, AttachmentsDialog y diálogos de sesión, canales y programaciones
```
Dependencias: React, Chakra UI v3 y Emotion (requisito de Chakra). Vite solo como herramienta de desarrollo/build.
