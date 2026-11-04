# chat-gateway: API Gateway GraphQL (Ariadne) para el chat

Gateway que expone GraphQL (`/graphql`) sobre los servicios REST del chat y una ruta HTTP para descargar adjuntos. Toda la comunicación con los servicios pasa por el gateway. No guarda datos ni modifica ningún servicio.

```
Interfaz ──GraphQL──► chat-gateway ──REST──► users · channels · messages   (base, no modificables)
                                      ├────► scheduled-messages-api         (mensajes programados)
                                      ├────► threads                         (respuestas a mensajes)
                                      └────► media                           (adjuntos y previews de enlaces)
```

## Configuración (variables de entorno)
| Variable | Qué es | Por defecto |
|---|---|---|
| `USERS_URL`, `CHANNELS_URL`, `MESSAGES_URL` | servicios base | `http://users:8000`, … |
| `SCHEDULED_URL` | mensajes programados | `http://scheduled-messages-api:8000` (en el cluster el Service expone el puerto **80**: usa la URL sin `:8000`) |
| `MEDIA_URL`, `THREADS_URL` | APIs nuevas | En Compose: `http://media:8000`, `http://thread-api:8000`. |
| `CORS_ORIGINS` | orígenes permitidos (coma) | `*` |
| `REQUEST_TIMEOUT_SECONDS` | tiempo máximo por llamada | `5` |

Usa `http://` (el cluster no sirve https). La URL puede llevar `/` final.

## Levantar

Desde la carpeta `gateway`, con los servicios base y mensajes programados levantados en la red Docker `microsvcs`:

```powershell
docker compose up --build
```

El Compose conecta el gateway a esa red existente; no levanta los servicios que consume. Para usar Threads y Media, configura `THREADS_URL` y `MEDIA_URL` con direcciones accesibles desde el contenedor del gateway. Puedes definirlas como variables de entorno antes de iniciar Compose.

Las direcciones internas `*.svc.cluster.local` funcionan desde los pods del clúster; no son accesibles directamente desde un gateway ejecutado en Docker local. Para desplegar el gateway en Kubernetes, se necesita publicar su imagen y crear sus manifiestos; estos aún no están incluidos en `k8s/`.

## Comprobación manual

- Abre `http://localhost:5000/health` para comprobar que el gateway responde. Esta ruta no comprueba la conexión con los servicios.
- Abre `http://localhost:5000/graphql` y ejecuta una consulta para comprobar la conexión con Channels:

```graphql
query {
  channels { id name }
}
```

Los ejemplos siguientes permiten comprobar Threads y Media usando identificadores reales. Las mutations de creación y subida guardan datos en los servicios correspondientes.

## Operaciones nuevas

**Respuestas (threads)** — una sola capa de respuestas por mensaje raíz.
```graphql
mutation { createReply(channelId: "…", messageId: "…", authorId: "…", content: "De acuerdo") { id createdAt author { displayName } } }
query { replies(channelId: "…", messageId: "…") { content author { displayName } } }
query { channel(id: "…") { messages { content replies { content author { displayName } } } } }   # ver nota
```
> `Message.replies` hace **una llamada a threads por mensaje** (no hay endpoint por lote). Pídelo solo donde se necesite.

**Adjuntos (media)** — media exige `X-User-Id` en todo: aquí va como argumento `userId`.
```graphql
query {
  attachments(channelId: "…", userId: "…", category: IMAGE, limit: 20, offset: 0) {
    items { id filename mimeType sizeBytes category status createdAt downloadUrl uploader { displayName } }
    limit offset
  }
}
mutation { deleteAttachment(id: "…", userId: "…") }
query { channelQuota(channelId: "…", userId: "…") }          # JSON (sin tipar)
query { linkPreview(url: "https://example.com", userId: "…") }  # JSON (sin tipar)
```
Subida (estándar *GraphQL multipart request*; devuelve un `Attachment`):
```bash
curl http://localhost:5000/graphql \
  -F operations='{"query":"mutation($c:ID!,$u:ID!,$f:Upload!){uploadAttachment(channelId:$c,userId:$u,file:$f){id filename downloadUrl}}","variables":{"c":"CANAL","u":"USUARIO","f":null}}' \
  -F map='{"0":["variables.f"]}' \
  -F 0=@foto.png
```
**`downloadUrl`** es una ruta del gateway ya lista para usar, con `user_id` incluido:
`/media/attachments/{id}/download?user_id=…` → se antepone el origen del gateway (`<img src>`, `<a href>`).
No se usa el `download_url` interno de media (apunta a otro servicio y exige `X-User-Id`). La ruta reenvía
`content-type`, `content-disposition`, `etag`, `last-modified`, `accept-ranges` y soporta `Range`, `If-None-Match` e `If-Modified-Since`.
Media responde `content-disposition: attachment`: abrir la URL en una pestaña descarga el archivo; en `<img>` se muestra normal.

> `channelQuota` y `linkPreview` siguen devolviendo `JSON` tal cual: falta una respuesta de ejemplo para tipar sus campos.
> Los adjuntos de categoría `LINK` no se han visto: por eso solo `id`, `channelId`, `uploaderId`, `category` y `createdAt` son obligatorios.
> No se expusieron `GET /api/v1/events` ni `GET /api/v1/links/jobs` de media.

## Errores
Los errores de los servicios en operaciones GraphQL se unifican en `errors[].extensions`: `code` (`NOT_FOUND`, `VALIDATION_ERROR`, `UPSTREAM_UNAVAILABLE` o el código propio del servicio, p. ej. `SCHEDULE_CANNOT_BE_CANCELLED`) y `status` cuando existe una respuesta HTTP del servicio. Los fallos de conexión usan `UPSTREAM_UNAVAILABLE` sin `status`. La ruta HTTP de descarga devuelve el estado HTTP del servicio; si falta el usuario responde 400 y si no puede conectar con Media responde 502.

## Estructura
`app/schema.graphql` (contrato) · `app/main.py` (resolvers y ruta de descarga) · `app/dataloaders.py` · `app/upstream.py` · `app/config.py`
