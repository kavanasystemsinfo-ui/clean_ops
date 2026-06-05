import { useState, useEffect, useCallback } from 'react'
import { getConsumption, getAlerts, getCentros, getProductos, type ConsumptionData, type AlertsData, type Centro, type Producto } from '../lib/api'
import { exportToCsv } from '../lib/csv'

export function Dashboard() {
  const [consumption, setConsumption] = useState<ConsumptionData | null>(null)
  const [alerts, setAlerts] = useState<AlertsData | null>(null)
  const [centros, setCentros] = useState<Centro[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [filtroCentro, setFiltroCentro] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [consumptionData, alertsData, centrosData, productosData] = await Promise.all([
        getConsumption({
          centro: filtroCentro ? Number(filtroCentro) : undefined,
          producto: filtroProducto ? Number(filtroProducto) : undefined,
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
        }),
        getAlerts(),
        getCentros(),
        getProductos(),
      ])
      setConsumption(consumptionData)
      setAlerts(alertsData)
      setCentros(centrosData)
      setProductos(productosData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    loadData()
  }

  if (loading && !consumption) {
    return (
      <div className="loading">
        <div className="spinner" />
        Cargando dashboard...
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard de Consumo</h1>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <span className="stat-label">Consumo Total</span>
          <span className="stat-value">{consumption?.total_consumo ?? 0}</span>
          <span className="stat-sub">unidades consumidas</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Movimientos</span>
          <span className="stat-value">{consumption?.total_movimientos ?? 0}</span>
          <span className="stat-sub">registros de consumo</span>
        </div>
        <div className="stat-card danger">
          <span className="stat-label">Alertas Críticas</span>
          <span className="stat-value">{alerts?.criticas.length ?? 0}</span>
          <span className="stat-sub">stock agotado</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-label">Advertencias</span>
          <span className="stat-value">{alerts?.advertencias.length ?? 0}</span>
          <span className="stat-sub">stock por debajo del mínimo</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <form className="filters-bar" onSubmit={handleFilter}>
          <div className="form-group">
            <label className="form-label">Centro</label>
            <select className="form-select" value={filtroCentro} onChange={(e) => setFiltroCentro(e.target.value)}>
              <option value="">Todos</option>
              {centros.map((c) => (
                <option key={c.id_centro} value={c.id_centro}>{c.nombre_centro}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Producto</label>
            <select className="form-select" value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)}>
              <option value="">Todos</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>{p.nombre_producto}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Desde</label>
            <input className="form-input" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Hasta</label>
            <input className="form-input" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">Filtrar</button>
        </form>
      </div>

      {/* Consumption by Center */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Consumo por Centro</h2>
          {consumption && consumption.resumen_por_centro.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => {
              const rows = consumption.resumen_por_centro.flatMap((g) =>
                g.productos.map((p) => ({
                  centro: g.centro.nombre_centro,
                  producto: p.nombre_producto,
                  unidad: p.unidad_medida,
                  cantidad_consumida: p.cantidad,
                  total_consumo_centro: g.total_consumo,
                  movimientos: g.movimientos,
                }))
              )
              exportToCsv('consumo-por-centro', rows)
            }}>
              Exportar CSV
            </button>
          )}
        </div>
        {consumption && consumption.resumen_por_centro.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Centro</th>
                  <th>Total Consumo</th>
                  <th>Movimientos</th>
                  <th>Productos</th>
                </tr>
              </thead>
              <tbody>
                {consumption.resumen_por_centro.map((grupo) => (
                  <tr key={grupo.centro.id_centro}>
                    <td><strong>{grupo.centro.nombre_centro}</strong></td>
                    <td>{grupo.total_consumo}</td>
                    <td>{grupo.movimientos}</td>
                    <td>
                      {grupo.productos.map((p) => (
                        <span key={p.id_producto} className="badge badge-info" style={{ marginRight: '0.25rem', marginBottom: '0.25rem' }}>
                          {p.nombre_producto}: {p.cantidad}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--gray-500)', padding: '1rem 0' }}>No hay datos de consumo para los filtros seleccionados.</p>
        )}
      </div>

      {/* Recent Movements */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Últimos Movimientos</h2>
          {consumption && consumption.movimientos.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => {
              const rows = consumption.movimientos.slice(0, 100).map((m) => ({
                fecha: new Date(m.fecha_hora).toLocaleString('es-ES'),
                centro: m.centro.nombre_centro,
                producto: m.producto.nombre_producto,
                cantidad: m.cantidad,
                usuario: m.usuario.nombre,
              }))
              exportToCsv('movimientos', rows)
            }}>
              Exportar CSV
            </button>
          )}
        </div>
        {consumption && consumption.movimientos.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Centro</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {consumption.movimientos.slice(0, 50).map((m) => (
                  <tr key={m.id_movimiento}>
                    <td>{new Date(m.fecha_hora).toLocaleString('es-ES')}</td>
                    <td>{m.centro.nombre_centro}</td>
                    <td>{m.producto.nombre_producto}</td>
                    <td style={{ color: 'var(--danger)' }}>{m.cantidad}</td>
                    <td>{m.usuario.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--gray-500)', padding: '1rem 0' }}>No hay movimientos recientes.</p>
        )}
      </div>
    </div>
  )
}