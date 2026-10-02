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
const [contacts, setContacts] = useState([])
const [contactsLoading, setContactsLoading] = useState(false)
const [showContactForm, setShowContactForm] = useState(false)
const [contactSaving, setContactSaving] = useState(false)
const [editingContactId, setEditingContactId] = useState(null)

const [contactForm, setContactForm] = useState({
  company_id: '',
  first_name: '',
  last_name: '',
  job_title: '',
  phone: '',
  mobile: '',
  email: '',
  preferred_contact_method: 'telefono',
  notes: ''
})  
const [opportunities, setOpportunities] = useState([])
const [opportunitiesLoading, setOpportunitiesLoading] = useState(false)
const [showOpportunityForm, setShowOpportunityForm] = useState(false)
const [opportunitySaving, setOpportunitySaving] = useState(false)
const [editingOpportunityId, setEditingOpportunityId] = useState(null)

const [pipelineStages, setPipelineStages] = useState([])
const [leadSources, setLeadSources] = useState([])
const [services, setServices] = useState([])

const [opportunityForm, setOpportunityForm] = useState({
  title: '',
  company_id: '',
  contact_id: '',
 service_ids: [],
  source_id: '',
  stage_id: '',
  estimated_value: '',
  monthly_value: '',
  probability: '',
  expected_close_date: '',
  description: '',
  lost_reason: ''
})
const [tasks, setTasks] = useState([])
const [tasksLoading, setTasksLoading] = useState(false)
const [showTaskForm, setShowTaskForm] = useState(false)
const [taskSaving, setTaskSaving] = useState(false)
const [editingTaskId, setEditingTaskId] = useState(null)

const [taskForm, setTaskForm] = useState({
  title: '',
  description: '',
task_type: 'follow_up',
status: 'pending',
priority: 'normal',
  due_date: '',
  company_id: '',
  contact_id: '',
  opportunity_id: '',
  assigned_to: ''
})
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
        loadCompanies()
        loadOpportunities()
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
        loadCompanies()
        loadOpportunities()
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
async function loadContacts() {
  setContactsLoading(true)

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      companies (
        name
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error cargando contactos:', error)
    setContacts([])
  } else {
    setContacts(data || [])
  }

  setContactsLoading(false)
}
async function loadOpportunities() {
  setOpportunitiesLoading(true)

  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      companies (
        name
      ),
      contacts (
        first_name,
        last_name
      ),
      pipeline_stages (
        name,
        position
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error cargando oportunidades:', error)
    setOpportunities([])
  } else {
    setOpportunities(data || [])
  }

  setOpportunitiesLoading(false)
}
async function loadTasks() {
  setTasksLoading(true)

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      companies (
        name
      ),
      contacts (
        first_name,
        last_name
      ),
      opportunities (
        title
      )
    `)
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Error cargando tareas:', error)
    setTasks([])
  } else {
    setTasks(data || [])
  }

  setTasksLoading(false)
}
async function loadOpportunityOptions() {
  const [
    stagesResult,
    sourcesResult,
    servicesResult
  ] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('*')
      .order('position', { ascending: true }),

    supabase
      .from('lead_sources')
      .select('*')
      .order('name', { ascending: true }),

    supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true })
  ])

  if (stagesResult.error) {
    console.error('Error cargando etapas:', stagesResult.error)
  } else {
    setPipelineStages(stagesResult.data || [])
  }

  if (sourcesResult.error) {
    console.error('Error cargando orígenes:', sourcesResult.error)
  } else {
    setLeadSources(sourcesResult.data || [])
  }

  if (servicesResult.error) {
    console.error('Error cargando servicios:', servicesResult.error)
  } else {
    setServices(servicesResult.data || [])
  }
}
function editContact(contact) {
  setEditingContactId(contact.id)

  setContactForm({
    company_id: contact.company_id || '',
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    job_title: contact.job_title || '',
    phone: contact.phone || '',
    mobile: contact.mobile || '',
    email: contact.email || '',
    preferred_contact_method: contact.preferred_contact_method || 'telefono',
    notes: contact.notes || ''
  })

  setShowContactForm(true)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function saveContact(e) {
  e.preventDefault()
  setContactSaving(true)
  setError('')

let result

if (editingContactId) {
  result = await supabase
    .from('contacts')
    .update(contactForm)
    .eq('id', editingContactId)
} else {
  result = await supabase
    .from('contacts')
    .insert([
      {
        ...contactForm,
        owner_id: session.user.id
      }
    ])
}

const { error } = result

  if (error) {
    console.error('Error guardando contacto:', error)
    setError('No se ha podido guardar el contacto.')
    setContactSaving(false)
    return
  }

  setContactForm({
    company_id: '',
    first_name: '',
    last_name: '',
    job_title: '',
    phone: '',
    mobile: '',
    email: '',
    preferred_contact_method: 'telefono',
    notes: ''
  })

  setShowContactForm(false)
  setEditingContactId(null)
  await loadContacts()
  setContactSaving(false)
}
  async function saveOpportunity(e) {
  e.preventDefault()
  setOpportunitySaving(true)
  setError('')

  const opportunityData = {
    title: opportunityForm.title,
    company_id: opportunityForm.company_id || null,
    contact_id: opportunityForm.contact_id || null,
    source_id: opportunityForm.source_id || null,
    stage_id: opportunityForm.stage_id || null,
    estimated_value: opportunityForm.estimated_value
      ? Number(opportunityForm.estimated_value)
      : null,
    monthly_value: opportunityForm.monthly_value
      ? Number(opportunityForm.monthly_value)
      : null,
    probability: opportunityForm.probability
      ? Number(opportunityForm.probability)
      : null,
    expected_close_date: opportunityForm.expected_close_date || null,
    description: opportunityForm.description || null,
    lost_reason: opportunityForm.lost_reason || null
  }

  let result

  if (editingOpportunityId) {
    result = await supabase
      .from('opportunities')
      .update(opportunityData)
      .eq('id', editingOpportunityId)
  } else {
    result = await supabase
      .from('opportunities')
      .insert([
        {
          ...opportunityData,
          owner_id: session.user.id
        }
      ])
.select('id')
  }

  const { error } = result

  if (error) {
    console.error('Error guardando oportunidad:', error)
    setError('No se ha podido guardar la oportunidad.')
    setOpportunitySaving(false)
    return
  }
const opportunityId = editingOpportunityId || result.data?.[0]?.id

if (opportunityId) {
  const { error: deleteServicesError } = await supabase
    .from('opportunity_services')
    .delete()
    .eq('opportunity_id', opportunityId)

  if (deleteServicesError) {
    console.error(
      'Error eliminando servicios anteriores:',
      deleteServicesError
    )
  }

  if (opportunityForm.service_ids.length > 0) {
    const servicesToInsert = opportunityForm.service_ids.map(
      (serviceId) => ({
        opportunity_id: opportunityId,
        service_id: serviceId
      })
    )

    const { error: servicesError } = await supabase
      .from('opportunity_services')
      .insert(servicesToInsert)

    if (servicesError) {
      console.error(
        'Error guardando servicios de la oportunidad:',
        servicesError
      )
      setError('La oportunidad se guardó, pero hubo un problema con los servicios.')
      setOpportunitySaving(false)
      return
    }
  }
}
  setShowOpportunityForm(false)
  setEditingOpportunityId(null)
  await loadOpportunities()
  setOpportunitySaving(false)
}
async function editOpportunity(opportunity) {
  setEditingOpportunityId(opportunity.id)

  const { data: opportunityServices, error: servicesError } = await supabase
    .from('opportunity_services')
    .select('service_id')
    .eq('opportunity_id', opportunity.id)

  if (servicesError) {
    console.error('Error cargando servicios de la oportunidad:', servicesError)
  }

  setOpportunityForm({
    title: opportunity.title || '',
    company_id: opportunity.company_id || '',
    contact_id: opportunity.contact_id || '',
    service_ids: opportunityServices?.map((item) => item.service_id) || [],
    source_id: opportunity.source_id || '',
    stage_id: opportunity.stage_id || '',
    estimated_value: opportunity.estimated_value ?? '',
    monthly_value: opportunity.monthly_value ?? '',
    probability: opportunity.probability ?? '',
    expected_close_date: opportunity.expected_close_date || '',
    description: opportunity.description || '',
    lost_reason: opportunity.lost_reason || ''
  })

  setShowOpportunityForm(true)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function saveTask(e) {
  e.preventDefault()
  setTaskSaving(true)
  setError('')

  const taskData = {
    title: taskForm.title,
    description: taskForm.description || null,
    task_type: taskForm.task_type,
    status: taskForm.status,
    priority: taskForm.priority,
    due_date: taskForm.due_date || null,
    company_id: taskForm.company_id || null,
    contact_id: taskForm.contact_id || null,
    opportunity_id: taskForm.opportunity_id || null,
    assigned_to: taskForm.assigned_to || session.user.id,
    completed_at:
      taskForm.status === 'completed'
        ? new Date().toISOString()
        : null
  }

  let result

  if (editingTaskId) {
    result = await supabase
      .from('tasks')
      .update(taskData)
      .eq('id', editingTaskId)
  } else {
    result = await supabase
      .from('tasks')
      .insert([
        {
          ...taskData,
          created_by: session.user.id
        }
      ])
  }

  const { error } = result

  if (error) {
    console.error('Error guardando tarea:', error)
    setError('No se ha podido guardar la tarea.')
    setTaskSaving(false)
    return
  }

  setShowTaskForm(false)
  setEditingTaskId(null)
  await loadTasks()
  setTaskSaving(false)
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
onClick={() => {
  setCurrentPage('dashboard')
  loadCompanies()
  loadOpportunities()
}}
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


<button
  className={`nav-item ${currentPage === 'contacts' ? 'active' : ''}`}
onClick={() => {
  setCurrentPage('contacts')
  loadCompanies()
  loadContacts()
}}
>
  <span>♟</span>
  Contactos
</button>

<button
  className={`nav-item ${currentPage === 'opportunities' ? 'active' : ''}`}
onClick={() => {
  setCurrentPage('opportunities')
  loadCompanies()
  loadContacts()
  loadOpportunities()
  loadOpportunityOptions()
}}
>
  <span>◎</span>
  Oportunidades
</button>

      <button className="nav-item">
        <span>☎</span>
        Llamadas
      </button>

<button
  className={`nav-item ${currentPage === 'tasks' ? 'active' : ''}`}
  onClick={() => {
    setCurrentPage('tasks')
    loadTasks()
    loadCompanies()
    loadContacts()
    loadOpportunities()
  }}
>
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
) : currentPage === 'contacts' ? (
  <>
    <div className="dashboard-heading">
      <div>
        <p className="dashboard-kicker">GLOBALTEC CRM</p>
        <h1>Contactos</h1>
        <p>Gestión de personas de contacto de tus clientes.</p>
      </div>

<button
  className="primary-action"
  onClick={() => setShowContactForm(true)}
>
  + Nuevo contacto
</button>
    </div>
{showContactForm && (
  <div className="dashboard-card company-form-card">
    <div className="card-heading">
      <div>
<h2>{editingContactId ? 'Editar contacto' : 'Nuevo contacto'}</h2>
<p>
  {editingContactId
    ? 'Modifica los datos de la persona de contacto.'
    : 'Introduce los datos de la persona de contacto.'}
</p>
      </div>
    </div>

<form className="company-form" onSubmit={saveContact}>
  <div className="form-grid">

        <div className="form-field">
          <label>Empresa *</label>
          <select
            value={contactForm.company_id}
            onChange={(e) =>
              setContactForm({
                ...contactForm,
                company_id: e.target.value
              })
            }
            required
          >
            <option value="">Selecciona una empresa</option>

            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Cargo</label>
          <input
            type="text"
            value={contactForm.job_title}
            onChange={(e) =>
              setContactForm({
                ...contactForm,
                job_title: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Nombre *</label>
          <input
            type="text"
            value={contactForm.first_name}
            onChange={(e) =>
              setContactForm({
                ...contactForm,
                first_name: e.target.value
              })
            }
            required
          />
        </div>

        <div className="form-field">
          <label>Apellidos</label>
          <input
            type="text"
            value={contactForm.last_name}
            onChange={(e) =>
              setContactForm({
                ...contactForm,
                last_name: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Teléfono</label>
          <input
            type="tel"
            value={contactForm.phone}
            onChange={(e) =>
              setContactForm({
                ...contactForm,
                phone: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Móvil</label>
          <input
            type="tel"
            value={contactForm.mobile}
            onChange={(e) =>
              setContactForm({
                ...contactForm,
                mobile: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Email</label>
          <input
            type="email"
            value={contactForm.email}
            onChange={(e) =>
              setContactForm({
                ...contactForm,
                email: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Contacto preferido</label>
          <select
            value={contactForm.preferred_contact_method}
            onChange={(e) =>
              setContactForm({
                ...contactForm,
                preferred_contact_method: e.target.value
              })
            }
          >
            <option value="telefono">Teléfono</option>
            <option value="movil">Móvil</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div className="form-field form-field-full">
          <label>Notas</label>
          <textarea
            value={contactForm.notes}
            onChange={(e) =>
              setContactForm({
                ...contactForm,
                notes: e.target.value
              })
            }
          />
        </div>

      </div>

      <div className="form-actions">
        <button
          type="button"
          className="secondary-action"
onClick={() => {
  setShowContactForm(false)
  setEditingContactId(null)
}}
        >
          Cancelar
        </button>

<button
  type="submit"
  className="primary-action"
  disabled={contactSaving}
>
{contactSaving
  ? 'Guardando...'
  : editingContactId
    ? 'Guardar cambios'
    : 'Guardar contacto'}
</button>
      </div>
    </form>
  </div>
)}
{contactsLoading ? (
  <div className="dashboard-card">
    Cargando contactos...
  </div>
) : contacts.length === 0 ? (
  <div className="dashboard-card">
    <div className="empty-state">
      <strong>No hay contactos registrados</strong>
      <span>Pulsa “+ Nuevo contacto” para añadir el primero.</span>
    </div>
  </div>
) : (
  <div className="dashboard-card clients-list">
    <div className="clients-table-header">
      <span>Contacto</span>
      <span>Empresa</span>
      <span>Cargo</span>
      <span>Teléfono</span>
      <span>Acciones</span>
    </div>

    {contacts.map((contact) => (
      <div className="client-row" key={contact.id}>
        <div className="client-main">
          <strong>
            {contact.first_name} {contact.last_name}
          </strong>
          <small>{contact.email || 'Sin email'}</small>
        </div>

        <div>
          {contact.companies?.name || 'Sin empresa'}
        </div>

        <div>
          {contact.job_title || '—'}
        </div>

        <div className="client-contact">
          <span>{contact.phone || contact.mobile || 'Sin teléfono'}</span>
          <small>{contact.preferred_contact_method || ''}</small>
        </div>

<div className="client-actions">
  <button
    type="button"
    onClick={() => editContact(contact)}
  >
    Editar
  </button>
</div>
      </div>
    ))}
  </div>
)}
  </>
) : currentPage === 'opportunities' ? (
  <>
    <div className="dashboard-heading">
      <div>
        <p className="dashboard-kicker">GLOBALTEC CRM</p>
        <h1>Oportunidades</h1>
        <p>Gestión y seguimiento de oportunidades comerciales.</p>
      </div>

<button
  className="primary-action"
  onClick={() => {
    setEditingOpportunityId(null)
    setOpportunityForm({
      title: '',
      company_id: '',
      contact_id: '',
service_ids: [],
      source_id: '',
      stage_id: pipelineStages[0]?.id || '',
      estimated_value: '',
      monthly_value: '',
      probability: '',
      expected_close_date: '',
      description: '',
      lost_reason: ''
    })
    setShowOpportunityForm(true)
  }}
>
  + Nueva oportunidad
</button>
    </div>
{showOpportunityForm && (
  <div className="dashboard-card">
    <div className="card-heading">
      <div>
        <h2>
          {editingOpportunityId ? 'Editar oportunidad' : 'Nueva oportunidad'}
        </h2>
        <p>Introduce los datos de la oportunidad comercial.</p>
      </div>
    </div>

<form
  className="company-form"
  onSubmit={saveOpportunity}
>
      <div className="form-grid">

        <div className="form-field">
          <label>Título *</label>
          <input
            type="text"
            value={opportunityForm.title}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                title: e.target.value
              })
            }
            required
          />
        </div>

        <div className="form-field">
          <label>Cliente *</label>
          <select
            value={opportunityForm.company_id}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                company_id: e.target.value,
                contact_id: ''
              })
            }
            required
          >
            <option value="">Seleccionar cliente</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Contacto</label>
          <select
            value={opportunityForm.contact_id}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                contact_id: e.target.value
              })
            }
          >
            <option value="">Sin contacto</option>
            {contacts
              .filter(
                (contact) =>
                  !opportunityForm.company_id ||
                  contact.company_id === opportunityForm.company_id
              )
              .map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {`${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
                </option>
              ))}
          </select>
        </div>

        <div className="form-field">
          <label>Etapa *</label>
          <select
            value={opportunityForm.stage_id}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                stage_id: e.target.value
              })
            }
            required
          >
            <option value="">Seleccionar etapa</option>
            {pipelineStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Origen</label>
          <select
            value={opportunityForm.source_id}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                source_id: e.target.value
              })
            }
          >
            <option value="">Sin origen</option>
            {leadSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </div>

<div className="form-field form-field-full">
  <label>Servicios</label>

  <div className="services-selector">
    {services.length === 0 ? (
      <span>No hay servicios disponibles</span>
    ) : (
      services.map((service) => (
        <label className="service-option" key={service.id}>
          <input
            type="checkbox"
            checked={opportunityForm.service_ids.includes(service.id)}
            onChange={(e) => {
              const serviceIds = e.target.checked
                ? [...opportunityForm.service_ids, service.id]
                : opportunityForm.service_ids.filter(
                    (id) => id !== service.id
                  )

              setOpportunityForm({
                ...opportunityForm,
                service_ids: serviceIds
              })
            }}
          />

          <span>{service.name}</span>
        </label>
      ))
    )}
  </div>
</div>

        <div className="form-field">
          <label>Valor estimado (€)</label>
          <input
            type="number"
            step="0.01"
            value={opportunityForm.estimated_value}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                estimated_value: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Cuota mensual (€)</label>
          <input
            type="number"
            step="0.01"
            value={opportunityForm.monthly_value}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                monthly_value: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Probabilidad (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={opportunityForm.probability}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                probability: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Fecha prevista de cierre</label>
          <input
            type="date"
            value={opportunityForm.expected_close_date}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                expected_close_date: e.target.value
              })
            }
          />
        </div>

        <div className="form-field form-field-full">
          <label>Descripción</label>
          <textarea
            value={opportunityForm.description}
            onChange={(e) =>
              setOpportunityForm({
                ...opportunityForm,
                description: e.target.value
              })
            }
          />
        </div>

      </div>

      <div className="form-actions">
        <button
          type="button"
          className="secondary-action"
          onClick={() => {
            setShowOpportunityForm(false)
            setEditingOpportunityId(null)
          }}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="primary-action"
          disabled={opportunitySaving}
        >
          {opportunitySaving ? 'Guardando...' : 'Guardar oportunidad'}
        </button>
      </div>
    </form>
  </div>
)}
{opportunitiesLoading ? (
  <div className="dashboard-card">
    Cargando oportunidades...
  </div>
) : opportunities.length === 0 ? (
  <div className="dashboard-card">
    <div className="empty-state">
      <strong>No hay oportunidades registradas</strong>
      <span>Pulsa “+ Nueva oportunidad” para añadir la primera.</span>
    </div>
  </div>
) : (
  <div className="dashboard-card clients-list">
    <div className="clients-table-header">
      <span>Oportunidad</span>
      <span>Cliente</span>
      <span>Etapa</span>
      <span>Valor</span>
      <span>Acciones</span>
    </div>

    {opportunities.map((opportunity) => (
      <div className="client-row" key={opportunity.id}>
        <div className="client-main">
          <strong>{opportunity.title}</strong>
          <small>
            {opportunity.contacts
              ? `${opportunity.contacts.first_name || ''} ${opportunity.contacts.last_name || ''}`.trim()
              : 'Sin contacto'}
          </small>
        </div>

        <div>
          {opportunity.companies?.name || 'Sin cliente'}
        </div>

        <div>
          {opportunity.pipeline_stages?.name || 'Sin etapa'}
        </div>

        <div>
          {opportunity.estimated_value
            ? `${Number(opportunity.estimated_value).toLocaleString('es-ES')} €`
            : '—'}
        </div>

<div className="client-actions">
  <button
    type="button"
    onClick={() => editOpportunity(opportunity)}
  >
    Editar
  </button>
</div>
      </div>
    ))}
  </div>
)}
  </>
) : currentPage === 'tasks' ? (
  <>
    <div className="dashboard-heading">
      <div>
        <p className="dashboard-kicker">GLOBALTEC CRM</p>
        <h1>Tareas</h1>
        <p>Gestión y seguimiento de tareas pendientes.</p>
      </div>

      <button
        className="primary-action"
        onClick={() => {
          setEditingTaskId(null)
          setTaskForm({
            title: '',
            description: '',
task_type: 'follow_up',
status: 'pending',
priority: 'normal',
            due_date: '',
            company_id: '',
            contact_id: '',
            opportunity_id: '',
            assigned_to: ''
          })
          setShowTaskForm(true)
        }}
      >
        + Nueva tarea
      </button>
    </div>
{showTaskForm && (
  <div className="dashboard-card">
    <div className="card-heading">
      <div>
        <h2>{editingTaskId ? 'Editar tarea' : 'Nueva tarea'}</h2>
        <p>Introduce los datos de la tarea.</p>
      </div>
    </div>

<form
  className="company-form"
  onSubmit={saveTask}
>
      <div className="form-grid">

        <div className="form-field">
          <label>Título *</label>
          <input
            type="text"
            value={taskForm.title}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                title: e.target.value
              })
            }
            required
          />
        </div>

        <div className="form-field">
          <label>Tipo</label>
          <select
            value={taskForm.task_type}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                task_type: e.target.value
              })
            }
          >
<option value="call">Llamada</option>
<option value="follow_up">Seguimiento</option>
<option value="email">Email</option>
<option value="meeting">Reunión</option>
<option value="proposal">Presupuesto</option>
<option value="general">Gestión</option>
          </select>
        </div>

        <div className="form-field">
          <label>Estado</label>
          <select
            value={taskForm.status}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                status: e.target.value
              })
            }
          >
<option value="pending">Pendiente</option>
<option value="in_progress">En curso</option>
<option value="completed">Completada</option>
<option value="cancelled">Cancelada</option>
          </select>
        </div>

        <div className="form-field">
          <label>Prioridad</label>
          <select
            value={taskForm.priority}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                priority: e.target.value
              })
            }
          >
<option value="low">Baja</option>
<option value="normal">Normal</option>
<option value="high">Alta</option>
<option value="urgent">Urgente</option>
          </select>
        </div>

        <div className="form-field">
          <label>Fecha límite</label>
          <input
            type="datetime-local"
            value={taskForm.due_date}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                due_date: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Cliente</label>
          <select
            value={taskForm.company_id}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                company_id: e.target.value,
                contact_id: ''
              })
            }
          >
            <option value="">Sin cliente</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Contacto</label>
          <select
            value={taskForm.contact_id}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                contact_id: e.target.value
              })
            }
          >
            <option value="">Sin contacto</option>
            {contacts
              .filter(
                (contact) =>
                  !taskForm.company_id ||
                  contact.company_id === taskForm.company_id
              )
              .map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {`${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
                </option>
              ))}
          </select>
        </div>

        <div className="form-field">
          <label>Oportunidad</label>
          <select
            value={taskForm.opportunity_id}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                opportunity_id: e.target.value
              })
            }
          >
            <option value="">Sin oportunidad</option>
            {opportunities
              .filter(
                (opportunity) =>
                  !taskForm.company_id ||
                  opportunity.company_id === taskForm.company_id
              )
              .map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.title}
                </option>
              ))}
          </select>
        </div>

        <div className="form-field form-field-full">
          <label>Descripción</label>
          <textarea
            value={taskForm.description}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                description: e.target.value
              })
            }
          />
        </div>

      </div>

      <div className="form-actions">
        <button
          type="button"
          className="secondary-action"
          onClick={() => {
            setShowTaskForm(false)
            setEditingTaskId(null)
          }}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="primary-action"
          disabled={taskSaving}
        >
          {taskSaving ? 'Guardando...' : 'Guardar tarea'}
        </button>
      </div>
    </form>
  </div>
)}
    {tasksLoading ? (
      <div className="dashboard-card">
        Cargando tareas...
      </div>
    ) : tasks.length === 0 ? (
      <div className="dashboard-card">
        <div className="empty-state">
          <strong>No hay tareas registradas</strong>
          <span>Pulsa “+ Nueva tarea” para añadir la primera.</span>
        </div>
      </div>
    ) : (
      <div className="dashboard-card clients-list">
        <div className="clients-table-header">
          <span>Tarea</span>
          <span>Cliente</span>
          <span>Estado</span>
          <span>Prioridad</span>
          <span>Acciones</span>
        </div>

        {tasks.map((task) => (
          <div className="client-row" key={task.id}>
            <div className="client-main">
              <strong>{task.title}</strong>
              <small>{task.task_type || 'Tarea'}</small>
            </div>

            <div>
              {task.companies?.name || 'Sin cliente'}
            </div>

            <div>
              {task.status || 'Pendiente'}
            </div>

            <div>
              {task.priority || 'Normal'}
            </div>

            <div className="client-actions">
              <button type="button">
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

<button
  className="primary-action"
  onClick={() => {
    setCurrentPage('clients')
    setEditingCompanyId(null)
    setSelectedCompany(null)
    setShowCompanyForm(true)
    loadCompanies()
  }}
>
  + Nuevo cliente
</button>
    </div>

    <div className="stats-grid">
      <div className="stat-card">
        <span>Clientes</span>
<strong>{companies.length}</strong>
        <small>Total registrados</small>
      </div>

      <div className="stat-card">
        <span>Oportunidades</span>
<strong>{opportunities.length}</strong>
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
