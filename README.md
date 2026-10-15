# Microservicio de mensajes programados

Este repositorio extiende el sistema base de chat con la capacidad de **programar mensajes para que sean enviados automáticamente en una fecha y hora futura**. La implementación funciona como un proyecto independiente y requiere que el [demo de la Unidad 3](https://github.com/rmasad/microservicios/tree/main/03_Comunicaci%C3%B3n/demo) esté levantado previamente.

La solución mantiene separadas las responsabilidades: el nuevo microservicio administra la programación y sus estados, mientras que el servicio base `messages` continúa siendo el único responsable de crear y almacenar los mensajes del chat. La integración se realiza exclusivamente mediante las APIs y eventos publicados; el microservicio no accede a las bases de datos internas de `users`, `channels` ni `messages`.

## Problema que resuelve

En equipos distribuidos, una persona puede redactar un aviso, recordatorio o seguimiento antes del momento en que debe publicarse. Sin esta capacidad, el envío depende de que el autor esté conectado y recuerde hacerlo a la hora correcta.

El servicio permite:

- Crear una programación utilizando los identificadores de un usuario y un canal del chat base.
- Consultar una programación y su estado.
- Listar programaciones por autor o estado.
- Cancelar una programación que todavía no haya sido procesada.
- Despachar automáticamente el mensaje cuando llega la fecha indicada.
- Reintentar fallos transitorios y registrar fallos definitivos.
- Publicar eventos por cada cambio de estado relevante.

## Arquitectura

El microservicio `scheduled-messages` se ejecuta mediante tres procesos independientes que comparten la misma base de datos:

- **API REST:** recibe, valida el formato, consulta y cancela programaciones.
- **Scheduler:** detecta periódicamente las programaciones cuya hora ya llegó y solicita su despacho.
- **Dispatcher:** consume las solicitudes desde RabbitMQ y utiliza la API REST de `messages` para publicar el mensaje en el chat.

```mermaid
flowchart LR
    Client[Cliente / Swagger UI]

    subgraph Extension[Este repositorio: mensajes programados]
        API[Scheduled Messages API] <--> DB[(Scheduled Messages MongoDB)]
        Scheduler[Scheduler] -->|Busca programaciones vencidas| DB
        Scheduler -->|Publica dispatch-requested| Rabbit[(RabbitMQ)]
        Rabbit -->|Consume evento| Dispatcher[Dispatcher]
        Dispatcher <--> DB
    end

    subgraph Base[Demo externo de la Unidad 3]
        Users[Users API]
        Channels[Channels API]
        Messages[Messages API]
        Messages -->|Valida autor| Users
        Messages -->|Valida canal| Channels
    end

    Client -->|Crea usuario| Users
    Client -->|Crea canal| Channels
    Client -->|HTTP REST| API
    Dispatcher -->|POST mensaje| Messages
```

### Patrones de comunicación

| Comunicación | Patrón | Motivo |
|---|---|---|
| Cliente → Scheduled Messages API | REST síncrono | El cliente necesita confirmación inmediata de la operación. |
| Scheduler → RabbitMQ | Evento asíncrono | El vencimiento de una programación no bloquea la API ni depende de un cliente conectado. |
| RabbitMQ → Dispatcher | Consumidor asíncrono | Desacopla la detección de la hora del envío efectivo. |
| Dispatcher → Messages API del demo | REST síncrono | `messages` no consume eventos y su contrato público para crear mensajes es HTTP. |
| Messages API → Users y Channels API | REST síncrono | El servicio base valida el autor y el canal al crear el mensaje definitivo. |

Esta es una integración **híbrida**: el procesamiento interno de las programaciones es asíncrono, pero la creación final se realiza a través del contrato REST publicado por el núcleo del chat.

## Estructura del repositorio

```text
T4_implementacion/
├── docker-compose.yaml
├── README.md
└── scheduled-messages/          # Nueva capacidad vertical
    ├── Dockerfile
    ├── requirements.txt
    └── app/
        ├── main.py              # API versionada, FastAPI y manejo de errores
        ├── models.py            # Esquemas de entrada y salida
        ├── service.py           # Reglas de negocio
        ├── scheduler.py         # Detección de programaciones vencidas
        ├── dispatcher.py        # Consumo y envío de mensajes
        ├── event_bus.py         # Publicación y consumo en RabbitMQ
        ├── database.py          # Acceso a MongoDB
        ├── errors.py            # Errores del dominio
        └── config.py            # Configuración por variables de entorno
```

## Tecnologías

- Python y FastAPI para la API REST.
- Pydantic para esquemas y validación.
- MongoDB para programaciones y eventos pendientes.
- RabbitMQ para comunicación asíncrona.
- Docker y Docker Compose para ejecutar la extensión y conectarla con el demo base.
- OpenAPI/Swagger generado automáticamente por FastAPI.

## Requisitos

- Docker Desktop en ejecución.
- Docker Compose v2, incluido en versiones actuales de Docker Desktop.
- Git para obtener el repositorio del demo base.
- Puertos `8001`, `8002`, `8003`, `8004`, `5672` y `15672` disponibles.
- El [demo de la Unidad 3](https://github.com/rmasad/microservicios/tree/main/03_Comunicaci%C3%B3n/demo), que contiene `users`, `channels` y `messages`.

No es necesario instalar Python, MongoDB ni RabbitMQ en el computador anfitrión.

## Ejecución

El sistema se levanta en dos proyectos Docker Compose separados. Ambos declaran una red Docker con el nombre `microsvcs`, lo que permite que el dispatcher de esta implementación se comunique con el servicio `messages` del demo.

### 1. Levantar primero el chat base

Clonar el repositorio del curso, si todavía no se encuentra disponible localmente:

```powershell
git clone https://github.com/rmasad/microservicios.git
```

Entrar al demo de la Unidad 3 y levantarlo en segundo plano:

```powershell
cd .\microservicios\03_Comunicación\demo
docker compose up --build -d
docker compose ps
```

Antes de continuar, comprobar que las APIs estén disponibles en los puertos `8001`, `8002` y `8003`.

### 2. Levantar mensajes programados

En otra ventana de PowerShell, ubicarse en la raíz de este repositorio:

```powershell
cd C:\ruta\al\repositorio\T4_implementacion
docker compose up --build -d
docker compose ps
```

Para observar la ejecución en primer plano se puede omitir `-d`:

```powershell
docker compose up --build
```

## Servicios disponibles

| Servicio | Dirección |
|---|---|
| Users del demo externo - Swagger UI | http://localhost:8001/docs |
| Channels del demo externo - Swagger UI | http://localhost:8002/docs |
| Messages del demo externo - Swagger UI | http://localhost:8003/docs |
| Scheduled Messages de este repositorio - Swagger UI | http://localhost:8004/docs |
| Scheduled Messages de este repositorio - OpenAPI JSON | http://localhost:8004/openapi.json |
| RabbitMQ de este repositorio - Management | http://localhost:15672 |

Las credenciales de RabbitMQ son usuario `chat` y contraseña `chat`.

## API de mensajes programados

La API está versionada bajo el prefijo `/api/v1`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Comprueba que la API está activa. |
| `POST` | `/api/v1/scheduled-messages` | Crea una programación. |
| `GET` | `/api/v1/scheduled-messages` | Lista programaciones; permite filtrar por `author_id` y `status`. |
| `GET` | `/api/v1/scheduled-messages/{schedule_id}` | Obtiene una programación por identificador. |
| `DELETE` | `/api/v1/scheduled-messages/{schedule_id}` | Cancela una programación válida. |
| `GET` | `/api/v1/events` | Lista los eventos registrados por el servicio. |

La documentación interactiva, los esquemas, ejemplos y códigos de respuesta se pueden revisar en `http://localhost:8004/docs`.

### Ejemplo de creación

Primero deben crearse el usuario y el canal mediante las APIs del demo externo. La fecha debe incluir zona horaria y encontrarse en el futuro.

La API de mensajes programados registra los identificadores recibidos sin consultar previamente `users` ni `channels`. Cuando llega la hora, el servicio `messages` del demo valida ambas referencias antes de crear el mensaje definitivo. Si un identificador no existe, la programación termina en estado `failed` y registra el error en `last_error`.

```json
{
  "author_id": "ID_DEL_USUARIO",
  "channel_id": "ID_DEL_CANAL",
  "content": "Reunión de seguimiento en 10 minutos",
  "scheduled_for": "2026-10-12T18:30:00-03:00"
}
```

Ejemplo de respuesta con estado HTTP `201 Created`:

```json
{
  "id": "ID_DE_LA_PROGRAMACION",
  "author_id": "ID_DEL_USUARIO",
  "channel_id": "ID_DEL_CANAL",
  "content": "Reunión de seguimiento en 10 minutos",
  "scheduled_for": "2026-10-12T21:30:00Z",
  "status": "pending",
  "attempts": 0,
  "message_id": null,
  "last_error": null,
  "next_attempt_at": null,
  "created_at": "2026-10-12T21:20:00Z",
  "updated_at": "2026-10-12T21:20:00Z"
}
```

## Estados de una programación

```text
pending ──► queued ──► processing ──► sent
   │                         │
   ├──► cancelled            ├──► retrying ──► queued
   │                         │
   └─────────────────────────└──► failed
```

| Estado | Significado |
|---|---|
| `pending` | Espera la fecha y hora programadas. |
| `queued` | El scheduler solicitó su despacho en RabbitMQ. |
| `processing` | El dispatcher está intentando crear el mensaje. |
| `retrying` | Ocurrió un fallo transitorio y se programó otro intento. |
| `sent` | El mensaje fue creado correctamente por `messages`. |
| `failed` | No fue posible enviarlo o se agotaron los intentos permitidos. |
| `cancelled` | El usuario canceló la programación antes del envío. |

## Eventos

El servicio usa el exchange durable `chat`, de tipo `topic`. Los eventos de despacho se publican como mensajes persistentes y el dispatcher consume la cola durable `scheduled-message-dispatch`.

| Evento | Momento de emisión |
|---|---|
| `chat.scheduled-message.created` | Se crea una programación. |
| `chat.scheduled-message.cancelled` | Se cancela una programación. |
| `chat.scheduled-message.dispatch-requested` | Llega la hora de envío y el scheduler solicita el despacho. |
| `chat.scheduled-message.processing` | El dispatcher comienza un intento. |
| `chat.scheduled-message.retry-scheduled` | Se programa un reintento por un fallo transitorio. |
| `chat.scheduled-message.sent` | `messages` acepta y crea el mensaje. |
| `chat.scheduled-message.failed` | La entrega falla definitivamente. |

Los eventos se guardan primero en una colección de salida (**outbox**) y luego se publican en RabbitMQ. De este modo, si RabbitMQ no está disponible temporalmente, el scheduler puede volver a intentar publicar eventos pendientes.

Ejemplo conceptual de un evento:

```json
{
  "id": "UUID_DEL_EVENTO",
  "type": "chat.scheduled-message.created",
  "subject_id": "ID_DE_LA_PROGRAMACION",
  "occurred_at": "2026-10-12T21:20:00Z",
  "data": {
    "status": "pending"
  }
}
```

Las consultas `GET` no cambian el estado del dominio, por lo que no generan eventos. Sí se emite un evento por cada transacción que crea una programación o modifica su estado.

## Manejo de errores

La API responde errores en formato JSON consistente. Entre los casos contemplados están:

| Código HTTP | Situación |
|---|---|
| `404 Not Found` | La programación solicitada no existe. |
| `409 Conflict` | La programación ya no se encuentra en un estado cancelable. |
| `422 Unprocessable Entity` | El cuerpo no cumple el esquema o la fecha indicada no es futura. |

FastAPI también expone en OpenAPI los esquemas de entrada, salida y validación.

Los errores producidos durante el despacho no se devuelven como respuesta de la creación original, porque el envío ocurre asíncronamente. Se reflejan mediante los estados `retrying` o `failed` y el campo `last_error` de la programación.

## Flujo de prueba de punta a punta

Este flujo sirve para comprobar la implementación:

1. Levantar primero el Compose del demo de la Unidad 3 y comprobar sus tres APIs.
2. Levantar después el Compose de este repositorio.
3. Abrir `http://localhost:8001/docs` y crear un usuario con `POST /api/v1/users`. Guardar el `id` retornado.
4. Abrir `http://localhost:8002/docs` y crear un canal con `POST /api/v1/channels`. Guardar el `id` del canal.
5. Abrir `http://localhost:8004/docs` y ejecutar `POST /api/v1/scheduled-messages` con los identificadores anteriores y una hora aproximadamente uno o dos minutos en el futuro.
6. Consultar `GET /api/v1/scheduled-messages/{schedule_id}`. Inicialmente debe aparecer como `pending`.
7. Esperar hasta la hora configurada y repetir la consulta. El estado debe terminar en `sent` y contener un `message_id`.
8. Abrir `http://localhost:8003/docs` y consultar los mensajes del canal para comprobar que el contenido fue publicado por el demo base.
9. Ejecutar `GET /api/v1/events` en `http://localhost:8004/docs` para mostrar los eventos generados durante el flujo.
10. Opcionalmente, abrir RabbitMQ Management en `http://localhost:15672` para mostrar el exchange y la cola.

Para demostrar la cancelación, crear una segunda programación con una hora posterior, ejecutar su operación `DELETE` y comprobar que queda en estado `cancelled` y no se publica en el canal.

## Logs y diagnóstico

Ver los registros de los componentes incluidos en este repositorio:

```powershell
docker compose logs -f
```

Ver únicamente los tres procesos de la capacidad:

```powershell
docker compose logs -f scheduled-messages-api scheduled-messages-scheduler scheduled-messages-dispatcher
```

## Detener el sistema

Cada proyecto Compose se detiene desde su propia carpeta. Para detener mensajes programados y conservar sus datos:

```powershell
docker compose down
```

Eliminar también los volúmenes y comenzar nuevamente con bases de datos vacías:

```powershell
docker compose down -v
```

> **Advertencia:** la opción `-v` elimina los datos almacenados por los contenedores.

Para detener también `users`, `channels` y `messages`, entrar posteriormente a la carpeta `03_Comunicación/demo` y ejecutar allí `docker compose down`. Sus volúmenes solo se eliminan si se agrega expresamente la opción `-v`.

## Decisiones y consideraciones

- `scheduled-messages` posee su propia base de datos y no comparte colecciones con el chat base.
- El chat base no forma parte de este repositorio: se ejecuta desde el demo de la Unidad 3 y ambos Compose comparten la red Docker `microsvcs`.
- La API conserva los identificadores de autor y canal; el servicio `messages` del demo los valida cuando se intenta efectuar el envío.
- La fecha se recibe con zona horaria y se normaliza para evitar ambigüedades.
- El scheduler consulta programaciones vencidas cada dos segundos.
- El dispatcher procesa un mensaje a la vez por consumidor y confirma el evento después de manejarlo.
- Los fallos transitorios pueden reintentarse hasta tres veces, con una espera de diez segundos.
- La actualización atómica del estado evita que dos procesos reclamen la misma programación al mismo tiempo.
- RabbitMQ entrega eventos al menos una vez. El control de estado reduce el riesgo de procesamiento duplicado.
- La operación final depende de la disponibilidad y del contrato público del servicio `messages`.

