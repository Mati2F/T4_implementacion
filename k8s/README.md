# Prueba interna del frontend y gateway

Estos recursos se crean en `grupo-mensajes-programados`. El frontend y el gateway usan Services `ClusterIP`, sin Ingress ni direcciones públicas nuevas. No es necesario volver a desplegar mensajes programados ni los servicios de otros grupos.

## Imágenes

El workflow `.github/workflows/publish-image.yaml` construye y publica tres imágenes al recibir un push en `main`: mensajes programados, `ghcr.io/mati2f/chat-gateway:latest` y `ghcr.io/mati2f/chat-frontend:latest`. Antes de aplicar los nuevos Deployments, espera a que termine la publicación. Las imágenes deben poder descargarse desde el clúster; si los paquetes GHCR son privados, configura un `imagePullSecret` de tu namespace y referéncialo en los nuevos Deployments.

El frontend se compila con `VITE_GATEWAY_URL=/graphql`. No pongas esta variable en el Deployment esperando cambiar el JavaScript ya compilado. Nginx recibe `GATEWAY_UPSTREAM=http://chat-gateway:8000` al arrancar y genera su configuración desde una plantilla.

## Aplicar solo los recursos nuevos

Desde la raíz del repositorio, con tu kubeconfig ya configurado:

```powershell
kubectl apply -f k8s/gateway-config.yaml -f k8s/gateway.yaml -f k8s/frontend.yaml
kubectl rollout status deployment/chat-gateway -n grupo-mensajes-programados
kubectl rollout status deployment/chat-frontend -n grupo-mensajes-programados
```

No se necesita aplicar toda la carpeta `k8s/` para esta prueba: los otros manifiestos corresponden al servicio existente y `api.yaml` incluye su Ingress previo.

## Acceso local

```powershell
kubectl port-forward service/chat-frontend 8080:80 -n grupo-mensajes-programados
```

Mantén esa terminal abierta y visita `http://localhost:8080`. Las consultas `/graphql` y las descargas `/media/...` pasan por Nginx al gateway interno conservando sus rutas, parámetros y cuerpos multipart. No hace falta un port-forward adicional al gateway.

Para abrir el explorador, visita `http://localhost:8080/graphql`. El límite de profundidad del gateway también aplica a la introspección; algunas consultas de herramientas que superen 8 niveles serán rechazadas.

## Configuración

`gateway-config.yaml` contiene URLs internas y opciones no secretas. El gateway las recibe mediante `envFrom`. No contiene kubeconfig ni credenciales y no requiere permisos para consultar la API de Kubernetes.

Después de cambiar ese ConfigMap, aplica el archivo y reinicia el Deployment para cargar las nuevas variables:

```powershell
kubectl apply -f k8s/gateway-config.yaml
kubectl rollout restart deployment/chat-gateway -n grupo-mensajes-programados
```

Si publicas de nuevo una imagen con la misma etiqueta `latest`, reinicia el Deployment correspondiente para descargarla de nuevo. Los límites de recursos son valores iniciales de estos dos componentes; deben caber en la cuota disponible del grupo. No cambian recursos de otros namespaces.

Nginx escucha en 8080 como usuario sin privilegios; el Service del frontend expone el puerto 80. Permite cuerpos multipart de hasta 12 MiB para transportar los archivos de hasta 10 MiB de la configuración predeterminada de Media. La disponibilidad y permisos de red hacia otros namespaces dependen de las políticas del clúster.
