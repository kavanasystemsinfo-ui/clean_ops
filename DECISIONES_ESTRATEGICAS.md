# Decisiones Estratégicas - Kavana CleanStock

Este documento registra el "por qué" de las decisiones arquitectónicas y de diseño técnico tomadas durante la fase de preparación para el entorno de producción.

---

## 1. Validación de Cantidades de Consumo Positivas en la API
* **Problema**: El diseño original de la API de consumo (`/stock/consume`) requería que la cantidad enviada en el body fuera negativa (ej. `cantidad: -3`). Esto introducía un riesgo de seguridad de inyección: si un atacante enviaba una cantidad positiva (ej. `cantidad: 3`), y la lógica hacía `cantidad_actual + cantidad` para actualizar el stock, el inventario se incrementaba artificialmente de forma fraudulenta.
* **Solución**: Se modificó el esquema de validación Zod (`consumeStockSchema`) en el backend para validar que la cantidad recibida sea estrictamente un número entero **positivo** (> 0).
* **Decisión Técnica**: 
  - El frontend (móvil) envía la cantidad como un número positivo (`Math.abs(cantidad)`).
  - La base de datos sigue registrando el movimiento como negativo (`-cantidad`) en `registroMovimiento` para mantener la integridad histórica del almacén donde los consumos son salidas.
  - La actualización en `inventarioCentro` se hace usando el operador `decrement` de Prisma con el valor positivo recibido.

## 2. Restricción estricta de Centros para el Rol Limpiador (Bypass de Centro)
* **Problema**: Un usuario malintencionado con rol de `limpiador` podía manipular las peticiones HTTP para enviar un `id_centro` diferente al de su centro activo asignado, logrando alterar el inventario de otras instalaciones de forma remota.
* **Solución**: En el controlador `consumeStock`, si el usuario autenticado tiene el rol de `limpiador`, el backend resuelve obligatoriamente su centro asignado de forma dinámica.
* **Decisión Técnica**: Si el cliente envía un `id_centro` en el cuerpo que no coincide con su asignación actual activa, la petición es rechazada de inmediato con un código `403 (Forbidden)`. Esto proporciona una protección estricta en el servidor que no depende de la UI.

## 3. Configuración Dinámica de CORS y Forzado de HTTPS en Producción
* **Problema**: En producción, un middleware de CORS estático con origen `*` es inseguro y permite llamadas desde cualquier sitio web externo. Asimismo, los datos de inventario en tránsito y las credenciales deben viajar cifrados obligatoriamente.
* **Solución**: 
  - Se configuró el middleware de CORS para verificar dinámicamente el origen contra la variable de entorno `CORS_ORIGIN`, permitiendo mapear una lista de dominios múltiples separados por comas.
  - Se añadió un middleware de redirección a HTTPS en producción que comprueba la cabecera `x-forwarded-proto` (usada por proxies inversos como Railway y Render).

## 4. Gestión de Fallos de Red y Experiencia de Usuario Offline
* **Problema**: Los fallos de red en el móvil (pérdida de señal en sótanos/almacenes) provocaban excepciones sin capturar en el cliente de API, lo que se traducía en estados de carga infinitos o comportamientos inestables en la interfaz.
* **Solución**: Las peticiones del cliente de API se envolvieron en bloques `try/catch` globales.
* **Decisión Técnica**: Si ocurre un error de red o de resolución DNS, se intercepta y se lanza un error sanitizado en español: *"Error de conexión. Por favor, inténtalo de nuevo cuando tengas cobertura."* de forma que la interfaz móvil lo notifique en un toast amigable.

## 5. Cierre Automático de Sesión por Expiración (Token 401)
* **Problema**: Si un operario dejaba la tablet encendida de un día para otro, el token JWT expiraba. Al presionar "Consumir", la petición fallaba con 401 y la interfaz se quedaba en la misma pantalla sin dar una explicación o forzar el login.
* **Solución**: El cliente de API intercepta de forma global las respuestas 401. Si no hay refresh token o el proceso de refresco falla:
  - Se limpian las credenciales guardadas (`clearTokens()`).
  - Se guarda una clave en `localStorage` (`auth_error`) con un mensaje explicativo: *"Su sesión ha expirado. Por favor, inicie sesión de nuevo."*
  - Se dispara un evento global de ventana (`auth:unauthorized`).
  - El componente raíz (`App.tsx`) reacciona al evento devolviendo el estado al Login, donde el formulario lee la clave de error del `localStorage`, la muestra de forma amigable y la limpia.
