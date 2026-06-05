import { useState, useEffect } from 'react'
import {
  getAsignaciones, createAsignacion, updateAsignacion,
  getUsuarios, getCentros,
  type Asignacion, type Usuario, type Centro,
} from '../lib/api'

export function Asignaciones() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [usuarios, setUsuarios] = useState<{ id_usuario: number; nombre: string; email: string; rol: string }[]>([])
  const [centros, setCentros] = useState<Centro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalUsuario, setModalUsuario] = useState('')
  const [modalCentro, setModalCentro] = useState('')
  const [modalFechaInicio, setModalFechaInicio] = useState('')
  const [modalFechaFin, setModalFechaFin] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [asigData, usersData, centrosData] = await Promise.all([
        getAsignaciones(),
        getUsuarios(),
        getCentros(),
      ])
      setAsignaciones(asigData)
      setUsuarios(usersData.filter((u) => u.rol !== 'admin'))
      setCentros(centrosData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setModalUsuario('')
    setModalCentro('')
    setModalFechaInicio(new Date().toISOString().split('T')[0])
    setModalFechaFin('')
    setModalError('')
    setShowModal(true)
  }

  const openEdit = (asig: Asignacion) => {
    setEditingId(asig.id_asignacion)
    setModalUsuario(String(asig.id_usuario))
    setModalCentro(String(asig.id_centro))
    setModalFechaInicio(asig.fecha_inicio.split('T')[0])
    setModalFechaFin(asig.fecha_fin ? asig.fecha_fin.split('T')[0] : '')
    setModalError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalUsuario || !modalCentro || !modalFechaInicio) {
      setModalError('Debe completar todos los campos obligatorios.')
      return
    }

    setModalLoading(true)
    setModalError('')

    try {
      if (editingId) {
        await updateAsignacion(editingId, {
          id_centro: Number(modalCentro),
          fecha_inicio: modalFechaInicio,
          fecha_fin: modalFechaFin || null,
        })
        setSuccess('Asignación actualizada correctamente.')
      } else {
        await createAsignacion({
          id_usuario: Number(modalUsuario),
          id_centro: Number(modalCentro),
          fecha_inicio: modalFechaInicio,
          fecha_fin: modalFechaFin || null,
        })
        setSuccess('Asignación creada correctamente.')
      }
      setShowModal(false)
      loadData()
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setModalLoading(false)
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })

  if (loading && asignaciones.length === 0) {
    return (
      <div className="loading">
        <div className="spinner" />
        Cargando asignaciones...
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Asignaciones de Personal</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Nueva Asignación
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Centro</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((a) => {
                const isActive = !a.fecha_fin || new Date(a.fecha_fin) >= new Date()
                return (
                  <tr key={a.id_asignacion}>
                    <td><strong>{a.usuario?.nombre}</strong><br /><span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{a.usuario?.email}</span></td>
                    <td><span className="badge badge-info">{a.usuario?.rol}</span></td>
                    <td>{a.centro?.nombre_centro}</td>
                    <td>{formatDate(a.fecha_inicio)}</td>
                    <td>{a.fecha_fin ? formatDate(a.fecha_fin) : <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>
                      {isActive ? (
                        <span className="badge badge-success">Activa</span>
                      ) : (
                        <span className="badge badge-warning">Vencida</span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(a)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
              {asignaciones.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                    No hay asignaciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">
              {editingId ? 'Editar Asignación' : 'Nueva Asignación'}
            </h2>
            {modalError && <div className="alert alert-danger">{modalError}</div>}
            <form onSubmit={handleSubmit}>
              {!editingId && (
                <div className="form-group">
                  <label className="form-label">Usuario</label>
                  <select className="form-select" value={modalUsuario} onChange={(e) => setModalUsuario(e.target.value)} required>
                    <option value="">Seleccionar usuario...</option>
                    {usuarios.map((u) => (
                      <option key={u.id_usuario} value={u.id_usuario}>
                        {u.nombre} ({u.email}) — {u.rol}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Centro</label>
                <select className="form-select" value={modalCentro} onChange={(e) => setModalCentro(e.target.value)} required>
                  <option value="">Seleccionar centro...</option>
                  {centros.map((c) => (
                    <option key={c.id_centro} value={c.id_centro}>{c.nombre_centro}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha Inicio</label>
                  <input className="form-input" type="date" value={modalFechaInicio} onChange={(e) => setModalFechaInicio(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha Fin (opcional)</label>
                  <input className="form-input" type="date" value={modalFechaFin} onChange={(e) => setModalFechaFin(e.target.value)} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}