import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)

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

  async function handleLogout() {
    await supabase.auth.signOut()
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

            {error && <div className="login-error">{error}</div>}

            <button type="submit">Entrar</button>
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

          <button className="logout-button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="welcome">
        <div className="welcome-card">
          <span className="badge">
            {profile?.role === 'admin' ? 'ADMINISTRADOR' : 'CRM'}
          </span>

          <h1>Globaltec CRM</h1>

          <p>
            Sesión iniciada correctamente.
          </p>

          <div className="status">
            <span className="status-dot"></span>
            Conectado a Globaltec CRM
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
