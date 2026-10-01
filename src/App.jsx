import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
const [currentPage, setCurrentPage] = useState('dashboard')
const [companies, setCompanies] = useState([])
const [companiesLoading, setCompaniesLoading] = useState(false)
const [showCompanyForm, setShowCompanyForm] = useState(false)
const [companySaving, setCompanySaving] = useState(false)
const [editingCompanyId, setEditingCompanyId] = useState(null)
const [selectedCompany, setSelectedCompany] = useState(null)
const [companyForm, setCompanyForm] = useState({
  name: '',
  legal_name: '',
  tax_id: '',
  sector: '',
  website: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  postal_code: '',
  country: 'España',
  status: 'activo',
  notes: ''
})
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)

      if (session) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)

      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        setLoading(false)
        return
      }

      if (session) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error(error)
      setError('No se ha podido cargar el perfil del usuario.')
    } else {
      setProfile(data)
    }

    setLoading(false)
  }
async function loadCompanies() {
  setCompaniesLoading(true)

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error cargando clientes:', error)
    setCompanies([])
  } else {
    setCompanies(data || [])
  }

  setCompaniesLoading(false)
}
function editCompany(company) {
  setEditingCompanyId(company.id)

  setCompanyForm({
    name: company.name || '',
    legal_name: company.legal_name || '',
    tax_id: company.tax_id || '',
    sector: company.sector || '',
    website: company.website || '',
    phone: company.phone || '',
    email: company.email || '',
    address: company.address || '',
    city: company.city || '',
    province: company.province || '',
    postal_code: company.postal_code || '',
    country: company.country || 'España',
    status: company.status || 'activo',
    notes: company.notes || ''
  })

  setShowCompanyForm(true)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function saveCompany(e) {
  e.preventDefault()
  setCompanySaving(true)
  setError('')

let result

if (editingCompanyId) {
  result = await supabase
    .from('companies')
    .update(companyForm)
    .eq('id', editingCompanyId)
} else {
  result = await supabase
    .from('companies')
    .insert([
      {
        ...companyForm,
        owner_id: session.user.id
      }
    ])
}

const { error } = result

  if (error) {
    console.error('Error guardando cliente:', error)
    setError('No se ha podido guardar el cliente.')
    setCompanySaving(false)
    return
  }

  setCompanyForm({
    name: '',
    legal_name: '',
    tax_id: '',
    sector: '',
    website: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'España',
    status: 'activo',
    notes: ''
  })

  setShowCompanyForm(false)
  setEditingCompanyId(null)
  await loadCompanies()
  setCompanySaving(false)
}
  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Correo electrónico o contraseña incorrectos.')
      setLoading(false)
    }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault()

    setError('')
    setRecoveryMessage('')

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (newPassword !== repeatPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error(error)
      setError('No se ha podido actualizar la contraseña.')
      setLoading(false)
      return
    }

    setNewPassword('')
    setRepeatPassword('')
    setRecoveryMessage('Contraseña actualizada correctamente.')

    await supabase.auth.signOut()

    setSession(null)
    setProfile(null)
    setRecoveryMode(false)
    setLoading(false)

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    )
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h2>Cargando Globaltec CRM...</h2>
        </div>
      </div>
    )
  }

  if (recoveryMode) {
    return (
      <div className="login-page">
        <div className="login-card">

          <div className="login-brand">
            <strong>GLOBALTEC</strong>
            <span> CRM</span>
          </div>

          <h1>Nueva contraseña</h1>

          <p className="login-description">
            Introduce tu nueva contraseña de acceso.
          </p>

          <form onSubmit={handlePasswordUpdate}>

            <label>Nueva contraseña</label>

            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña"
              required
            />

            <label>Repetir contraseña</label>

            <input
              type="password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
            />

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button type="submit">
              Guardar contraseña
            </button>

          </form>

          <div className="login-footer">
            Globaltec CRM · Recuperación de acceso
          </div>

        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-card">

          <div className="login-brand">
            <strong>GLOBALTEC</strong>
            <span> CRM</span>
          </div>

          <h1>Bienvenido</h1>

          <p className="login-description">
            Accede a la plataforma de gestión comercial.
          </p>

          {recoveryMessage && (
            <div className="status">
              <span className="status-dot"></span>
              {recoveryMessage}
            </div>
          )}

          <form onSubmit={handleLogin}>

            <label>Correo electrónico</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />

            <label>Contraseña</label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              required
            />

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button type="submit">
              Entrar
            </button>

          </form>

          <div className="login-footer">
            Globaltec CRM · Acceso privado
          </div>

        </div>
      </div>
    )
  }

  return (
    <div className="app">

      <header className="header">

        <div>
          <span className="brand">GLOBALTEC</span>
          <span className="brand-subtitle"> CRM</span>
        </div>

        <div className="user-area">

          <span>
            {profile?.full_name || session.user.email}
          </span>

          <span className="role-badge">
            {profile?.role || 'usuario'}
          </span>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>

        </div>

      </header>
<main className="crm-main">
  <aside className="sidebar">
    <nav className="sidebar-nav">
<button
  className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
  onClick={() => setCurrentPage('dashboard')}
>
        <span>▦</span>
        Inicio
      </button>
<button
  className={`nav-item ${currentPage === 'clients' ? 'active' : ''}`}
  onClick={() => {
    setCurrentPage('clients')
    loadCompanies()
  }}
>
  <span>👥</span>
  Clientes
</button>


      <button className="nav-item">
        <span>👤</span>
        Contactos
      </button>

      <button className="nav-item">
        <span>◎</span>
        Oportunidades
      </button>

      <button className="nav-item">
        <span>☎</span>
        Llamadas
      </button>

      <button className="nav-item">
        <span>✓</span>
        Tareas
      </button>

      <button className="nav-item">
        <span>▥</span>
        Informes
      </button>
    </nav>
  </aside>

  <section className="dashboard">
  {currentPage === 'clients' ? (
 <>
  <div className="clients-page">
    <div className="dashboard-heading">
      <div>
        <p className="dashboard-kicker">GLOBALTEC CRM</p>
        <h1>Clientes</h1>
        <p>Gestión de empresas y clientes.</p>
      </div>

<button
  className="primary-action"
  onClick={() => setShowCompanyForm(true)}
>
  + Nuevo cliente
</button>
    </div>
</div>
{selectedCompany && (
  <div className="dashboard-card company-detail">
    <div className="company-detail-header">
      <div>
        <p className="dashboard-kicker">FICHA DE CLIENTE</p>
        <h2>{selectedCompany.name}</h2>
        <p>{selectedCompany.legal_name || 'Sin razón social'}</p>
      </div>

      <button
        type="button"
        className="secondary-action"
        onClick={() => setSelectedCompany(null)}
      >
        Cerrar
      </button>
    </div>

    <div className="company-detail-grid">
      <div>
        <span>CIF / NIF</span>
        <strong>{selectedCompany.tax_id || '—'}</strong>
      </div>

      <div>
        <span>Sector</span>
        <strong>{selectedCompany.sector || '—'}</strong>
      </div>

      <div>
        <span>Teléfono</span>
        <strong>{selectedCompany.phone || '—'}</strong>
      </div>

      <div>
        <span>Email</span>
        <strong>{selectedCompany.email || '—'}</strong>
      </div>

      <div>
        <span>Web</span>
        <strong>{selectedCompany.website || '—'}</strong>
      </div>

      <div>
        <span>Estado</span>
        <strong>{selectedCompany.status || 'Activo'}</strong>
      </div>

      <div>
        <span>Localidad</span>
        <strong>{selectedCompany.city || '—'}</strong>
      </div>

      <div>
        <span>Provincia</span>
        <strong>{selectedCompany.province || '—'}</strong>
      </div>

      <div className="detail-wide">
        <span>Dirección</span>
        <strong>
          {selectedCompany.address || '—'}
          {selectedCompany.postal_code
            ? ` · ${selectedCompany.postal_code}`
            : ''}
        </strong>
      </div>

      <div className="detail-wide">
        <span>Notas</span>
        <strong>{selectedCompany.notes || 'Sin notas'}</strong>
      </div>
    </div>

   
  </div>
)}
{showCompanyForm && (
  <div className="dashboard-card company-form-card">
    <div className="card-heading">
      <div>
<h2>{editingCompanyId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
<p>
  {editingCompanyId
    ? 'Modifica los datos de la empresa.'
    : 'Introduce los datos de la empresa.'}
</p>
      </div>
    </div>

    <form className="company-form" onSubmit={saveCompany}>
      <div className="form-grid">

        <div className="form-field">
          <label>Nombre comercial *</label>
          <input
            type="text"
            value={companyForm.name}
            onChange={(e) =>
              setCompanyForm({...companyForm, name: e.target.value})
            }
            required
          />
        </div>

        <div className="form-field">
          <label>Razón social</label>
          <input
            type="text"
            value={companyForm.legal_name}
            onChange={(e) =>
              setCompanyForm({...companyForm, legal_name: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>CIF / NIF</label>
          <input
            type="text"
            value={companyForm.tax_id}
            onChange={(e) =>
              setCompanyForm({...companyForm, tax_id: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>Sector</label>
          <input
            type="text"
            value={companyForm.sector}
            onChange={(e) =>
              setCompanyForm({...companyForm, sector: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>Teléfono</label>
          <input
            type="tel"
            value={companyForm.phone}
            onChange={(e) =>
              setCompanyForm({...companyForm, phone: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>Email</label>
          <input
            type="email"
            value={companyForm.email}
            onChange={(e) =>
              setCompanyForm({...companyForm, email: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>Web</label>
          <input
            type="text"
            value={companyForm.website}
            onChange={(e) =>
              setCompanyForm({...companyForm, website: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>Estado</label>
          <select
            value={companyForm.status}
            onChange={(e) =>
              setCompanyForm({...companyForm, status: e.target.value})
            }
          >
            <option value="activo">Activo</option>
            <option value="potencial">Potencial</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>

        <div className="form-field form-field-wide">
          <label>Dirección</label>
          <input
            type="text"
            value={companyForm.address}
            onChange={(e) =>
              setCompanyForm({...companyForm, address: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>Localidad</label>
          <input
            type="text"
            value={companyForm.city}
            onChange={(e) =>
              setCompanyForm({...companyForm, city: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>Provincia</label>
          <input
            type="text"
            value={companyForm.province}
            onChange={(e) =>
              setCompanyForm({...companyForm, province: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>Código postal</label>
          <input
            type="text"
            value={companyForm.postal_code}
            onChange={(e) =>
              setCompanyForm({...companyForm, postal_code: e.target.value})
            }
          />
        </div>

        <div className="form-field">
          <label>País</label>
          <input
            type="text"
            value={companyForm.country}
            onChange={(e) =>
              setCompanyForm({...companyForm, country: e.target.value})
            }
          />
        </div>

        <div className="form-field form-field-wide">
          <label>Notas</label>
          <textarea
            rows="4"
            value={companyForm.notes}
            onChange={(e) =>
              setCompanyForm({...companyForm, notes: e.target.value})
            }
          />
        </div>

      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="form-actions">
        <button
          type="button"
          className="secondary-action"
onClick={() => {
  setShowCompanyForm(false)
  setEditingCompanyId(null)
}}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="primary-action"
          disabled={companySaving}
        >
{companySaving
  ? 'Guardando...'
  : editingCompanyId
    ? 'Guardar cambios'
    : 'Guardar cliente'}
        </button>
      </div>
    </form>
  </div>
)}
  {companiesLoading ? (
      <div className="dashboard-card">
        Cargando clientes...
      </div>
    ) : companies.length === 0 ? (
      <div className="dashboard-card">
        <div className="empty-state">
          <strong>No hay clientes registrados</strong>
          <span>Pulsa “+ Nuevo cliente” para añadir el primero.</span>
        </div>
      </div>
    ) : (
<div className="dashboard-card clients-list">
  <div className="clients-table-header">
    <span>Cliente</span>
    <span>Sector</span>
    <span>Contacto</span>
    <span>Estado</span>
    <span>Acciones</span>
  </div>

  {companies.map((company) => (
    <div className="client-row" key={company.id}>
<div
  className="client-main client-main-clickable"
  onClick={() => setSelectedCompany(company)}
>
  <strong>{company.name}</strong>
  <small>{company.legal_name || 'Sin razón social'}</small>
</div>

      <div>
        {company.sector || '—'}
      </div>

      <div className="client-contact">
        <span>{company.phone || 'Sin teléfono'}</span>
        <small>{company.email || 'Sin email'}</small>
      </div>

      <div>
        <span className={`client-status ${company.status || 'activo'}`}>
          {company.status || 'Activo'}
        </span>
      </div>

      <div className="client-actions">

<button
  type="button"
  onClick={() => editCompany(company)}
>
  Editar
</button>
      </div>
    </div>
  ))}
</div>
    )}

</>
) : (
<>
  <div className="dashboard-heading">
      <div>
        <p className="dashboard-kicker">GLOBALTEC CRM</p>
        <h1>Panel de control</h1>
        <p>Resumen de la actividad comercial.</p>
      </div>

      <button className="primary-action">
        + Nuevo cliente
      </button>
    </div>

    <div className="stats-grid">
      <div className="stat-card">
        <span>Clientes</span>
        <strong>0</strong>
        <small>Total registrados</small>
      </div>

      <div className="stat-card">
        <span>Oportunidades</span>
        <strong>0</strong>
        <small>En seguimiento</small>
      </div>

      <div className="stat-card">
        <span>Tareas pendientes</span>
        <strong>0</strong>
        <small>Por completar</small>
      </div>

      <div className="stat-card">
        <span>Llamadas</span>
        <strong>0</strong>
        <small>Registradas</small>
      </div>
    </div>

    <div className="dashboard-grid">
      <div className="dashboard-card">
        <div className="card-heading">
          <div>
            <h2>Actividad reciente</h2>
            <p>Últimas gestiones realizadas</p>
          </div>
        </div>

        <div className="empty-state">
          <strong>Sin actividad todavía</strong>
          <span>Las últimas gestiones aparecerán aquí.</span>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-heading">
          <div>
            <h2>Próximas tareas</h2>
            <p>Seguimientos pendientes</p>
          </div>
        </div>

        <div className="empty-state">
          <strong>Todo al día</strong>
          <span>No hay tareas pendientes.</span>
        </div>
      </div>
    </div>
 </>
  )}
  </section>
</main>
     

    </div>
  )
}

export default App
