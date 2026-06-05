# Plan de Implementación: Mejoras Enterprise para Kavana CleanStock (CLECE / ISS)

Este documento detalla el plan técnico para incorporar funcionalidades avanzadas orientadas a grandes operadoras de *facility services* (como CLECE o ISS). El foco está puesto en la rentabilidad financiera por centro de coste, el control de desviaciones de consumo y el reporte de incidencias desde movilidad.

---

## 1. Módulos y Cambios Propuestos

### Módulo A: Costes, Presupuestos y Traducción Financiera
Permite asignar presupuestos en euros por centro y valorar económicamente el consumo de stock.

1. **Base de Datos (Prisma)**:
   - Modificar modelo `Producto` en `schema.prisma`: añadir `coste_unitario` (Decimal / Float) para valorar el precio de adquisición.
   - Modificar modelo `Centro` en `schema.prisma`: añadir `presupuesto_mensual` (Decimal / Float) para topear el coste permitido de consumibles al mes.
2. **Endpoints Backend**:
   - Modificar `GET /api/v1/dashboard/consumption`: incluir en la respuesta el coste total acumulado (cantidad consumida × coste del producto) y el porcentaje consumido del presupuesto mensual de cada centro.
3. **Frontend Dashboard**:
   - En la vista de Dashboard, cambiar métricas de "unidades consumidas" a "euros consumidos" (`€`).
   - Mostrar una barra de progreso del presupuesto consumido por centro (con alertas si supera el 80% o 100%).

---

### Módulo B: Consumo Teórico vs. Consumo Real (Desviación)
Permite alertar a los supervisores cuando en un colegio u oficina se está gastando más producto químico del estipulado técnicamente en el contrato.

1. **Base de Datos (Prisma)**:
   - Crear un nuevo modelo `ConsumoTeorico`:
     ```prisma
     model ConsumoTeorico {
       id_centro      Int
       id_producto    Int
       cantidad_teorica Int // Unidades estipuladas al mes
       
       centro   Centro   @relation(fields: [id_centro], references: [id_centro], onDelete: Cascade)
       producto Producto @relation(fields: [id_producto], references: [id_producto], onDelete: Cascade)

       @@id([id_centro, id_producto])
       @@map("consumo_teorico")
     }
     ```
2. **Endpoints Backend**:
   - `GET /api/v1/dashboard/deviations`: devuelve los productos cuya desviación (Consumo Real - Consumo Teórico) supere un % límite parametrizado (ej. > 15%).
3. **Frontend Dashboard**:
   - Nueva sección "Control de Desviaciones" con gráficos comparativos de barras (barra azul = Teórico, barra roja = Real) para identificar de inmediato robos o desperdicios de material en las contratas.

---

### Módulo C: Reporte de Incidencias en la Instalación
Permite a los operarios (limpiadores) actuar como sensores del estado del edificio y reportar daños en maquinaria o griferías de forma rápida.

1. **Base de Datos (Prisma)**:
   - Crear un nuevo modelo `Incidencia`:
     ```prisma
     model Incidencia {
       id_incidencia   Int      @id @default(autoincrement())
       id_centro       Int
       id_usuario      Int
       categoria       String   // "maquinaria" | "fontaneria" | "electricidad" | "otros"
       titulo          String   @db.VarChar(100)
       descripcion     String   @db.Text
       foto_url        String?  // Para adjuntar foto de la avería
       estado          String   @default("pendiente") // "pendiente" | "en_proceso" | "resuelta"
       fecha_creacion  DateTime @default(now())

       centro  Centro  @relation(fields: [id_centro], references: [id_centro], onDelete: Cascade)
       usuario Usuario @relation(fields: [id_usuario], references: [id_usuario])

       @@map("incidencias")
     }
     ```
2. **Endpoints Backend**:
   - `POST /api/v1/incidencias`: crea una incidencia (operario desde móvil).
   - `GET /api/v1/incidencias`: lista incidencias filtrables por centro/estado (dashboard supervisor).
   - `PUT /api/v1/incidencias/:id`: actualiza estado (resuelve incidencia).
3. **Frontend Móvil (Limpiador)**:
   - Añadir una nueva pestaña/pantalla en el móvil: "Reportar Incidencia".
   - Formulario sencillo: Categoría (select), Título breve, Descripción y opción de capturar/adjuntar foto.
4. **Frontend Dashboard (Supervisor)**:
   - Nueva sección "Bandeja de Incidencias" para dar seguimiento, cambiar estado a "resuelta" y coordinar al equipo de mantenimiento.

---

### Módulo D: Propuestas de Pedidos de Compra Automatizados (Auto-Restock)
Agiliza las compras automatizando el cálculo de qué hace falta pedir al proveedor para cada centro.

1. **Endpoints Backend**:
   - `GET /api/v1/purchases/proposal`: analiza para cada centro cuáles productos están por debajo de su stock de alerta o stock cero, calcula la cantidad necesaria para rellenar al stock estándar y genera una lista de pedido recomendada agrupada por proveedor o producto.
2. **Frontend Dashboard**:
   - En la sección de Inventario, añadir una opción de "Generar Propuesta de Pedido de Compra" que autocompleta un pedido de compra en formato CSV listo para exportar o enviar al proveedor químico.

---

## 2. Plan de Verificación

### Pruebas de Integración y Unitarias
- Desarrollar tests para comprobar que:
  - Las incidencias se insertan correctamente con fotos mockeadas.
  - La valoración de consumo suma correctamente el `coste_unitario`.
  - El cálculo de desviaciones retorna los porcentajes correctos.
  - La generación de propuestas calcula con precisión la diferencia necesaria.

### Verificación Manual
- Acceder a la app móvil, enviar una incidencia simulada de "Avería en dispensador" y corroborar en tiempo real que aparece en el Dashboard de Supervisor.
- Cambiar el coste unitario de la lejía a `2.50 €` y registrar un consumo de 4 unidades, verificando que se incrementa en `10.00 €` el gasto de la contrata en el mes actual.
