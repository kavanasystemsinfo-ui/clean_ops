import { useState, useEffect } from 'react'
import { getAlerts, getCentros, type AlertsData, type Centro } from '../lib/api'
import { exportToCsv } from '../lib/csv'
import { connect, disconnect, subscribe, type StockAlertPayload } from '../lib/socket'

export function Alerts() {
  const [alerts, setAlerts] = useState<AlertsData | null>(null)
  const [centros, setCentros] = useState<Centro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroCentro, setFiltroCentro] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [alertsData, centrosData] = await Promise.all([
        getAlerts(),
        getCentros(),
      ])
      setAlerts(alertsData)
      setCentros(centrosData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar alertas')
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // Socket.IO: Recibir alertas en tiempo real
  // --------------------------------------------------------------------------
  useEffect(() => {
    loadData()

    const socket = connect()
    if (!socket) return

    const unsub = subscribe('stock:alert', (raw) => {
      const payload = raw as StockAlertPayload

      // Mostrar notificación de nueva alerta recargando los datos
      // para mantener consistencia con el backend
      loadData()
    })

    return () => {
      unsub()
      disconnect()
    }
  }, [])

  const filteredCritical = (alerts?.criticas ?? []).filter(
    (a) => !filtroCentro || a.id_centro === Number(filtroCentro)
  )

  const filteredWarnings = (alerts?.advertencias ?? []).filter(
    (a) => !filtroCentro || a.id_centro === Number(filtroCentro)
  )

  if (loading && !alerts) {
    return (
      <div className="loading">
        <div className="spinner" />
        Cargando alertas...
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Alertas de Stock</h1>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card danger">
          <span className="stat-label">Críticas</span>
          <span className="stat-value">{alerts?.criticas.length ?? 0}</span>
          <span className="stat-sub">stock agotado (≤ 0)</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-label">Advertencias</span>
          <span className="stat-value">{alerts?.advertencias.length ?? 0}</span>
          <span className="stat-sub">stock por debajo del mínimo</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Alertas</span>
          <span className="stat-value">{alerts?.total_alertas ?? 0}</span>
          <span className="stat-sub">requieren atención</span>
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="filters-bar">
          <div className="form-group">
            <label className="form-label">Filtrar por centro</label>
            <select className="form-select" value={filtroCentro} onChange={(e) => setFiltroCentro(e.target.value)}>
              <option value="">Todos los centros</option>
              {centros.map((c) => (
                <option key={c.id_centro} value={c.id_centro}>{c.nombre_centro}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🔴 Alertas Críticas</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-danger">{filteredCritical.length}</span>
            {filteredCritical.length > 0 && (
              <button className="btn btn-outline btn-sm" onClick={() => {
                exportToCsv('alertas-criticas', filteredCritical.map((a) => ({
                  centro: a.centro,
                  producto: a.producto,
                  unidad: a.unidad_medida,
                  stock_actual: a.cantidad_actual,
                  stock_minimo: a.stock_minimo_alerta,
                  deficit: a.deficit,
                  severidad: 'CRÍTICA',
                })))
              }}>
                Exportar CSV
              </button>
            )}
          </div>
        </div>
        {filteredCritical.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Centro</th>
                  <th>Producto</th>
                  <th>Stock Actual</th>
                  <th>Stock Mínimo</th>
                  <th>Déficit</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredCritical.map((a, i) => (
                  <tr key={`crit-${i}`}>
                    <td><strong>{a.centro}</strong></td>
                    <td>{a.producto}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{a.cantidad_actual}</td>
                    <td>{a.stock_minimo_alerta}</td>
                    <td style={{ color: 'var(--danger)' }}>{a.deficit}</td>
                    <td><span className="badge badge-danger">CRÍTICO</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--gray-500)', padding: '1rem 0' }}>No hay alertas críticas. ✅</p>
        )}
      </div>

      {/* Warnings */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🟡 Advertencias</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-warning">{filteredWarnings.length}</span>
            {filteredWarnings.length > 0 && (
              <button className="btn btn-outline btn-sm" onClick={() => {
                exportToCsv('alertas-advertencias', filteredWarnings.map((a) => ({
                  centro: a.centro,
                  producto: a.producto,
                  unidad: a.unidad_medida,
                  stock_actual: a.cantidad_actual,
                  stock_minimo: a.stock_minimo_alerta,
                  deficit: a.deficit,
                  severidad: 'ADVERTENCIA',
                })))
              }}>
                Exportar CSV
              </button>
            )}
          </div>
        </div>
        {filteredWarnings.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Centro</th>
                  <th>Producto</th>
                  <th>Stock Actual</th>
                  <th>Stock Mínimo</th>
                  <th>Déficit</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarnings.map((a, i) => (
                  <tr key={`warn-${i}`}>
                    <td><strong>{a.centro}</strong></td>
                    <td>{a.producto} ({a.unidad_medida})</td>
                    <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{a.cantidad_actual}</td>
                    <td>{a.stock_minimo_alerta}</td>
                    <td>{a.deficit}</td>
                    <td><span className="badge badge-warning">ADVERTENCIA</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--gray-500)', padding: '1rem 0' }}>No hay advertencias. ✅</p>
        )}
      </div>
    </div>
  )
}