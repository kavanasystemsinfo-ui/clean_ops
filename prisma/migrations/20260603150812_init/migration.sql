-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" VARCHAR(20) NOT NULL DEFAULT 'limpiador',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activo',

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "centros" (
    "id_centro" SERIAL NOT NULL,
    "nombre_centro" VARCHAR(150) NOT NULL,
    "direccion" VARCHAR(255),

    CONSTRAINT "centros_pkey" PRIMARY KEY ("id_centro")
);

-- CreateTable
CREATE TABLE "productos" (
    "id_producto" SERIAL NOT NULL,
    "nombre_producto" VARCHAR(100) NOT NULL,
    "unidad_medida" VARCHAR(20) NOT NULL DEFAULT 'unidades',
    "stock_minimo_alerta" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "asignaciones_personal" (
    "id_asignacion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_centro" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,

    CONSTRAINT "asignaciones_personal_pkey" PRIMARY KEY ("id_asignacion")
);

-- CreateTable
CREATE TABLE "inventario_centros" (
    "id_centro" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad_actual" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventario_centros_pkey" PRIMARY KEY ("id_centro","id_producto")
);

-- CreateTable
CREATE TABLE "registro_movimientos" (
    "id_movimiento" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_centro" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha_hora" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_movimientos_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "idx_asignaciones_usuario_fecha" ON "asignaciones_personal"("id_usuario", "fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE INDEX "idx_movimientos_centro_fecha" ON "registro_movimientos"("id_centro", "fecha_hora");

-- AddForeignKey
ALTER TABLE "asignaciones_personal" ADD CONSTRAINT "asignaciones_personal_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_personal" ADD CONSTRAINT "asignaciones_personal_id_centro_fkey" FOREIGN KEY ("id_centro") REFERENCES "centros"("id_centro") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_centros" ADD CONSTRAINT "inventario_centros_id_centro_fkey" FOREIGN KEY ("id_centro") REFERENCES "centros"("id_centro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_centros" ADD CONSTRAINT "inventario_centros_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_movimientos" ADD CONSTRAINT "registro_movimientos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_movimientos" ADD CONSTRAINT "registro_movimientos_id_centro_fkey" FOREIGN KEY ("id_centro") REFERENCES "centros"("id_centro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_movimientos" ADD CONSTRAINT "registro_movimientos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;
