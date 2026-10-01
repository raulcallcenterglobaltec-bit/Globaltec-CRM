import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)

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
      <button className="nav-item active">
        <span>▦</span>
        Inicio
      </button>

      <button className="nav-item">
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
  </section>
</main>
     

    </div>
  )
}

export default App
