# Kavana CleanStock

Kavana CleanStock es un sistema MES (Manufacturing Execution System) industrial multi-tenant adaptado para el control de inventario distribuido, control de producción y costes, diseñado inicialmente para fabricantes de estanterías metálicas (Puntales Titán K-100, Largueros L-2700, Bandejas E-900).

El sistema consta de:
* **Backend API**: Servidor Express + Prisma (PostgreSQL) + Socket.IO para tiempo real.
* **Mobile App (PWA/Tablet)**: Aplicación móvil para operarios de limpieza con capacidades offline.
* **Dashboard App**: Panel de control interactivo para supervisores y administradores.

---

## Requisitos Previos

* Node.js v18 o superior
* Docker y Docker Compose (para base de datos PostgreSQL en local)

## Instalación y Configuración

1. Instalar dependencias en el directorio raíz:
   ```bash
   npm install
   ```
2. Instalar dependencias del panel (dashboard) y la aplicación móvil:
   ```bash
   cd dashboard && npm install
   cd ../mobile && npm install
   ```
3. Copiar archivo de entorno `.env.example` a `.env` en la raíz y configurar las variables:
   ```bash
   cp .env.example .env
   ```
4. Levantar la base de datos en Docker:
   ```bash
   npm run docker:db
   ```
5. Ejecutar las migraciones y el seed de base de datos:
   ```bash
   npx prisma migrate dev
   node prisma/seed.js
   ```

## Ejecución en Local

* **Iniciar Backend API**: `npm run dev` (ejecuta nodemon en el puerto 4000)
* **Iniciar App Móvil**: `npm run mobile:dev`
* **Iniciar Dashboard**: `npm run dashboard:dev`

## Ejecutar Pruebas

Para validar la lógica de negocio y las validaciones de seguridad:
```bash
npm run test
```

---

## Seguridad y Robustez en Producción

Recientemente hemos implementado mejoras críticas para asegurar la aplicación:
1. **Validación de Consumos**: La API `/stock/consume` valida que las cantidades de consumo sean enteros estrictamente positivos (> 0). Las salidas se registran con signo negativo en el historial y la base de datos de manera interna.
2. **Protección de Centro Bypass**: El rol de `limpiador` solo puede registrar consumos en su centro de trabajo asignado. Intentos de alterar stock en otros centros devuelven un código HTTP `403 (Forbidden)`.
3. **Redirección HTTPS y CORS**: En producción, el servidor fuerza el tráfico seguro y restringe el acceso de CORS únicamente a los orígenes definidos en `CORS_ORIGIN`.
4. **Manejo de Errores de Conexión**: Las peticiones interceptan fallos de red y devuelven una alerta amigable en español.
5. **Caducidad de Sesión**: Redirección fluida al login con explicación de expiración cuando los tokens JWT han caducado.

Para ver las decisiones arquitectónicas detalladas, consulta [DECISIONES_ESTRATEGICAS.md](file:///c:/Users/jorge/Desktop/proyectos%20IA/kavana%20cleanops/DECISIONES_ESTRATEGICAS.md).
