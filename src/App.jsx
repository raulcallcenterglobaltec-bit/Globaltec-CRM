import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

function CRMIcon({ name, className = '' }) {
  const paths = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    clients: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    contacts: 'M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    opportunities: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M12 10v4 M10 12h4',
    calls: 'M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C10 21 3 14 3 5a2 2 0 0 1 2-2',
    agenda: 'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 17h2',
    tasks: 'M9 5h11v16H4V5h2 M9 3h6v4H9z M8 14l3 3 5-6',
    reports: 'M4 3v18h17 M8 17v-5 M13 17V7 M18 17v-8',
    permissions: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0'
  }
  return <svg className={`crm-icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.dashboard} /></svg>
}


function brandingColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback
}
function brandingInk(color) {
  const rgb = color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
  const [r, g, b] = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return .2126 * r + .7152 * g + .0722 * b > .179 ? '#000000' : '#ffffff'
}
function BrandLogo({ url, name }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return null
  return <img className="brand-logo" src={url} alt={`Logotipo de ${name}`} onError={() => setFailed(true)} referrerPolicy="no-referrer" />
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const [modulePermissions, setModulePermissions] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [activeOrg, setActiveOrg] = useState('')
  const [showNewOrganization, setShowNewOrganization] = useState(false)
  const canCreateOrganization = !!profile?.active && profile?.role === 'admin' && session?.user?.id === '4572a164-9b54-46b5-8382-4e50a8b4dfef'
  const [brandingAdmin, setBrandingAdmin] = useState(null)
  const organization = organizations.find(o => o.id === activeOrg)
  const primaryColor = brandingColor(organization?.settings?.branding?.primary_color, '#087f74')
  const sidebarColor = brandingColor(organization?.settings?.branding?.sidebar_color, '#142c48')
  const canBrand = !!profile?.active && profile?.role !== 'demo' && brandingAdmin?.org === activeOrg && brandingAdmin?.user === session?.user?.id && brandingAdmin?.allowed
  useEffect(() => {
    let cancelled = false
    setBrandingAdmin(null)
    if (!activeOrg || !session?.user?.id || !profile?.active || profile?.role === 'demo') return
    supabase.from('organization_members').select('role').eq('organization_id', activeOrg).eq('user_id', session.user.id).eq('active', true).maybeSingle().then(({ data, error }) => {
      if (!cancelled) setBrandingAdmin({ org: activeOrg, user: session.user.id, allowed: !error && data?.role === 'admin' })
    })
    return () => { cancelled = true }
  }, [activeOrg, session?.user?.id, profile?.active, profile?.role])
  const accessRef = useRef({ org: '', permissions: [], user: null })
  function canViewModule(module) {
    return !!profile?.active && modulePermissions.some(p => p.organization_id === activeOrg && p.module === module && p.can_view)
  }
  function canEditModule(module) {
    return canViewModule(module) && profile.role !== 'demo' && modulePermissions.some(p => p.organization_id === activeOrg && p.module === module && p.can_edit)
  }
  function clearCRMData() {
    setClientSearch(''); setClientStatusFilter('all'); setContactSearch(''); setOpportunitySearch(''); setOpportunityStageFilter('all'); setCallSearch(''); setCallTypeFilter('all'); setCallStatusFilter('all'); setTaskSearch(''); setTaskStatusFilter('all'); setTaskPriorityFilter('all')
    setCompanies([]); setContacts([]); setOpportunities([]); setTasks([]); setCalls([])
    setPipelineStages([]); setLeadSources([]); setServices([])
    setSelectedCompany(null); setShowCompanyForm(false); setShowContactForm(false)
    setShowOpportunityForm(false); setShowTaskForm(false); setShowCallForm(false)
    setEditingCompanyId(null); setEditingContactId(null); setEditingOpportunityId(null)
    setEditingTaskId(null); setEditingCallId(null)
  }
  async function refreshPermissions(userId) {
    const [permissionsResult, orgResult] = await Promise.all([
      supabase.from('crm_module_permissions').select('*').eq('user_id', userId),
      supabase.from('organizations').select('id,name,logo_url,settings').eq('active', true).order('name')
    ])
    if (accessRef.current.user !== userId) return
    if (permissionsResult.error || orgResult.error) {
      setModulePermissions([]); setOrganizations([]); setActiveOrg('')
      setError('No se han podido cargar los permisos. Cierra sesión y vuelve a entrar.')
      return
    }
    const orgs = orgResult.data || []
    setModulePermissions(permissionsResult.data || []); setOrganizations(orgs)
    setActiveOrg(previous => orgs.some(o => o.id === previous) ? previous : (orgs[0]?.id || ''))
  }
  useEffect(() => {
    accessRef.current = { ...accessRef.current, org: activeOrg, permissions: modulePermissions }
    clearCRMData()
    if (!activeOrg || !profile?.active) return
    const pages = ['dashboard','clients','contacts','opportunities','calls','agenda','tasks','reports']
    if (!(currentPage === 'permissions' && profile.role === 'admin') && currentPage !== 'branding' && !canViewModule(currentPage)) {
      setCurrentPage(pages.find(canViewModule) || 'no-access')
    }
    loadCompanies(); loadContacts(); loadOpportunities(); loadTasks(); loadCalls()
    if (canViewModule('opportunities')) loadOpportunityOptions()
  }, [activeOrg, modulePermissions, profile])
const [currentPage, setCurrentPage] = useState('dashboard')
  const canWrite = canEditModule(currentPage === 'dashboard' ? 'clients' : currentPage)
const [companies, setCompanies] = useState([])
const [companiesLoading, setCompaniesLoading] = useState(false)
const [clientSearch, setClientSearch] = useState('')
const [clientStatusFilter, setClientStatusFilter] = useState('all')
const normalizeClientSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const clientSearchWords = normalizeClientSearch(clientSearch).trim().split(/\s+/).filter(Boolean)
const filteredCompanies = companies.filter(company => {
  const statusMatches = clientStatusFilter === 'all' || (company.status || 'activo').toLowerCase() === clientStatusFilter
  const text = normalizeClientSearch([company.name, company.legal_name, company.tax_id, company.sector, company.phone, company.email].join(' '))
  return statusMatches && clientSearchWords.every(word => text.includes(word))
})
const [showCompanyForm, setShowCompanyForm] = useState(false)
const [companySaving, setCompanySaving] = useState(false)
const [editingCompanyId, setEditingCompanyId] = useState(null)
const [selectedCompany, setSelectedCompany] = useState(null)
const [contacts, setContacts] = useState([])
const [contactsLoading, setContactsLoading] = useState(false)
const [contactSearch, setContactSearch] = useState('')
const contactSearchWords = normalizeClientSearch(contactSearch).trim().split(/\s+/).filter(Boolean)
const filteredContacts = contacts.filter(contact => {
  const companyName = contact.companies?.name || companies.find(company => company.id === contact.company_id)?.name || ''
  const text = normalizeClientSearch([contact.first_name, contact.last_name, companyName, contact.phone, contact.mobile, contact.email, contact.job_title].join(' '))
  return contactSearchWords.every(word => text.includes(word))
})
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
const [opportunitySearch, setOpportunitySearch] = useState('')
const [opportunityStageFilter, setOpportunityStageFilter] = useState('all')
const opportunityStageOptions = Array.from(new Map([
  ...pipelineStages.map(stage => [stage.id, stage.name]),
  ...opportunities.filter(opportunity => opportunity.stage_id).map(opportunity => [opportunity.stage_id, opportunity.pipeline_stages?.name || pipelineStages.find(stage => stage.id === opportunity.stage_id)?.name || 'Etapa sin nombre'])
]).entries()).map(([id, name]) => ({ id, name }))
const opportunitySearchWords = normalizeClientSearch(opportunitySearch).trim().split(/\s+/).filter(Boolean)
const filteredOpportunities = opportunities.filter(opportunity => {
  const stageMatches = opportunityStageFilter === 'all' || (opportunityStageFilter === 'none' ? !opportunity.stage_id : opportunity.stage_id === opportunityStageFilter)
  const text = normalizeClientSearch([opportunity.title, opportunity.companies?.name, opportunity.contacts?.first_name, opportunity.contacts?.last_name].join(' '))
  return stageMatches && opportunitySearchWords.every(word => text.includes(word))
})
function opportunityStageColors(name) {
  const text = normalizeClientSearch(name)
  if (/ganad|cerrad.*gan|won/.test(text)) return { background: '#dcfce7', color: '#166534' }
  if (/perdid|lost/.test(text)) return { background: '#fee2e2', color: '#991b1b' }
  if (/seguimiento|negoci/.test(text)) return { background: '#fef3c7', color: '#92400e' }
  if (/nuevo|new/.test(text)) return { background: '#dbeafe', color: '#1e40af' }
  if (!name) return { background: '#f1f5f9', color: '#475569' }
  const palette = [{ background: '#ede9fe', color: '#5b21b6' }, { background: '#cffafe', color: '#155e75' }, { background: '#fce7f3', color: '#9d174d' }]
  const hash = Array.from(text).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
  return palette[hash % palette.length]
}

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
const [taskSearch, setTaskSearch] = useState('')
const [taskStatusFilter, setTaskStatusFilter] = useState('all')
const [taskPriorityFilter, setTaskPriorityFilter] = useState('all')
const taskStatusLabels = { pending: 'Pendiente', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' }
const taskPriorityLabels = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }
const taskStatusColors = { pending: { background: '#fef3c7', color: '#92400e' }, in_progress: { background: '#dbeafe', color: '#1e40af' }, completed: { background: '#dcfce7', color: '#166534' }, cancelled: { background: '#f1f5f9', color: '#475569' } }
const taskPriorityColors = { low: { background: '#f1f5f9', color: '#475569' }, normal: { background: '#dbeafe', color: '#1e40af' }, high: { background: '#ffedd5', color: '#9a3412' }, urgent: { background: '#fee2e2', color: '#991b1b' } }
const taskSearchWords = normalizeClientSearch(taskSearch).trim().split(/\s+/).filter(Boolean)
const filteredTasks = tasks.filter(task => {
  const text = normalizeClientSearch([task.title, task.companies?.name].join(' '))
  return (taskStatusFilter === 'all' || (task.status || 'pending') === taskStatusFilter) && (taskPriorityFilter === 'all' || (task.priority || 'normal') === taskPriorityFilter) && taskSearchWords.every(word => text.includes(word))
})
const [showTaskForm, setShowTaskForm] = useState(false)
const [taskSaving, setTaskSaving] = useState(false)
const [editingTaskId, setEditingTaskId] = useState(null)
const [calls, setCalls] = useState([])
const [callsLoading, setCallsLoading] = useState(false)
const [callSearch, setCallSearch] = useState('')
const [callTypeFilter, setCallTypeFilter] = useState('all')
const [callStatusFilter, setCallStatusFilter] = useState('all')
const callSearchWords = normalizeClientSearch(callSearch).trim().split(/\s+/).filter(Boolean)
const filteredCalls = calls.filter(call => {
  const text = normalizeClientSearch([call.companies?.name, call.contacts?.first_name, call.contacts?.last_name, call.companies?.phone, call.contacts?.phone, call.contacts?.mobile].join(' '))
  const compactPhones = [call.companies?.phone, call.contacts?.phone, call.contacts?.mobile].map(phone => String(phone || '').replace(/\D/g, ''))
  const phoneQuery = callSearch.replace(/\D/g, '')
  const searchMatches = callSearchWords.every(word => text.includes(word)) || (/^[+\d\s().-]+$/.test(callSearch.trim()) && phoneQuery && compactPhones.some(phone => phone.includes(phoneQuery)))
  return (callTypeFilter === 'all' || call.direction === callTypeFilter) && (callStatusFilter === 'all' || call.status === callStatusFilter) && searchMatches
})
const callStatusLabels = { completed: 'Completada', missed: 'Perdida', cancelled: 'Cancelada', scheduled: 'Programada' }
const callStatusColors = { completed: { background: '#dcfce7', color: '#166534' }, missed: { background: '#fee2e2', color: '#991b1b' }, cancelled: { background: '#f1f5f9', color: '#475569' }, scheduled: { background: '#fef3c7', color: '#92400e' } }

const [showCallForm, setShowCallForm] = useState(false)
const [callSaving, setCallSaving] = useState(false)
const [editingCallId, setEditingCallId] = useState(null)
const [reportPeriod, setReportPeriod] = useState('all')
const [reportExportType, setReportExportType] = useState('clients')
const [reportFrom, setReportFrom] = useState('')
const [reportTo, setReportTo] = useState('')
const reportRangeError = reportPeriod === 'custom'
  ? (!reportFrom || !reportTo
      ? 'Selecciona las fechas Desde y Hasta.'
      : reportFrom > reportTo
        ? 'La fecha Desde debe ser anterior o igual a Hasta.'
        : '')
  : ''
const [callForm, setCallForm] = useState({
  company_id: '',
  contact_id: '',
  opportunity_id: '',
  assigned_to: '',
  direction: 'inbound',
  status: 'completed',
  started_at: '',
  duration_seconds: '',
  outcome: '',
  notes: ''
})
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
// Al salir de un módulo, descartar su formulario sin guardar registros.
useEffect(() => {
  if (currentPage !== 'clients') {
    setShowCompanyForm(false)
    setEditingCompanyId(null)
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
  }
  if (currentPage !== 'contacts') {
    setShowContactForm(false)
    setEditingContactId(null)
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
  }
  if (currentPage !== 'opportunities') {
    setShowOpportunityForm(false)
    setEditingOpportunityId(null)
    setOpportunityForm({
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
  }
  if (currentPage !== 'calls') {
    setShowCallForm(false)
    setEditingCallId(null)
    setCallForm({
  company_id: '',
  contact_id: '',
  opportunity_id: '',
  assigned_to: '',
  direction: 'inbound',
  status: 'completed',
  started_at: '',
  duration_seconds: '',
  outcome: '',
  notes: ''
})
  }
  if (currentPage !== 'tasks') {
    setShowTaskForm(false)
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
  }
}, [currentPage])

  const [recoveryMode, setRecoveryMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)

      if (session) {
        // Una renovación o el retorno del foco no cambia el usuario ni su empresa.
        if (accessRef.current.user === session.user.id) return
        accessRef.current = { org: '', permissions: [], user: session.user.id }
        setModulePermissions([]); setActiveOrg(''); clearCRMData()
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
        // Una renovación o el retorno del foco no cambia el usuario ni su empresa.
        if (accessRef.current.user === session.user.id) return
        accessRef.current = { org: '', permissions: [], user: session.user.id }
        setModulePermissions([]); setActiveOrg(''); clearCRMData()
        loadProfile(session.user.id)
      } else {
        accessRef.current = { org: '', permissions: [], user: null }
        setProfile(null); setModulePermissions([]); setActiveOrg(''); clearCRMData()
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

    if (accessRef.current.user !== userId) return
    if (error) {
      console.error(error)
      setError('No se ha podido cargar el perfil del usuario.')
    } else {
      setProfile(data)
      await refreshPermissions(userId)
    }

    setLoading(false)
  }
async function loadCompanies() {
  const access = accessRef.current
  if (!access.org || !access.permissions.some(p => p.organization_id === access.org && p.module === 'clients' && p.can_view)) { setCompanies([]); setCompaniesLoading(false); return }
  setCompaniesLoading(true)

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('organization_id', access.org)
    .order('created_at', { ascending: false })

  if (accessRef.current !== access) return
  if (error) {
    console.error('Error cargando clientes:', error)
    setCompanies([])
  } else {
    setCompanies(data || [])
  }

  setCompaniesLoading(false)
}
async function loadContacts() {
  const access = accessRef.current
  if (!access.org || !access.permissions.some(p => p.organization_id === access.org && p.module === 'contacts' && p.can_view)) { setContacts([]); setContactsLoading(false); return }
  setContactsLoading(true)

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      companies (
        name
      )
    `)
    .eq('organization_id', access.org)
    .order('created_at', { ascending: false })

  if (accessRef.current !== access) return
  if (error) {
    console.error('Error cargando contactos:', error)
    setContacts([])
  } else {
    setContacts(data || [])
  }

  setContactsLoading(false)
}
async function loadOpportunities() {
  const access = accessRef.current
  if (!access.org || !access.permissions.some(p => p.organization_id === access.org && p.module === 'opportunities' && p.can_view)) { setOpportunities([]); setOpportunitiesLoading(false); return }
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
    .eq('organization_id', access.org)
    .order('created_at', { ascending: false })

  if (accessRef.current !== access) return
  if (error) {
    console.error('Error cargando oportunidades:', error)
    setOpportunities([])
  } else {
    setOpportunities(data || [])
  }

  setOpportunitiesLoading(false)
}
async function loadTasks() {
  const access = accessRef.current
  if (!access.org || !access.permissions.some(p => p.organization_id === access.org && p.module === 'tasks' && p.can_view)) { setTasks([]); setTasksLoading(false); return }
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
    .eq('organization_id', access.org)
    .order('due_date', { ascending: true })

  if (accessRef.current !== access) return
  if (error) {
    console.error('Error cargando tareas:', error)
    setTasks([])
  } else {
    setTasks(data || [])
  }

  setTasksLoading(false)
}
async function loadCalls() {
  const access = accessRef.current
  if (!access.org || !access.permissions.some(p => p.organization_id === access.org && p.module === 'calls' && p.can_view)) { setCalls([]); setCallsLoading(false); return }
  setCallsLoading(true)

  const { data, error } = await supabase
    .from('calls')
    .select(`
      *,
      companies (
        name,
        phone
      ),
      contacts (
        first_name,
        last_name,
        phone,
        mobile
      ),
      opportunities (
        title
      )
    `)
    .eq('organization_id', access.org)
    .order('started_at', { ascending: false })

  if (accessRef.current !== access) return
  if (error) {
    console.error('Error cargando llamadas:', error)
    setCalls([])
  } else {
    setCalls(data || [])
  }

  setCallsLoading(false)
}
  function isInReportPeriod(date) {
  if (reportPeriod === 'all') return true
  if (!date) return false

  const itemDate = new Date(date)
  const now = new Date()

  if (reportPeriod === 'custom') {
    if (reportRangeError || Number.isNaN(itemDate.getTime())) return false
    const [fromYear, fromMonth, fromDay] = reportFrom.split('-').map(Number)
    const [toYear, toMonth, toDay] = reportTo.split('-').map(Number)
    const start = new Date(fromYear, fromMonth - 1, fromDay)
    const end = new Date(toYear, toMonth - 1, toDay + 1)
    return itemDate >= start && itemDate < end
  }

  if (reportPeriod === 'today') {
    return (
      itemDate.getFullYear() === now.getFullYear() &&
      itemDate.getMonth() === now.getMonth() &&
      itemDate.getDate() === now.getDate()
    )
  }
if (reportPeriod === 'yesterday') {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  return (
    itemDate.getFullYear() === yesterday.getFullYear() &&
    itemDate.getMonth() === yesterday.getMonth() &&
    itemDate.getDate() === yesterday.getDate()
  )
}
  if (reportPeriod === '7days') {
    const limit = new Date()
    limit.setDate(now.getDate() - 7)
    return itemDate >= limit
  }

  if (reportPeriod === '30days') {
    const limit = new Date()
    limit.setDate(now.getDate() - 30)
    return itemDate >= limit
  }

  if (reportPeriod === 'month') {
    return (
      itemDate.getFullYear() === now.getFullYear() &&
      itemDate.getMonth() === now.getMonth()
    )
  }

  return true
}

const reportData = {
  clients: canViewModule('clients') ? companies.filter(row => row.organization_id === activeOrg && isInReportPeriod(row.created_at)) : [],
  opportunities: canViewModule('opportunities') ? opportunities.filter(row => row.organization_id === activeOrg && isInReportPeriod(row.created_at)) : [],
  calls: canViewModule('calls') ? calls.filter(row => row.organization_id === activeOrg && isInReportPeriod(row.started_at)) : [],
  tasks: canViewModule('tasks') ? tasks.filter(row => row.organization_id === activeOrg && isInReportPeriod(row.created_at)) : []
}
const exportChoices = [['clients', 'Clientes'], ['opportunities', 'Oportunidades'], ['calls', 'Llamadas'], ['tasks', 'Tareas']].filter(([module]) => canViewModule(module))
const selectedExportType = exportChoices.some(([module]) => module === reportExportType) ? reportExportType : exportChoices[0]?.[0]
const reportLoading = companiesLoading || opportunitiesLoading || callsLoading || tasksLoading
const reportPeriodText = (() => {
  const now = new Date(), from = new Date(now)
  const format = date => date.toLocaleDateString('es-ES')
  if (reportPeriod === 'all') return 'Todo el historial'
  if (reportPeriod === 'custom') return reportRangeError || `Del ${format(new Date(reportFrom + 'T00:00:00'))} al ${format(new Date(reportTo + 'T00:00:00'))}`
  if (reportPeriod === 'today') return `Hoy · ${format(now)}`
  if (reportPeriod === 'yesterday') { from.setDate(from.getDate() - 1); return `Ayer · ${format(from)}` }
  if (reportPeriod === 'month') return now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  from.setDate(from.getDate() - (reportPeriod === '7days' ? 7 : 30))
  return `Desde ${format(from)} · últimos ${reportPeriod === '7days' ? 7 : 30} días`
})()
const reportDate = value => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('es-ES') : ''
}
function downloadReport(format = 'csv') {
  if (!canViewModule('reports') || !selectedExportType || !canViewModule(selectedExportType) || reportRangeError || reportLoading) return
  const definitions = {
    clients: { headers: ['Cliente', 'Razón social', 'CIF/NIF', 'Sector', 'Teléfono', 'Email', 'Estado', 'Localidad', 'Provincia', 'Fecha de alta'], values: row => [row.name, row.legal_name, row.tax_id, row.sector, row.phone, row.email, row.status, row.city, row.province, reportDate(row.created_at)] },
    opportunities: { headers: ['Oportunidad', 'Cliente', 'Contacto', 'Etapa', 'Valor estimado EUR', 'Cuota mensual EUR', 'Fecha de alta'], values: row => [row.title, row.companies?.name, [row.contacts?.first_name, row.contacts?.last_name].filter(Boolean).join(' '), row.pipeline_stages?.name, Number(row.estimated_value || 0).toLocaleString('es-ES'), Number(row.monthly_value || 0).toLocaleString('es-ES'), reportDate(row.created_at)] },
    calls: { headers: ['Fecha', 'Cliente', 'Contacto', 'Tipo', 'Estado', 'Duración segundos', 'Resultado', 'Notas'], values: row => [reportDate(row.started_at), row.companies?.name, [row.contacts?.first_name, row.contacts?.last_name].filter(Boolean).join(' '), row.direction === 'inbound' ? 'Entrante' : row.direction === 'outbound' ? 'Saliente' : row.direction, callStatusLabels[row.status] || row.status, row.duration_seconds, row.outcome, row.notes] },
    tasks: { headers: ['Tarea', 'Cliente', 'Estado', 'Prioridad', 'Vencimiento', 'Fecha de alta'], values: row => [row.title, row.companies?.name, taskStatusLabels[row.status] || row.status, taskPriorityLabels[row.priority] || row.priority, reportDate(row.due_date), reportDate(row.created_at)] }
  }
  const definition = definitions[selectedExportType]
  if (format === 'pdf') {
    saveReportPDF({ title: exportChoices.find(([key]) => key === selectedExportType)?.[1] || 'Informe', company: organization?.name || 'Empresa', period: reportPeriodText, headers: definition.headers, rows: reportData[selectedExportType].map(definition.values) })
    return
  }
  const cell = value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text
    return '"' + text.replace(/"/g, '""') + '"'
  }
  const rows = [['Empresa', 'Periodo', ...definition.headers], ...reportData[selectedExportType].map(row => [organization?.name || '', reportPeriodText, ...definition.values(row)])]
  const csv = '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  const companyName = (organization?.name || 'empresa').replace(/[^a-z0-9áéíóúñ_-]+/gi, '-')
  link.download = `${companyName}-${selectedExportType}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function loadOpportunityOptions() {
  const access = accessRef.current
  if (!access.org || !canViewModule('opportunities')) return
  const [
    stagesResult,
    sourcesResult,
    servicesResult
  ] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('*').eq('organization_id', access.org)
      .order('position', { ascending: true }),

    supabase
      .from('lead_sources')
      .select('*').eq('organization_id', access.org)
      .order('name', { ascending: true }),

    supabase
      .from('services')
      .select('*').eq('organization_id', access.org)
      .order('name', { ascending: true })
  ])

  if (accessRef.current !== access) return
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
  if (!canEditModule('contacts')) return
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
  if (!canEditModule('contacts')) { setError('Esta cuenta solo permite consultar datos.'); return }
  setContactSaving(true)
  setError('')

let result

if (editingContactId) {
  result = await supabase
    .from('contacts')
    .update(contactForm)
    .eq('id', editingContactId).eq('organization_id', activeOrg).select('id')
} else {
  result = await supabase
    .from('contacts')
    .insert([
      {
        ...contactForm,
        organization_id: activeOrg,
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
  if (!canEditModule('opportunities')) { setError('Esta cuenta solo permite consultar datos.'); return }
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
      .eq('id', editingOpportunityId).eq('organization_id', activeOrg).select('id')
  } else {
    result = await supabase
      .from('opportunities')
      .insert([
        {
          ...opportunityData,
        organization_id: activeOrg,
          owner_id: session.user.id
        }
      ])
.select('id')
  }

  const error = result.error || (editingOpportunityId && !result.data?.length ? new Error('No tienes permiso para guardar este registro.') : null)

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
        organization_id: activeOrg,
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
  if (!canEditModule('opportunities')) return
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
  if (!canEditModule('tasks')) { setError('Esta cuenta solo permite consultar datos.'); return }
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
      .eq('id', editingTaskId).eq('organization_id', activeOrg).select('id')
  } else {
    result = await supabase
      .from('tasks')
      .insert([
        {
          ...taskData,
        organization_id: activeOrg,
          created_by: session.user.id
        }
      ])
  }

  const error = result.error || (editingTaskId && !result.data?.length ? new Error('No tienes permiso para guardar este registro.') : null)

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
async function saveCall(e) {
  e.preventDefault()
  if (!canEditModule('calls')) { setError('Esta cuenta solo permite consultar datos.'); return }
  setCallSaving(true)
  setError('')

  const callData = {
    company_id: callForm.company_id || null,
    contact_id: callForm.contact_id || null,
    opportunity_id: callForm.opportunity_id || null,
    assigned_to: callForm.assigned_to || session.user.id,
    direction: callForm.direction,
    status: callForm.status,
    started_at: callForm.started_at
      ? new Date(callForm.started_at).toISOString()
      : new Date().toISOString(),
    duration_seconds: callForm.duration_seconds
      ? Number(callForm.duration_seconds)
      : 0,
    outcome: callForm.outcome || null,
    notes: callForm.notes || null
  }

  let result

  if (editingCallId) {
    result = await supabase
      .from('calls')
      .update(callData)
      .eq('id', editingCallId).eq('organization_id', activeOrg).select('id')
  } else {
    result = await supabase
      .from('calls')
      .insert([
        {
          ...callData,
        organization_id: activeOrg,
          created_by: session.user.id
        }
      ])
  }

  const error = result.error || (editingCallId && !result.data?.length ? new Error('No tienes permiso para guardar este registro.') : null)

  if (error) {
    console.error('Error guardando llamada:', error)
    setError('No se ha podido guardar la llamada.')
    setCallSaving(false)
    return
  }

  setShowCallForm(false)
  setEditingCallId(null)
  await loadCalls()
  setCallSaving(false)
}
function editCall(call) {
  if (!canEditModule('calls')) return
  setEditingCallId(call.id)

  setCallForm({
    company_id: call.company_id || '',
    contact_id: call.contact_id || '',
    opportunity_id: call.opportunity_id || '',
    assigned_to: call.assigned_to || '',
    direction: call.direction || 'inbound',
    status: call.status || 'completed',
    started_at: call.started_at
      ? new Date(
          new Date(call.started_at).getTime() -
          new Date(call.started_at).getTimezoneOffset() * 60000
        ).toISOString().slice(0, 16)
      : '',
    duration_seconds: call.duration_seconds || '',
    outcome: call.outcome || '',
    notes: call.notes || ''
  })

  setShowCallForm(true)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
  function editTask(task) {
  if (!canEditModule('tasks')) return
  setEditingTaskId(task.id)

  setTaskForm({
    title: task.title || '',
    description: task.description || '',
    task_type: task.task_type || 'follow_up',
    status: task.status || 'pending',
    priority: task.priority || 'normal',
    due_date: task.due_date
      ? new Date(
          new Date(task.due_date).getTime() -
          new Date(task.due_date).getTimezoneOffset() * 60000
        ).toISOString().slice(0, 16)
      : '',
    company_id: task.company_id || '',
    contact_id: task.contact_id || '',
    opportunity_id: task.opportunity_id || '',
    assigned_to: task.assigned_to || ''
  })

  setShowTaskForm(true)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function editCompany(company) {
  if (!canEditModule('clients')) return
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
  if (!canEditModule('clients')) { setError('Esta cuenta solo permite consultar datos.'); return }
  setCompanySaving(true)
  setError('')

let result

if (editingCompanyId) {
  result = await supabase
    .from('companies')
    .update(companyForm)
    .eq('id', editingCompanyId).eq('organization_id', activeOrg).select('id')
} else {
  result = await supabase
    .from('companies')
    .insert([
      {
        ...companyForm,
        organization_id: activeOrg,
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
    <div className="app" style={{ '--crm-teal': primaryColor, '--crm-sidebar': sidebarColor, '--crm-primary-ink': brandingInk(primaryColor), '--crm-sidebar-ink': brandingInk(sidebarColor) }}>

      <header className="header">

        <div>
          <BrandLogo key={`${activeOrg}:${organization?.logo_url || ''}`} url={organization?.logo_url} name={organization?.name || 'Empresa'} /><span className="brand">{organization?.name || 'GLOBALTEC'}</span>
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
{(organizations.length > 1 || canCreateOrganization) && <div className="organization-toolbar">
  <div className="organization-toolbar-row">
    <label className="organization-selector" htmlFor="active-organization">
      <span>Empresa</span>
      <select id="active-organization" value={activeOrg} onChange={e => {
        accessRef.current = { ...accessRef.current, org: e.target.value }
        clearCRMData()
        setActiveOrg(e.target.value)
      }}>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
    </label>
    {canCreateOrganization && <button type="button" className="primary-action" aria-expanded={showNewOrganization} onClick={() => setShowNewOrganization(value => !value)}>{showNewOrganization ? 'Cerrar alta de empresa' : '+ Nueva empresa'}</button>}
  </div>
  {canCreateOrganization && showNewOrganization && <NewOrganization key={session.user.id} onCreated={async id => {
    const userId = session.user.id
    await refreshPermissions(userId)
    if (accessRef.current.user !== userId) return
    accessRef.current = { ...accessRef.current, org: id }
    clearCRMData()
    setActiveOrg(id)
    setCurrentPage('dashboard')
    setShowNewOrganization(false)
  }} />}
</div>}
<style>{`
  .lead-source-settings .source-button, .lead-source-settings .primary-action { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; box-sizing: border-box; padding: 10px 16px; border: 1px solid #cbd5e1; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 600; line-height: 1.3; cursor: pointer; margin: 0; }
  .lead-source-settings .source-button { background: #f3f7fa; color: #123047; box-shadow: 0 2px 5px #12304708; }
  .lead-source-settings .primary-action { border-color: transparent; background: var(--crm-teal, #087f74); color: var(--crm-primary-ink, white); }
  .lead-source-settings .source-button:hover:not(:disabled) { background: #e6eef4; border-color: #94a3b8; }
  .lead-source-settings button:focus-visible { outline: 3px solid var(--crm-teal, #087f74); outline-offset: 3px; }
  .lead-source-settings button:disabled { opacity: .55; cursor: default; }
  .form-field .agenda-datetime-field > span { display: block; margin-bottom: 8px; font-weight: 600; }
  .form-field .agenda-datetime-controls { display: grid; grid-template-columns: minmax(140px, 1fr) 76px 10px 76px; align-items: center; gap: 8px; }
  .form-field .agenda-datetime-controls input, .form-field .agenda-datetime-controls select { width: 100%; min-width: 0; box-sizing: border-box; }
  @media (max-width: 480px) { .form-field .agenda-datetime-controls { grid-template-columns: minmax(0, 1fr) 65px 6px 65px; gap: 5px; } }
  .report-export-panel { display: flex; align-items: flex-end; gap: 18px; flex-wrap: wrap; padding: 18px; margin: 18px 0; border: 1px solid #dbe5ef; border-radius: 14px; background: white; }
  .report-export-panel > div { flex: 1; min-width: 200px; }
  .report-unified-panel { display: block; }
  .report-unified-panel .report-summary { margin-bottom: 18px; }
  .report-unified-panel .report-unified-controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; min-width: 0; }
  .report-unified-controls input[type="date"] { height: 44px; box-sizing: border-box; font: inherit; }
  .report-unified-controls > p { flex-basis: 100%; }
  @media (max-width: 600px) { .report-unified-controls label { flex: 1 1 100%; min-width: 0; } .report-unified-controls .primary-action { flex: 1 1 150px; } }

  .report-export-panel p { margin: 7px 0; font-size: 13px; line-height: 1.6; }
  .report-export-panel small { color: #64748b; }
  .report-export-panel label { display: flex; flex-direction: column; gap: 9px; font-size: 16px; font-weight: 700; min-width: 200px; margin: 0; }
  .report-export-panel .primary-action, .report-export-panel select { height: 44px; box-sizing: border-box; margin: 0; }
  .report-export-panel select { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 9px; background: white; font: inherit; }
  .report-bars-row { margin: 18px 0; }
  .report-bars-caption { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-bottom: 8px; }
  .report-bars-track { height: 10px; border-radius: 999px; background: #edf2f7; overflow: hidden; }
  .report-bars-fill { height: 100%; border-radius: inherit; }
  .clear-filter-button { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 10px 18px; margin-top: 14px; border: 0; border-radius: 10px; background: var(--crm-teal, #087f8c); color: var(--crm-primary-ink, white); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .clear-filter-button:hover { filter: brightness(.95); }
  .clear-filter-button:focus-visible { outline: 3px solid #168bba; outline-offset: 3px; }
  .opportunity-stage-badge { display: inline-block; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .client-filter-toolbar { display: flex; align-items: end; gap: 14px; flex-wrap: wrap; margin: 20px 0; padding: 16px; background: white; border: 1px solid #dbe5ef; border-radius: 14px; }
  .client-filter-toolbar label { display: flex; flex-direction: column; gap: 7px; font-size: 13px; font-weight: 600; }
  .client-filter-toolbar .client-search-field { flex: 1; min-width: 180px; }
  .client-filter-toolbar input, .client-filter-toolbar select { box-sizing: border-box; width: 100%; min-height: 42px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 9px; background: white; color: #123047; font: inherit; }
  .client-results-count { font-size: 12px; color: #64748b; padding-bottom: 12px; }
  .clients-list .client-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .organization-toolbar { padding: 14px 24px; background: #f1f5f9; border-bottom: 1px solid #dbe5ef; }
  .organization-toolbar-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .organization-selector { display: flex; align-items: center; gap: 12px; font-weight: 600; min-width: 0; }
  .permission-select-field { display: flex; flex-direction: row; align-items: center; gap: 16px; width: 290px; min-width: 0; max-width: 100%; font-size: 13px; font-weight: 600; color: #123047; }
  .permission-user-field { margin-bottom: 20px; width: 480px; }
  .permission-select-field select { flex: 1; width: 0; min-width: 0; min-height: 42px; box-sizing: border-box; padding: 10px 36px 10px 14px; border: 1px solid #cbd5e1; border-radius: 10px; background: white; color: #123047; font: inherit; font-weight: 400; cursor: pointer; }
  .permission-select-field select:focus-visible { outline: 3px solid var(--crm-teal, #087f74); outline-offset: 2px; }
  .permission-select-field select:disabled { opacity: .6; cursor: default; }
  .organization-selector select { box-sizing: border-box; min-height: 42px; max-width: 100%; width: 260px; padding: 10px 36px 10px 14px; border: 1px solid #cbd5e1; border-radius: 10px; background: white; color: #102b46; font: inherit; }
  button.stat-card.dashboard-shortcut { display: block; width: 100%; text-align: left; font-family: inherit; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease; }
  button.stat-card.dashboard-shortcut:not(:disabled):hover { transform: translateY(-3px); box-shadow: 0 8px 22px #082b7d18; }
  button.stat-card.dashboard-shortcut:focus-visible, .organization-selector select:focus-visible { outline: 3px solid #168bba; outline-offset: 3px; }
  button.stat-card.dashboard-shortcut:disabled { cursor: default; }
  @media (max-width: 540px) {
    .organization-toolbar { padding: 12px 16px; }
    .organization-selector { width: 100%; }
    .organization-selector select { flex: 1; width: 0; }
  }
  @media (prefers-reduced-motion: reduce) { button.stat-card.dashboard-shortcut { transition: none; } }
`}</style>
<main className="crm-main">
  <aside className="sidebar">
    <p className="sidebar-label">ESPACIO DE TRABAJO</p>
    <nav className="sidebar-nav">
{canViewModule('dashboard') && (<button
  className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
onClick={() => {
  setCurrentPage('dashboard')
  loadCompanies()
  loadOpportunities()
  loadTasks()
  loadCalls()
}}
>
        <CRMIcon name="dashboard" />
        Inicio
      </button>)}
{canViewModule('clients') && (<button
  className={`nav-item ${currentPage === 'clients' ? 'active' : ''}`}
  onClick={() => {
    setCurrentPage('clients')
    loadCompanies()
    loadContacts()
  }}
>
  <CRMIcon name="clients" />
  Clientes
</button>)}


{canViewModule('contacts') && (<button
  className={`nav-item ${currentPage === 'contacts' ? 'active' : ''}`}
onClick={() => {
  setCurrentPage('contacts')
  loadCompanies()
  loadContacts()
}}
>
  <CRMIcon name="contacts" />
  Contactos
</button>)}

{canViewModule('opportunities') && (<button
  className={`nav-item ${currentPage === 'opportunities' ? 'active' : ''}`}
onClick={() => {
  setCurrentPage('opportunities')
  loadCompanies()
  loadContacts()
  loadOpportunities()
  loadOpportunityOptions()
}}
>
  <CRMIcon name="opportunities" />
  Oportunidades
</button>)}

{canViewModule('calls') && (<button
  className={`nav-item ${currentPage === 'calls' ? 'active' : ''}`}
  onClick={() => {
    setCurrentPage('calls')
    loadCalls()
    loadCompanies()
    loadContacts()
    loadOpportunities()
  }}
>
  <CRMIcon name="calls" />
  Llamadas
</button>)}

{canViewModule('agenda') && (<button className={`nav-item ${currentPage === 'agenda' ? 'active' : ''}`} onClick={() => {
  setCurrentPage('agenda')
  loadTasks()
  loadCompanies()
  loadContacts()
}}><CRMIcon name="agenda" /> Agenda</button>)}

{canViewModule('tasks') && (<button
  className={`nav-item ${currentPage === 'tasks' ? 'active' : ''}`}
  onClick={() => {
    setCurrentPage('tasks')
    loadTasks()
    loadCompanies()
    loadContacts()
    loadOpportunities()
  }}
>
  <CRMIcon name="tasks" />
  Tareas
</button>)}

{canViewModule('reports') && (<button
  className={`nav-item ${currentPage === 'reports' ? 'active' : ''}`}
  onClick={() => {
    setCurrentPage('reports')
    loadCompanies()
    loadOpportunities()
    loadTasks()
    loadCalls()
  }}
>
  <CRMIcon name="reports" />
  Informes
</button>)}
    {profile?.role === 'admin' && activeOrg && <button className={`nav-item ${currentPage === 'permissions' ? 'active' : ''}`} onClick={() => setCurrentPage('permissions')}><CRMIcon name="permissions" /> Permisos de usuarios</button>}
{canBrand && <button className={`nav-item ${currentPage === 'branding' ? 'active' : ''}`} onClick={() => setCurrentPage('branding')}><CRMIcon name="permissions" /> Personalización</button>}
</nav>
  </aside>

  <section className="dashboard">
  {currentPage === 'branding' ? (
    canBrand && organization ? <BrandingSettings key={`${activeOrg}:${session.user.id}`} organization={organization} onSourcesChanged={() => loadOpportunityOptions()} onSaved={updated => {
      if (accessRef.current.org === updated.id) setOrganizations(items => items.map(item => item.id === updated.id ? updated : item))
    }} /> : <p>No tienes permiso para personalizar esta empresa.</p>
  ) : currentPage === 'permissions' && profile?.role === 'admin' ? (
    <ModulePermissions key={`${activeOrg}:${session.user.id}`} actorId={session.user.id} brandName={organization?.name} organizationId={activeOrg} onSaved={() => refreshPermissions(session.user.id)} />
  ) : !canViewModule(currentPage) ? (
    <div className="dashboard-heading"><div><h1>Sin acceso</h1><p>No tienes secciones habilitadas en esta empresa. Consulta con el administrador.</p></div></div>
  ) : currentPage === 'clients' ? (
 <>
  <div className="clients-page">
    <div className="dashboard-heading">
      <div>
        <p className="dashboard-kicker">{organization?.name || 'GLOBALTEC'} CRM</p>
        <h1>Clientes</h1>
        <p>Gestión de empresas y clientes.</p>
      </div>

{canWrite && (<button
  className="primary-action"
  onClick={() => setShowCompanyForm(true)}
>
  + Nuevo cliente
</button>)} 
    </div>
</div>
  <div className="client-filter-toolbar">
    <label className="client-search-field" htmlFor="client-search"><span>Buscar clientes</span><input id="client-search" type="search" placeholder="Nombre, sector, teléfono, email o CIF…" value={clientSearch} onChange={e => setClientSearch(e.target.value)} /></label>
    <label htmlFor="client-status-filter"><span>Estado</span><select id="client-status-filter" value={clientStatusFilter} onChange={e => setClientStatusFilter(e.target.value)}><option value="all">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></label>
    <span className="client-results-count" role="status">{companiesLoading ? 'Cargando…' : `${filteredCompanies.length} de ${companies.length} clientes`}</span>
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

<div className="detail-wide" style={{ marginTop: '24px' }}>
  <h3>Contactos del cliente</h3>
  {canEditModule('contacts') && (<button
    type="button"
    className="secondary-action"
    onClick={() => {
      setEditingContactId(null)
      setContactForm({
        company_id: selectedCompany.id,
        first_name: '', last_name: '', job_title: '',
        phone: '', mobile: '', email: '',
        preferred_contact_method: 'telefono', notes: ''
      })
      setCurrentPage('contacts')
      setShowContactForm(true)
    }}
  >
    + Nuevo contacto
  </button>)} 
  {contacts.filter(
    (contact) => contact.company_id === selectedCompany.id
  ).length === 0 ? (
    <p style={{ marginTop: '20px' }}>No hay contactos registrados para este cliente.</p>
  ) : (
    <div style={{ marginTop: '20px', display: 'grid', gap: '14px' }}>
      {contacts
        .filter((contact) => contact.company_id === selectedCompany.id)
        .map((contact) => (
          <div key={contact.id} style={{
            padding: '18px', border: '1px solid #e2e8f0',
            borderRadius: '12px', background: '#f8fafc', minWidth: 0
          }}>
            <strong style={{ display: 'block', fontSize: '16px' }}>
              {`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Sin nombre'}
            </strong>
            <div style={{
              display: 'grid', gap: '10px', marginTop: '14px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))'
            }}>
              <div><span>Cargo: </span><strong>{contact.job_title || 'Sin cargo'}</strong></div>
              <div><span>Teléfono: </span>{contact.phone ? <a href={`tel:${contact.phone}`}>{contact.phone}</a> : 'Sin teléfono'}</div>
              <div><span>Móvil: </span>{contact.mobile ? <a href={`tel:${contact.mobile}`}>{contact.mobile}</a> : 'Sin móvil'}</div>
              <div style={{ overflowWrap: 'anywhere' }}><span>Correo: </span>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : 'Sin correo'}</div>
            </div>
            {canEditModule('contacts') && (<button
              type="button"
              className="secondary-action"
              style={{ marginTop: '16px' }}
              onClick={() => {
                setCurrentPage('contacts')
                editContact(contact)
              }}
            >
              Ver / editar
            </button>)} 
          </div>
        ))}
    </div>
  )}
</div>
<ClientAttachments key={selectedCompany.id} company={selectedCompany} session={session} profile={profile} allowEdit={canEditModule('clients')} />
  </div>
)}
{canWrite && showCompanyForm && (
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

  {filteredCompanies.length === 0 && <div className="empty-state" style={{ padding: 24 }}><strong>No hay clientes que coincidan</strong><span>Prueba otra búsqueda o cambia el filtro de estado.</span><button type="button" className="clear-filter-button" onClick={() => { setClientSearch(''); setClientStatusFilter('all') }}>Limpiar filtros</button></div>}
  {filteredCompanies.map((company) => (
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

<button type="button" aria-label={`Ver ficha de ${company.name}`} onClick={() => setSelectedCompany(company)}>Ver ficha</button>
{canWrite && (<button
  type="button"
  onClick={() => editCompany(company)}
>
  Editar
</button>)} 
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
        <p className="dashboard-kicker">{organization?.name || 'GLOBALTEC'} CRM</p>
        <h1>Contactos</h1>
        <p>Gestión de personas de contacto de tus clientes.</p>
      </div>

{canWrite && (<button
  className="primary-action"
  onClick={() => setShowContactForm(true)}
>
  + Nuevo contacto
</button>)} 
    </div>
<div className="client-filter-toolbar">
  <label className="client-search-field" htmlFor="contact-search"><span>Buscar contactos</span><input id="contact-search" type="search" placeholder="Nombre, empresa, teléfono o email…" value={contactSearch} onChange={e => setContactSearch(e.target.value)} /></label>
  <span className="client-results-count" role="status">{contactsLoading ? 'Cargando…' : `${filteredContacts.length} de ${contacts.length} contactos`}</span>
</div>
{canWrite && showContactForm && (
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

    {filteredContacts.length === 0 && <div className="empty-state" style={{ padding: 24 }}><strong>No hay contactos que coincidan</strong><span>Prueba otra búsqueda.</span><button type="button" className="clear-filter-button" onClick={() => setContactSearch('')}>Limpiar búsqueda</button></div>}
    {filteredContacts.map((contact) => (
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
  {canWrite && (<button
    type="button"
    onClick={() => editContact(contact)}
  >
    Editar
  </button>)} 
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
        <p className="dashboard-kicker">{organization?.name || 'GLOBALTEC'} CRM</p>
        <h1>Oportunidades</h1>
        <p>Gestión y seguimiento de oportunidades comerciales.</p>
      </div>

{canWrite && (<button
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
</button>)} 
    </div>
<div className="client-filter-toolbar">
  <label className="client-search-field" htmlFor="opportunity-search"><span>Buscar oportunidades</span><input id="opportunity-search" type="search" placeholder="Oportunidad, cliente o contacto…" value={opportunitySearch} onChange={e => setOpportunitySearch(e.target.value)} /></label>
  <label htmlFor="opportunity-stage-filter"><span>Etapa</span><select id="opportunity-stage-filter" value={opportunityStageFilter} onChange={e => setOpportunityStageFilter(e.target.value)}><option value="all">Todas</option>{opportunityStageOptions.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}<option value="none">Sin etapa</option></select></label>
  <span className="client-results-count" role="status">{opportunitiesLoading ? 'Cargando…' : `${filteredOpportunities.length} de ${opportunities.length} oportunidades`}</span>
</div>
{canWrite && showOpportunityForm && (
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
            {leadSources.filter(source => source.active || source.id === opportunityForm.source_id).map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}{!source.active ? ' (inactivo)' : ''}
              </option>
            ))}
          </select>
        </div>

<div className="form-field form-field-full">
  <label>Servicios</label>

  <div className="services-selector">
    {services.filter(service => service.active || opportunityForm.service_ids.includes(service.id)).length === 0 ? (
      <span>No hay servicios disponibles</span>
    ) : (
      services.filter(service => service.active || opportunityForm.service_ids.includes(service.id)).map((service) => (
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

          <span>{service.name}{!service.active ? ' (inactivo)' : ''}</span>
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

    {filteredOpportunities.length === 0 && <div className="empty-state" style={{ padding: 24 }}><strong>No hay oportunidades que coincidan</strong><span>Prueba otra búsqueda o cambia la etapa.</span><button type="button" className="clear-filter-button" onClick={() => { setOpportunitySearch(''); setOpportunityStageFilter('all') }}>Limpiar filtros</button></div>}
    {filteredOpportunities.map((opportunity) => (
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
          <span className="opportunity-stage-badge" style={opportunityStageColors(opportunity.pipeline_stages?.name)}>{opportunity.pipeline_stages?.name || 'Sin etapa'}</span>
        </div>

        <div>
          {opportunity.estimated_value
            ? `${Number(opportunity.estimated_value).toLocaleString('es-ES')} €`
            : '—'}
        </div>

<div className="client-actions">
  {canWrite && (<button
    type="button"
    onClick={() => editOpportunity(opportunity)}
  >
    Editar
  </button>)} 
</div>
      </div>
    ))}
  </div>
)}
  </>
) : currentPage === 'reports' ? (
  <>
    <div className="dashboard-heading">
      <div>
        <p className="dashboard-kicker">{organization?.name || 'GLOBALTEC'} CRM</p>
        <h1>Informes</h1>
        <p>Resumen y análisis de la actividad comercial.</p>
      </div>
    </div>

    <div className="report-export-panel report-unified-panel">
      <div className="report-summary"><strong>Descargar informe</strong><p>Empresa: {organization?.name} · {reportPeriodText}</p><small>Clientes, oportunidades y tareas por fecha de alta; llamadas por fecha de llamada.</small></div>
      <div className="report-unified-controls">
        <label htmlFor="report-period"><span>Periodo</span>
      <select id="report-period"
        value={reportPeriod}
        onChange={(e) => setReportPeriod(e.target.value)}
      >
        <option value="all">Todo</option>
        <option value="today">Hoy</option>
        <option value="yesterday">Ayer</option>
        <option value="7days">Últimos 7 días</option>
        <option value="30days">Últimos 30 días</option>
        <option value="month">Este mes</option>
        <option value="custom">Personalizado</option>
      </select>
        </label>
      {reportPeriod === 'custom' && (
        <>
          <label >
            Desde
            <input type="date" value={reportFrom} max={reportTo || undefined}
              onChange={(e) => setReportFrom(e.target.value)}
              style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
          </label>
          <label >
            Hasta
            <input type="date" value={reportTo} min={reportFrom || undefined}
              onChange={(e) => setReportTo(e.target.value)}
              style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
          </label>
          {reportRangeError && (
            <p role="alert" style={{ width: '100%', margin: 0, color: '#b45309' }}>
              {reportRangeError}
            </p>
          )}
        </>
      )}
      <label htmlFor="report-export-type"><span>Tipo de informe</span><select id="report-export-type" value={selectedExportType || ''} onChange={e => setReportExportType(e.target.value)}>{exportChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="button" className="primary-action" disabled={!selectedExportType || !!reportRangeError || reportLoading} onClick={() => downloadReport('csv')}>{reportLoading ? 'Cargando datos…' : 'Descargar CSV'}</button>
      <button type="button" className="primary-action" disabled={!selectedExportType || !!reportRangeError || reportLoading} onClick={() => downloadReport('pdf')}>Descargar PDF</button>
      {!exportChoices.length && <p>No tienes acceso a secciones que se puedan descargar.</p>}
      </div>
    </div>
    {reportLoading && <p role="status">Cargando datos del informe…</p>}
    <div className="stats-grid">
      {[
        ['clients', 'Clientes', reportData.clients.length, 'Total registrados', 'clients'],
        ['opportunities', 'Oportunidades', reportData.opportunities.length, 'Total registradas', 'opportunities'],
        ['opportunities', 'Valor oportunidades', reportData.opportunities.reduce((sum, row) => sum + Number(row.estimated_value || 0), 0).toLocaleString('es-ES') + ' €', 'Valor estimado total', 'opportunities'],
        ['opportunities', 'Cuota mensual', reportData.opportunities.reduce((sum, row) => sum + Number(row.monthly_value || 0), 0).toLocaleString('es-ES') + ' €', 'Potencial mensual', 'opportunities'],
        ['tasks', 'Tareas pendientes', reportData.tasks.filter(row => ['pending', 'in_progress'].includes(row.status)).length, 'Por completar', 'tasks'],
        ['tasks', 'Tareas completadas', reportData.tasks.filter(row => row.status === 'completed').length, 'Finalizadas', 'tasks'],
        ['calls', 'Llamadas', reportData.calls.length, 'Total registradas', 'calls'],
        ['calls', 'Llamadas entrantes', reportData.calls.filter(row => row.direction === 'inbound').length, 'Recibidas', 'calls']
      ].filter(([module]) => canViewModule(module)).map(([module, label, value, detail, icon]) => <button type="button" key={label} className={`stat-card stat-${module} dashboard-shortcut`} aria-label={`Ir a ${module === 'clients' ? 'Clientes' : module === 'opportunities' ? 'Oportunidades' : module === 'tasks' ? 'Tareas' : 'Llamadas'}`} onClick={() => {
        if (!canViewModule(module)) return
        setCurrentPage(module)
        loadCompanies(); loadContacts()
        if (module === 'opportunities') { loadOpportunities(); loadOpportunityOptions() }
        if (module === 'tasks') { loadTasks(); loadOpportunities() }
        if (module === 'calls') { loadCalls(); loadOpportunities() }
      }}><CRMIcon name={icon} className="stat-icon" /><span>{label}</span><strong>{reportLoading ? '…' : value}</strong><small>{detail} · Ver sección →</small></button>)}
    </div>
    <div className="dashboard-grid">
      {canViewModule('calls') && <ReportBars title="Llamadas por tipo" description="Distribución en el periodo seleccionado" rows={[
        { label: 'Entrantes', value: reportData.calls.filter(row => row.direction === 'inbound').length, color: '#2563eb' },
        { label: 'Salientes', value: reportData.calls.filter(row => row.direction === 'outbound').length, color: '#7c3aed' }
      ]} />}
      {canViewModule('tasks') && <ReportBars title="Estado de tareas" description="Estado actual de las tareas dadas de alta en el periodo" rows={Object.entries(taskStatusLabels).map(([status, label]) => ({ label, value: reportData.tasks.filter(row => (row.status || 'pending') === status).length, color: { pending: '#d97706', in_progress: '#2563eb', completed: '#059669', cancelled: '#64748b' }[status] }))} />}
    </div>
  </>
) : currentPage === 'calls' ? (
  <>
    <div className="dashboard-heading">
      <div>
        <p className="dashboard-kicker">{organization?.name || 'GLOBALTEC'} CRM</p>
        <h1>Llamadas</h1>
        <p>Registro y seguimiento de llamadas.</p>
      </div>

      {canWrite && (<button
        className="primary-action"
        onClick={() => {
          setEditingCallId(null)
          setCallForm({
            company_id: '',
            contact_id: '',
            opportunity_id: '',
            assigned_to: '',
            direction: 'inbound',
            status: 'completed',
            started_at: '',
            duration_seconds: '',
            outcome: '',
            notes: ''
          })
          setShowCallForm(true)
        }}
      >
        + Nueva llamada
      </button>)} 
    </div>
<div className="client-filter-toolbar">
  <label className="client-search-field" htmlFor="call-search"><span>Buscar llamadas</span><input id="call-search" type="search" placeholder="Cliente, contacto o teléfono…" value={callSearch} onChange={e => setCallSearch(e.target.value)} /></label>
  <label htmlFor="call-type-filter"><span>Tipo</span><select id="call-type-filter" value={callTypeFilter} onChange={e => setCallTypeFilter(e.target.value)}><option value="all">Todos</option><option value="inbound">Entrantes</option><option value="outbound">Salientes</option></select></label>
  <label htmlFor="call-status-filter"><span>Estado</span><select id="call-status-filter" value={callStatusFilter} onChange={e => setCallStatusFilter(e.target.value)}><option value="all">Todos</option>{Object.entries(callStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  <span className="client-results-count" role="status">{callsLoading ? 'Cargando…' : `${filteredCalls.length} de ${calls.length} llamadas`}</span>
</div>
{canWrite && showCallForm && (
  <div className="dashboard-card">
    <div className="card-heading">
      <div>
        <h2>{editingCallId ? 'Editar llamada' : 'Nueva llamada'}</h2>
        <p>Introduce los datos de la llamada.</p>
      </div>
    </div>

    <form
      className="company-form"
      onSubmit={saveCall}
    >
      <div className="form-grid">

        <div className="form-field">
          <label>Cliente</label>
          <select
            value={callForm.company_id}
            onChange={(e) =>
              setCallForm({
                ...callForm,
                company_id: e.target.value,
                contact_id: '',
                opportunity_id: ''
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
            value={callForm.contact_id}
            onChange={(e) =>
              setCallForm({
                ...callForm,
                contact_id: e.target.value
              })
            }
          >
            <option value="">Sin contacto</option>
            {contacts
              .filter(
                (contact) =>
                  !callForm.company_id ||
                  contact.company_id === callForm.company_id
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
            value={callForm.opportunity_id}
            onChange={(e) =>
              setCallForm({
                ...callForm,
                opportunity_id: e.target.value
              })
            }
          >
            <option value="">Sin oportunidad</option>
            {opportunities
              .filter(
                (opportunity) =>
                  !callForm.company_id ||
                  opportunity.company_id === callForm.company_id
              )
              .map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.title}
                </option>
              ))}
          </select>
        </div>

        <div className="form-field">
          <label>Tipo de llamada</label>
          <select
            value={callForm.direction}
            onChange={(e) =>
              setCallForm({
                ...callForm,
                direction: e.target.value
              })
            }
          >
            <option value="inbound">Entrante</option>
            <option value="outbound">Saliente</option>
          </select>
        </div>

        <div className="form-field">
          <label>Estado</label>
          <select
            value={callForm.status}
            onChange={(e) =>
              setCallForm({
                ...callForm,
                status: e.target.value
              })
            }
          >
            <option value="completed">Completada</option>
            <option value="missed">Perdida</option>
            <option value="cancelled">Cancelada</option>
            <option value="scheduled">Programada</option>
          </select>
        </div>

        <div className="form-field">
          <AgendaDateTime label="Fecha y hora" required={false} value={callForm.started_at} onChange={value => setCallForm(current => ({ ...current, started_at: value }))} />
        </div>

        <div className="form-field">
          <label>Duración (segundos)</label>
          <input
            type="number"
            min="0"
            value={callForm.duration_seconds}
            onChange={(e) =>
              setCallForm({
                ...callForm,
                duration_seconds: e.target.value
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Resultado</label>
          <input
            type="text"
            value={callForm.outcome}
            onChange={(e) =>
              setCallForm({
                ...callForm,
                outcome: e.target.value
              })
            }
            placeholder="Ej.: Cliente interesado"
          />
        </div>

        <div className="form-field form-field-full">
          <label>Notas</label>
          <textarea
            value={callForm.notes}
            onChange={(e) =>
              setCallForm({
                ...callForm,
                notes: e.target.value
              })
            }
            placeholder="Observaciones de la llamada..."
          />
        </div>

      </div>

      <div className="form-actions">
        <button
          type="button"
          className="secondary-action"
          onClick={() => {
            setShowCallForm(false)
            setEditingCallId(null)
          }}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="primary-action"
          disabled={callSaving}
        >
          {callSaving ? 'Guardando...' : 'Guardar llamada'}
        </button>
      </div>
    </form>
  </div>
)}
    {callsLoading ? (
      <div className="dashboard-card">
        Cargando llamadas...
      </div>
    ) : calls.length === 0 ? (
      <div className="dashboard-card">
        <div className="empty-state">
          <strong>No hay llamadas registradas</strong>
          <span>Pulsa “+ Nueva llamada” para añadir la primera.</span>
        </div>
      </div>
    ) : (
      <div className="dashboard-card clients-list" style={{ overflowX: 'auto' }}>
        <div className="clients-table-header" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.2fr 1.2fr 0.75fr 0.9fr 90px', minWidth: '760px', gap: '16px', alignItems: 'center' }}>
          <span>FECHA</span>
          <span>CLIENTE</span>
          <span>CONTACTO</span>
          <span>TIPO</span>
          <span>ESTADO</span>
          <span>ACCIONES</span>
        </div>

        {filteredCalls.length === 0 && <div className="empty-state" style={{ padding: 24 }}><strong>No hay llamadas que coincidan</strong><span>Prueba otra búsqueda o cambia los filtros.</span><button type="button" className="clear-filter-button" onClick={() => { setCallSearch(''); setCallTypeFilter('all'); setCallStatusFilter('all') }}>Limpiar filtros</button></div>}
        {filteredCalls.map((call) => (
          <div className="client-row" key={call.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.2fr 1.2fr 0.75fr 0.9fr 90px', minWidth: '760px', gap: '16px', alignItems: 'center' }}>
            <div>
              {call.started_at
                ? new Date(call.started_at).toLocaleString('es-ES')
                : '-'}
            </div>

            <div>
              {call.companies?.name || 'Sin cliente'}
            </div>

            <div>
              {`${call.contacts?.first_name || ''} ${call.contacts?.last_name || ''}`.trim() || 'Sin contacto'}
            </div>

            <div>
              <span className="opportunity-stage-badge" style={call.direction === 'inbound' ? { background: '#dbeafe', color: '#1e40af' } : { background: '#ede9fe', color: '#5b21b6' }}>{call.direction === 'inbound' ? 'Entrante' : call.direction === 'outbound' ? 'Saliente' : call.direction || 'Sin tipo'}</span>
            </div>

            <div>
              <span className="opportunity-stage-badge" style={callStatusColors[call.status] || callStatusColors.cancelled}>{callStatusLabels[call.status] || call.status || 'Sin estado'}</span>
            </div>

<div className="client-actions">
  {canWrite && (<button
    type="button"
    onClick={() => editCall(call)}
  >
    Editar
  </button>)} 
</div>
          </div>
        ))}
      </div>
    )}
  </>
) : currentPage === 'agenda' ? (
  <Agenda brandName={organization?.name} key={activeOrg} organizationId={activeOrg} allowEdit={canEditModule('agenda')} session={session} profile={profile} tasks={tasks} companies={companies} contacts={contacts} onEditTask={(task) => { if (canViewModule('tasks')) { setCurrentPage('tasks'); if (canEditModule('tasks')) editTask(task) } }} />
) : currentPage === 'tasks' ? (
  <>
    <div className="dashboard-heading">
      <div>
        <p className="dashboard-kicker">{organization?.name || 'GLOBALTEC'} CRM</p>
        <h1>Tareas</h1>
        <p>Gestión y seguimiento de tareas pendientes.</p>
      </div>

      {canWrite && (<button
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
      </button>)} 
    </div>
<div className="client-filter-toolbar">
  <label className="client-search-field" htmlFor="task-search"><span>Buscar tareas</span><input id="task-search" type="search" placeholder="Título o cliente…" value={taskSearch} onChange={e => setTaskSearch(e.target.value)} /></label>
  <label htmlFor="task-status-filter"><span>Estado</span><select id="task-status-filter" value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)}><option value="all">Todos</option>{Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  <label htmlFor="task-priority-filter"><span>Prioridad</span><select id="task-priority-filter" value={taskPriorityFilter} onChange={e => setTaskPriorityFilter(e.target.value)}><option value="all">Todas</option>{Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  <span className="client-results-count" role="status">{tasksLoading ? 'Cargando…' : `${filteredTasks.length} de ${tasks.length} tareas`}</span>
</div>
{canWrite && showTaskForm && (
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
          <AgendaDateTime label="Fecha límite" required={false} value={taskForm.due_date} onChange={value => setTaskForm(current => ({ ...current, due_date: value }))} />
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

        {filteredTasks.length === 0 && <div className="empty-state" style={{ padding: 24 }}><strong>No hay tareas que coincidan</strong><span>Prueba otra búsqueda o cambia los filtros.</span><button type="button" className="clear-filter-button" onClick={() => { setTaskSearch(''); setTaskStatusFilter('all'); setTaskPriorityFilter('all') }}>Limpiar filtros</button></div>}
        {filteredTasks.map((task) => (
          <div className="client-row" key={task.id}>
            <div className="client-main">
              <strong>{task.title}</strong>
 <small>
  {{
    general: 'Gestión',
    call: 'Llamada',
    email: 'Email',
    meeting: 'Reunión',
    follow_up: 'Seguimiento',
    proposal: 'Presupuesto'
  }[task.task_type] || 'Tarea'}
</small>
            </div>

            <div>
              {task.companies?.name || 'Sin cliente'}
            </div>

            <div>
              <span className="opportunity-stage-badge" style={taskStatusColors[task.status] || taskStatusColors.pending}>{taskStatusLabels[task.status] || task.status || 'Pendiente'}</span>            </div>

            <div>
<span className="opportunity-stage-badge" style={taskPriorityColors[task.priority] || taskPriorityColors.normal}>{taskPriorityLabels[task.priority] || task.priority || 'Normal'}</span>
            </div>

<div className="client-actions">
  {canWrite && (<button
    type="button"
    onClick={() => editTask(task)}
  >
    Editar
  </button>)} 
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
        <p className="dashboard-kicker">{organization?.name || 'GLOBALTEC'} CRM</p>
        <h1>Tu negocio, de un vistazo.</h1>
        <p>Resumen de la actividad comercial.</p>
      </div>

{canWrite && (<button
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
</button>)} 
    </div>

    <div className="stats-grid">
      <button type="button" className="stat-card stat-clients dashboard-shortcut" aria-label="Ir a Clientes" disabled={!canViewModule('clients')} onClick={() => {
          if (!canViewModule('clients')) return
          setCurrentPage('clients')
          loadCompanies(); loadContacts()
        }}>
        <CRMIcon name="clients" className="stat-icon" />
        <span>Clientes</span>
<strong>{companies.length}</strong>
        <small>Total registrados</small>
      </button>

      <button type="button" className="stat-card stat-opportunities dashboard-shortcut" aria-label="Ir a Oportunidades" disabled={!canViewModule('opportunities')} onClick={() => {
          if (!canViewModule('opportunities')) return
          setCurrentPage('opportunities')
          loadCompanies(); loadContacts(); loadOpportunities(); loadOpportunityOptions()
        }}>
        <CRMIcon name="opportunities" className="stat-icon" />
        <span>Oportunidades</span>
<strong>{opportunities.length}</strong>
        <small>En seguimiento</small>
      </button>

      <button type="button" className="stat-card stat-tasks dashboard-shortcut" aria-label="Ir a Tareas" disabled={!canViewModule('tasks')} onClick={() => {
          if (!canViewModule('tasks')) return
          setCurrentPage('tasks')
          loadTasks(); loadCompanies(); loadContacts(); loadOpportunities()
        }}>
        <CRMIcon name="tasks" className="stat-icon" />
        <span>Tareas pendientes</span>
        <strong><strong>
  {tasks.filter(
    (task) =>
      task.status === 'pending' ||
      task.status === 'in_progress'
  ).length}
</strong></strong>
        <small>Por completar</small>
      </button>

      <button type="button" className="stat-card stat-calls dashboard-shortcut" aria-label="Ir a Llamadas" disabled={!canViewModule('calls')} onClick={() => {
          if (!canViewModule('calls')) return
          setCurrentPage('calls')
          loadCalls(); loadCompanies(); loadContacts(); loadOpportunities()
        }}>
        <CRMIcon name="calls" className="stat-icon" />
        <span>Llamadas</span>
       <strong>{calls.length}</strong>
        <small>Registradas</small>
      </button>
    </div>

    <div className="dashboard-grid">
      <div className="dashboard-card">
        <div className="card-heading">
          <div>
            <h2>Actividad reciente</h2>
            <p>Últimas gestiones realizadas</p>
          </div>
        </div>

<div className="recent-activity">
  {[
    ...calls.map((call) => ({
      id: `call-${call.id}`,
      type: 'call',
      date: call.created_at,
      title: 'Llamada registrada',
      detail: call.companies?.name || 'Sin cliente'
    })),

    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      type: 'task',
      date: task.created_at,
      title: task.title || 'Tarea',
      detail: 'Tarea creada'
    })),

    ...opportunities.map((opportunity) => ({
      id: `opportunity-${opportunity.id}`,
      type: 'opportunity',
      date: opportunity.created_at,
      title: opportunity.title || 'Oportunidad',
      detail: opportunity.companies?.name || 'Sin cliente'
    }))
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)
    .map((item) => (
      <div
  className="activity-item"
  key={item.id}
  onClick={() => {
    if (item.type === 'call') {
      setCurrentPage('calls')
      loadCalls()
    } else if (item.type === 'task') {
      setCurrentPage('tasks')
      loadTasks()
    } else if (item.type === 'opportunity') {
      setCurrentPage('opportunities')
      loadOpportunities()
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }}
  style={{ cursor: 'pointer' }}
>
        <div>
<span className={`activity-type activity-type-${item.type}`}>
  {item.type === 'call'
    ? 'LLAMADA'
    : item.type === 'task'
      ? 'TAREA'
      : 'OPORTUNIDAD'}
</span>

<strong>{item.title}</strong>
<span>{item.detail}</span>
        </div>

        <small>
          {new Date(item.date).toLocaleString('es-ES')}
        </small>
      </div>
    ))}
</div>
      </div>

      <div className="dashboard-card">
        <div className="card-heading">
          <div>
            <h2>Próximas tareas</h2>
            <p>Seguimientos pendientes</p>
          </div>
        </div>

{tasks.filter(
  (task) =>
    (task.status === 'pending' || task.status === 'in_progress') &&
    task.due_date
).length === 0 ? (
  <div className="empty-state">
    <strong>Todo al día</strong>
    <span>No hay tareas pendientes con fecha límite.</span>
  </div>
) : (
  <div className="upcoming-tasks">
    {tasks
      .filter(
        (task) =>
          (task.status === 'pending' || task.status === 'in_progress') &&
          task.due_date
      )
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5)
      .map((task) => (
        <div
          className="upcoming-task-item"
          key={task.id}
          onClick={() => {
            setCurrentPage('tasks')
            loadTasks()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <div>
            <strong>{task.title}</strong>
            <span>
              {task.companies?.name || 'Sin cliente'}
            </span>
          </div>

          <div className="upcoming-task-date">
            <strong>
              {new Date(task.due_date).toLocaleDateString('es-ES')}
            </strong>
            <span>
              {new Date(task.due_date).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      ))}
  </div>
)}
      </div>
    </div>
 </>
  )}
  </section>
</main>
     

    </div>
  )
}


function NewOrganization({ onCreated }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  const busy = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function save(e) {
    e.preventDefault()
    if (busy.current || created) return
    if (!name.trim()) { setError('Escribe el nombre de la empresa.'); return }
    busy.current = true; setSaving(true); setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('crm_create_organization', { p_name: name.trim() })
      if (rpcError) throw rpcError
      if (!data) throw new Error('No se ha recibido el identificador de la empresa.')
      if (!alive.current) return
      setCreated(true)
      await onCreated(data)
    } catch (err) { if (alive.current) setError(err.message || 'No se ha podido dar de alta la empresa.') }
    finally { busy.current = false; if (alive.current) setSaving(false) }
  }
  return <form className="dashboard-card" onSubmit={save} style={{ marginTop: 16, maxWidth: 620 }}>
    <h2>Nueva empresa</h2>
    <p>Se creará con sus siete etapas comerciales y tu acceso de administrador. Después podrás añadir su logo, colores y usuarios.</p>
    <fieldset disabled={saving || created} style={{ border: 0, padding: 0, margin: '20px 0' }}>
      <label className="form-field">Nombre de empresa<input value={name} onChange={e => setName(e.target.value)} required maxLength={150} autoFocus /></label>
    </fieldset>
    {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
    {created && <p role="status">Empresa creada. Si no aparece en el selector, cierra sesión y vuelve a entrar.</p>}
    <button className="primary-action" disabled={saving || created}>{saving ? 'Creando…' : created ? 'Empresa creada' : 'Crear empresa'}</button>
  </form>
}

function BrandingSettings({ organization, onSaved, onSourcesChanged }) {
  const [name, setName] = useState(organization.name || '')
  const [logo, setLogo] = useState(organization.logo_url || '')
  const [primary, setPrimary] = useState(brandingColor(organization.settings?.branding?.primary_color, '#087f74'))
  const [sidebar, setSidebar] = useState(brandingColor(organization.settings?.branding?.sidebar_color, '#142c48'))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function safeLogo(value) {
    if (!value.trim()) return ''
    try { const url = new URL(value.trim()); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null } catch { return null }
  }
  async function save(e) {
    e.preventDefault()
    if (saving) return
    setMessage(''); setError('')
    const logoUrl = safeLogo(logo)
    if (!name.trim()) { setError('Escribe el nombre de la empresa.'); return }
    if (logoUrl === null) { setError('El logotipo debe tener un enlace HTTPS válido.'); return }
    setSaving(true)
    try {
      const result = await supabase.rpc('crm_save_branding', { p_organization_id: organization.id, p_name: name.trim(), p_logo_url: logoUrl, p_primary_color: primary, p_sidebar_color: sidebar })
      if (result.error) throw result.error
      if (!alive.current) return
      onSaved({ ...organization, name: name.trim(), logo_url: logoUrl || null, settings: { ...organization.settings, branding: { primary_color: primary, sidebar_color: sidebar } } })
      setMessage('Personalización guardada.')
    } catch (err) { if (alive.current) setError(err.message || 'No se han podido guardar los cambios.') }
    finally { if (alive.current) setSaving(false) }
  }
  return <div className="branding-page">
    <div className="dashboard-heading"><div><h1>Personalización</h1><p>Nombre, logotipo y colores de esta empresa.</p></div></div>
    <div className="branding-layout"><form className="dashboard-card branding-form" onSubmit={save}>
      <label className="form-field">Nombre de empresa<input value={name} onChange={e => setName(e.target.value)} maxLength={150} required disabled={saving} /></label>
      <label className="form-field">Enlace HTTPS del logotipo<input type="url" value={logo} onChange={e => setLogo(e.target.value)} placeholder="https://…/logo.png" disabled={saving} /><small>Déjalo vacío para mostrar solo el nombre.</small></label>
      <label className="branding-color">Color principal<input type="color" value={primary} onChange={e => setPrimary(e.target.value)} disabled={saving} /><span>{primary}</span></label>
      <label className="branding-color">Color del menú<input type="color" value={sidebar} onChange={e => setSidebar(e.target.value)} disabled={saving} /><span>{sidebar}</span></label>
      {error && <p role="alert" className="branding-error">{error}</p>}{message && <p role="status">{message}</p>}
      <button className="primary-action" disabled={saving}>{saving ? 'Guardando…' : 'Guardar personalización'}</button>
    </form><div className="dashboard-card branding-preview"><h2>Vista previa</h2><div className="branding-preview-header"><BrandLogo key={logo} url={safeLogo(logo)} name={name} /><strong>{name || 'Tu empresa'}</strong><span>CRM</span></div><div className="branding-preview-menu" style={{ background: sidebar, color: brandingInk(sidebar) }}><span>ESPACIO DE TRABAJO</span><div style={{ background: primary, color: brandingInk(primary) }}>Panel principal</div><p>Clientes</p><p>Agenda</p></div><p>Los cambios se aplican al guardar.</p></div></div>
    <LeadSourceSettings key={organization.id} organizationId={organization.id} onChanged={onSourcesChanged} />
    <ServiceSettings key={`services-${organization.id}`} organizationId={organization.id} onChanged={onSourcesChanged} />
  </div>
}

function ClientAttachments({ company, session, profile, allowEdit }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(null)
  const canUpload = !!allowEdit && !!profile?.active && profile.role !== 'demo'
  const canDelete = canUpload && profile.role === 'admin'
  const bucket = supabase.storage.from('crm-attachments')
  async function loadFiles() {
    setLoading(true)
    const { data, error } = await supabase.from('crm_attachments').select('*').eq('company_id', company.id).order('created_at', { ascending: false })
    if (error) setMessage('No se han podido cargar los documentos: ' + error.message)
    else setFiles(data || [])
    setLoading(false)
  }
  useEffect(() => { loadFiles() }, [company.id])
  async function registerFile(record) {
    const { data, error } = await supabase.from('crm_attachments').insert(record).select('id')
    if (error || !data?.length) {
      setPending(record)
      throw new Error('El archivo se ha subido, pero falta registrarlo en la ficha. Pulsa «Reintentar registro». ' + (error?.message || 'Permiso de registro denegado.'))
    }
    setPending(null)
    await loadFiles()
    setMessage('Documento guardado correctamente.')
  }
  async function uploadFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || working || !canUpload || pending) return
    setMessage('')
    if (!file.size || file.size > 10 * 1024 * 1024) { setMessage('Elige un archivo de entre 1 byte y 10 MB.'); return }
    if (!company.organization_id) { setMessage('Este cliente no tiene una empresa asignada.'); return }
    setWorking(true)
    try {
      const id = crypto.randomUUID()
      const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150) || 'documento'
      const path = `${company.organization_id}/${company.id}/${id}/${safeName}`
      const { error } = await bucket.upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' })
      if (error) throw error
      await registerFile({ id, organization_id: company.organization_id, company_id: company.id, file_name: file.name, object_path: path, mime_type: file.type || null, file_size: file.size, uploaded_by: session.user.id })
    } catch (error) { setMessage(error.message || 'No se ha podido subir el documento.') }
    finally { setWorking(false) }
  }
  async function retryRegistration() {
    if (!pending || working) return
    setWorking(true)
    try { await registerFile(pending) }
    catch (error) { setMessage(error.message) }
    finally { setWorking(false) }
  }
  async function downloadFile(file) {
    setWorking(true); setMessage('')
    try {
      const { data, error } = await bucket.download(file.object_path)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url; link.download = file.file_name
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) { setMessage('No se ha podido descargar: ' + error.message) }
    finally { setWorking(false) }
  }
  async function deleteFile(file) {
    if (!canDelete || working || !window.confirm(`¿Eliminar «${file.file_name}»? Esta acción no se puede deshacer.`)) return
    setWorking(true); setMessage('')
    try {
      const { error: storageError } = await bucket.remove([file.object_path])
      if (storageError) throw storageError
      const { data, error } = await supabase.from('crm_attachments').delete().eq('id', file.id).select('id')
      if (error || !data?.length) throw new Error('El archivo se ha borrado, pero falta quitar su registro. Reintenta eliminarlo. ' + (error?.message || 'Permiso denegado.'))
      await loadFiles(); setMessage('Documento eliminado.')
    } catch (error) { setMessage(error.message) }
    finally { setWorking(false) }
  }
  const sizeLabel = bytes => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`
  return <section className="client-attachments">
    <style>{`
      .client-attachments{margin-top:28px;padding:22px;border:1px solid #dce6ec;border-radius:16px;background:#f8fbfc}.attachment-header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.attachment-upload input{max-width:100%;font-size:13px;color:#526578}.attachment-upload input::file-selector-button{background:#087f8c;color:white;border:0;border-radius:10px;padding:11px 16px;margin-right:10px;font:inherit;font-weight:600;cursor:pointer}.attachment-upload input:disabled{opacity:.55}.attachment-header h3{margin:0 0 6px;color:#123047}.attachment-header p{margin:0;color:#64748b;font-size:13px}.client-attachments .attachment-button{display:inline-flex;align-items:center;justify-content:center;background:#087f8c;color:white;border:0;border-radius:10px;padding:10px 16px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}.client-attachments .attachment-button:disabled{opacity:.55;cursor:wait}.client-attachments .attachment-button.secondary{background:white;color:#123047;border:1px solid #cbd5e1}.client-attachments .attachment-button.danger{background:#fff1f2;color:#be123c;border:1px solid #fecdd3}.attachment-list{display:grid;gap:10px;margin-top:18px}.attachment-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:16px;background:white;border:1px solid #e2e8f0;border-radius:12px}.attachment-info{flex:1;min-width:150px;overflow-wrap:anywhere}.attachment-info strong{display:block}.attachment-info small{display:block;color:#64748b;margin-top:6px}.attachment-actions{display:flex;gap:8px;flex-wrap:wrap}.attachment-message{padding:12px;border-radius:10px;background:#e9f3f6;overflow-wrap:anywhere;font-size:13px}
    `}</style>
    <div className="attachment-header"><div><h3>Documentos y adjuntos</h3><p>Documentos de este cliente · Máximo 10 MB por archivo</p></div>{canUpload && <label className="attachment-upload"><span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Seleccionar documento</span><input type="file" disabled={working || !!pending} onChange={uploadFile} /></label>}</div>
    {message && <p className="attachment-message" role="status">{message}</p>}
    {pending && <button type="button" className="attachment-button" disabled={working} onClick={retryRegistration}>Reintentar registro</button>}
    {working && <p role="status">Procesando documento…</p>}
    {loading ? <p>Cargando documentos…</p> : files.length === 0 ? <p style={{ color: '#64748b', marginTop: 20 }}>Todavía no hay documentos para este cliente.</p> : <div className="attachment-list">{files.map(file => <div className="attachment-row" key={file.id}><div className="attachment-info"><strong>📎 {file.file_name}</strong><small>{sizeLabel(file.file_size)} · {new Date(file.created_at).toLocaleDateString('es-ES')}</small></div><div className="attachment-actions"><button type="button" className="attachment-button secondary" disabled={working} onClick={() => downloadFile(file)}>Descargar</button>{canDelete && <button type="button" className="attachment-button danger" disabled={working} onClick={() => deleteFile(file)}>Eliminar</button>}</div></div>)}</div>}
  </section>
}

function AgendaDateTime({ label, value, onChange, required = true }) {
  const [date = '', time = '00:00'] = (value || '').split('T')
  const [hour = '00', minute = '00'] = time.split(':')
  const update = (nextDate, nextHour, nextMinute) => onChange(nextDate ? `${nextDate}T${nextHour}:${nextMinute}` : '')
  return <div className="agenda-datetime-field">
    <span>{label}</span>
    <div className="agenda-datetime-controls">
      <input aria-label={`${label}: fecha`} type="date" required={required} value={date} onChange={e => update(e.target.value, hour, minute)} />
      <select aria-label={`${label}: hora`} value={hour} onChange={e => update(date, e.target.value, minute)}>
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={`${label}: minutos`} value={minute} onChange={e => update(date, hour, e.target.value)}>
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  </div>
}

function Agenda({ brandName, session, profile, tasks, companies, contacts, onEditTask, organizationId, allowEdit }) {
  const [view, setView] = useState('month')
  const [anchor, setAnchor] = useState(new Date())
  const [meetings, setMeetings] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const readOnly = !allowEdit || !profile?.active || profile?.role === 'demo'
  const localInput = (date) => {
    const d = new Date(date)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }
  async function loadMeetings() {
    setBusy(true)
    const { data, error } = await supabase.from('activities').select('*').eq('activity_type', 'meeting').eq('organization_id', organizationId).order('activity_date')
    if (error) setMessage('No se han podido cargar las citas: ' + error.message)
    else setMeetings(data || [])
    setBusy(false)
  }
  useEffect(() => { loadMeetings() }, [])
  function newMeeting(day = anchor) {
    const start = new Date(day)
    start.setHours(10, 0, 0, 0)
    setMessage('')
    setForm({ subject: '', description: '', company_id: '', contact_id: '', activity_date: localInput(start), end_date: localInput(new Date(start.getTime() + 3600000)) })
  }
  async function saveMeeting(e) {
    e.preventDefault()
    if (readOnly) return
    const start = new Date(form.activity_date), end = new Date(form.end_date)
    if (!form.subject.trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setMessage('Indica un título y una hora de finalización posterior al inicio.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      let org = organizationId
      if (!form.id) {
        const { data, error } = await supabase.from('organization_members').select('organization_id').eq('user_id', session.user.id).eq('active', true)
        if (error) throw error
        const client = companies.find(c => c.id === form.company_id)
        const orgs = [...new Set((data || []).map(m => m.organization_id))]
        org = organizationId
        if (client && client.organization_id !== org) throw new Error('El cliente pertenece a otra empresa.')
        if (!org || !orgs.includes(org)) throw new Error('Selecciona un cliente de tu organización para guardar la cita.')
      }
      const payload = { subject: form.subject.trim(), description: form.description || null, company_id: form.company_id || null, contact_id: form.contact_id || null, activity_date: start.toISOString(), end_date: end.toISOString() }
      const query = form.id
        ? supabase.from('activities').update(payload).eq('id', form.id).eq('organization_id', organizationId).eq('activity_type', 'meeting')
        : supabase.from('activities').insert({ ...payload, activity_type: 'meeting', user_id: session.user.id, organization_id: org })
      const { data, error } = await query.select('id')
      if (error) throw error
      if (!data?.length) throw new Error('No tienes permiso para guardar esta cita.')
      setForm(null)
      await loadMeetings()
    } catch (err) { setMessage('No se ha podido guardar: ' + err.message) }
    finally { setSaving(false) }
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), view === 'month' ? 1 : anchor.getDate())
  if (view !== 'day') start.setDate(start.getDate() - (start.getDay() + 6) % 7)
  const days = Array.from({ length: view === 'month' ? 42 : view === 'week' ? 7 : 1 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const events = [
    ...tasks.filter(t => t.due_date).map(t => ({ ...t, kind: 'task', start: new Date(t.due_date), title: t.title })),
    ...meetings.filter(m => m.activity_date).map(m => ({ ...m, kind: 'meeting', start: new Date(m.activity_date), title: m.subject }))
  ].sort((a, b) => a.start - b.start)
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const eventsFor = (day) => events.filter(e => {
    if (e.kind === 'task' || !e.end_date) return sameDay(e.start, day)
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    return e.start < next && new Date(e.end_date) > day
  })
  function move(direction) {
    const d = new Date(anchor)
    if (view === 'month') { d.setDate(1); d.setMonth(d.getMonth() + direction) }
    else d.setDate(d.getDate() + direction * (view === 'week' ? 7 : 1))
    setAnchor(d)
  }
  function openEvent(e) {
    if (e.kind === 'task') onEditTask(e)
    else {
      setMessage('')
      setForm({ ...e, activity_date: localInput(e.activity_date), end_date: localInput(e.end_date || new Date(e.start.getTime() + 3600000)), company_id: e.company_id || '', contact_id: e.contact_id || '' })
    }
  }
  const colors = { pending: ['#fff7ed', '#9a3412'], in_progress: ['#eff6ff', '#1d4ed8'], completed: ['#ecfdf5', '#047857'], cancelled: ['#f1f5f9', '#64748b'] }
  return <section className="agenda-shell">
    <style>{`
      .agenda-shell{--ag-ink:#123047;color:var(--ag-ink)}
      .agenda-hero{padding:24px;border-radius:20px;background:linear-gradient(120deg,#103b50,#087f8c);color:white;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
      .agenda-hero h1{margin:4px 0;font-size:30px;color:white}.agenda-hero p{margin:4px 0;color:#d2edf0}
      .agenda-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0}.agenda-toolbar strong{flex:1;min-width:180px;text-transform:capitalize}
      .agenda-shell button{cursor:pointer}
      .agenda-shell .primary-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border:0;border-radius:12px;background:#087f8c;color:white;font:inherit;font-size:14px;font-weight:700;min-height:44px;box-shadow:0 4px 12px rgba(8,127,140,.18);transition:background .15s,transform .15s}
      .agenda-shell .primary-btn:hover{background:#066775;transform:translateY(-1px)}
      .agenda-shell .primary-btn:focus-visible{outline:3px solid #fbbf24;outline-offset:3px}
      .agenda-shell .primary-btn:disabled{opacity:.6;cursor:wait;transform:none}
      .agenda-hero .primary-btn{background:white;color:#076b79;box-shadow:0 6px 18px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.65)}
      .agenda-hero .primary-btn:hover{background:#e6f7f8}.agenda-control{padding:10px 15px;background:white;border:1px solid #cbd5e1;border-radius:10px;color:#123047}.agenda-control.active{background:#087f8c;color:white;border-color:#087f8c}
      .agenda-scroll{overflow-x:auto;background:white;border:1px solid #dde7ed;border-radius:16px}.agenda-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));min-width:840px}.agenda-grid.day{grid-template-columns:1fr;min-width:0}
      .agenda-day{min-height:145px;padding:10px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.agenda-day.outside{background:#f8fafc}.agenda-date{background:transparent;border:0;border-radius:8px;padding:6px;font-weight:700;color:#123047}.agenda-date.today{background:#087f8c;color:white}
      .agenda-event{display:block;width:100%;text-align:left;border:0;border-left:3px solid currentColor;border-radius:7px;padding:8px;margin:6px 0;white-space:normal;overflow-wrap:anywhere;font-size:12px}.agenda-event small{display:block;margin-top:3px}.agenda-weekday{padding:12px;text-align:center;background:#f1f6f9;font-size:12px;font-weight:700}.agenda-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;margin:12px 0;color:#526578}
      .agenda-form{padding:24px;background:white;border:1px solid #dce6ec;border-radius:16px;margin-bottom:20px}.agenda-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.agenda-fields label,.agenda-datetime-field{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:600}.agenda-fields input,.agenda-fields select,.agenda-fields textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:9px;font:inherit}.agenda-form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}@media(max-width:600px){.agenda-fields{grid-template-columns:1fr}}
      .agenda-datetime-controls{display:grid;grid-template-columns:minmax(0,1fr) 66px 8px 66px;gap:6px;align-items:center}.agenda-datetime-controls input{min-width:0}.agenda-datetime-controls select{padding:11px 6px}.agenda-fields{align-items:start}
    `}</style>
    <div className="agenda-hero"><div><small>{brandName || 'GLOBALTEC'} CRM · ORGANIZA TU DÍA</small><h1>Agenda</h1><p>Tus citas y tareas, en un solo calendario.</p></div>{!readOnly && <button className="primary-btn" onClick={() => newMeeting()}>+ Nueva cita</button>}</div>
    {message && <p role="alert" style={{ color: '#b91c1c' }}>{message}</p>}
    {form && <form className="agenda-form" onSubmit={saveMeeting}><h2>{form.id ? 'Editar cita' : 'Nueva cita'}</h2><fieldset disabled={saving || readOnly} style={{ border: 0, padding: 0, margin: 0 }}><div className="agenda-fields">
      <label>Título<input required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></label>
      <label>Cliente<select value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value, contact_id: '' })}><option value="">Sin cliente</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Contacto<select value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })}><option value="">Sin contacto</option>{contacts.filter(c => !form.company_id || c.company_id === form.company_id).map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></label>
      <AgendaDateTime label="Inicio" value={form.activity_date} onChange={value => setForm(current => {
        if (!current) return current
        const start = new Date(value)
        const end = value && Number.isFinite(start.getTime()) ? localInput(new Date(start.getTime() + 3600000)) : ''
        return { ...current, activity_date: value, end_date: current.id ? current.end_date : end }
      })} />
      <AgendaDateTime label="Finalización" value={form.end_date} onChange={value => setForm({ ...form, end_date: value })} />
      <label>Notas<textarea rows="3" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
    </div></fieldset><div className="agenda-form-actions"><button type="button" disabled={saving} className="agenda-control" onClick={() => setForm(null)}>Cancelar</button>{!readOnly && <button disabled={saving} className="primary-btn" type="submit">{saving ? 'Guardando…' : 'Guardar cita'}</button>}</div></form>}
    <div className="agenda-toolbar"><button className="agenda-control" aria-label="Periodo anterior" onClick={() => move(-1)}>‹</button><button className="agenda-control" onClick={() => setAnchor(new Date())}>Hoy</button><button className="agenda-control" aria-label="Periodo siguiente" onClick={() => move(1)}>›</button><strong>{view === 'month' ? anchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : view === 'week' ? `${days[0].toLocaleDateString('es-ES')} – ${days[6].toLocaleDateString('es-ES')}` : anchor.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>{[['month','Mes'],['week','Semana'],['day','Día']].map(([key,label]) => <button key={key} className={`agenda-control ${view === key ? 'active' : ''}`} onClick={() => setView(key)}>{label}</button>)}</div>
    <div className="agenda-legend"><span>🟣 Citas</span><span>🟠 Pendientes</span><span>🔵 En curso</span><span>🟢 Completadas</span><span>⚪ Canceladas</span></div>
    {busy && <p>Cargando citas…</p>}
    <div className="agenda-scroll"><div className={`agenda-grid ${view === 'day' ? 'day' : ''}`}>
      {view !== 'day' && ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(d => <div key={d} className="agenda-weekday">{d}</div>)}
      {days.map(day => <div key={day.toISOString()} className={`agenda-day ${view === 'month' && day.getMonth() !== anchor.getMonth() ? 'outside' : ''}`}>
        <button className={`agenda-date ${sameDay(day, new Date()) ? 'today' : ''}`} onClick={() => { setAnchor(day); setView('day') }}>{day.toLocaleDateString('es-ES', { day: 'numeric', ...(view !== 'month' ? { month: 'short' } : {}) })}</button>
        {eventsFor(day).map(event => {
          const [bg, fg] = event.kind === 'meeting' ? ['#f3e8ff', '#7e22ce'] : (colors[event.status] || colors.pending)
          const client = companies.find(c => c.id === event.company_id)
          return <button key={`${event.kind}-${event.id}`} className="agenda-event" style={{ background: bg, color: fg }} onClick={() => openEvent(event)}><b>{event.start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</b> · {event.title}<small>{event.kind === 'meeting' ? 'Cita' : ({ pending: 'Pendiente', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' }[event.status] || 'Tarea')}{client ? ` · ${client.name}` : ''}</small>{event.kind === 'meeting' && event.end_date && <small>Hasta {new Date(event.end_date).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>}</button>
        })}
        {view !== 'month' && eventsFor(day).length === 0 && <p style={{ fontSize: 12, color: '#94a3b8' }}>Sin citas ni tareas</p>}
        {view === 'day' && !readOnly && <button className="agenda-control" onClick={() => newMeeting(day)}>+ Añadir cita</button>}
      </div>)}
    </div></div>
  </section>
}


const CRM_MODULES = [
  ['dashboard','Inicio'], ['clients','Clientes'], ['contacts','Contactos'],
  ['opportunities','Oportunidades'], ['calls','Llamadas'], ['agenda','Agenda'],
  ['tasks','Tareas'], ['reports','Informes']
]

function NewCRMUser({ organizationId, brandName, onCreated, onCancel }) {
  const defaultPermissions = () => Object.fromEntries(CRM_MODULES.map(([module]) => [module, { can_view: true, can_edit: !['dashboard','reports'].includes(module) }]))
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'agent' })
  const [permissions, setPermissions] = useState(defaultPermissions)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function changePermission(module, field, value) {
    setPermissions(current => {
      const row = { ...current[module], [field]: value }
      if (field === 'can_view' && !value) row.can_edit = false
      if (field === 'can_edit' && value) row.can_view = true
      return { ...current, [module]: row }
    })
  }
  async function create(e) {
    e.preventDefault()
    if (pending.current) return
    pending.current = true; setSaving(true); setError('')
    try {
      const rows = Object.fromEntries(CRM_MODULES.map(([module]) => [module, {
        can_view: permissions[module].can_view,
        can_edit: form.role !== 'demo' && !['dashboard','reports'].includes(module) && permissions[module].can_edit,
      }]))
      const result = await supabase.functions.invoke('crm-create-user', { body: {
        organization_id: organizationId, full_name: form.full_name.trim(),
        email: form.email.trim(), password: form.password, role: form.role, permissions: rows,
      } })
      if (result.error) {
        let message = 'No se ha podido confirmar el alta. Comprueba el listado antes de repetirla.'
        try {
          const payload = await result.error.context?.json()
          if (payload?.error) message = payload.error
        } catch { /* La conexión puede fallar antes de recibir una respuesta. */ }
        throw new Error(message)
      }
      if (!result.data?.user?.id) throw new Error(result.data?.error || 'El servidor no ha confirmado el alta.')
      if (!alive.current) return
      setForm(current => ({ ...current, password: '' }))
      onCreated(result.data.user, result.data.permissions)
    } catch (err) { if (alive.current) setError(err.message) }
    finally { pending.current = false; if (alive.current) setSaving(false) }
  }
  return <form onSubmit={create} style={{background:'white',padding:24,borderRadius:16,border:'1px solid #dce6ec',marginBottom:24}}>
    <h2>Nuevo usuario</h2><p>Empresa: <strong>{brandName}</strong></p>
    <fieldset disabled={saving} style={{border:0,padding:0,margin:0}}>
      <div className="form-grid">
        <label>Nombre<input required maxLength={150} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} autoComplete="off" /></label>
        <label>Correo electrónico<input type="email" required maxLength={254} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="off" /></label>
        <label>Contraseña inicial<input type="password" required minLength={12} maxLength={128} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /><small>Mínimo 12 caracteres. Entrégala al usuario para que pueda iniciar sesión.</small></label>
        <label>Rol<select value={form.role} onChange={e => { const role = e.target.value; setForm({ ...form, role }); if (role === 'demo') setPermissions(current => Object.fromEntries(Object.entries(current).map(([module,row]) => [module, { ...row, can_edit: false }])) ) }}><option value="agent">Agente</option><option value="admin">Administrador</option><option value="demo">Demo · solo consulta</option></select></label>
      </div>
      {form.role === 'admin' && <p>Un administrador puede gestionar usuarios y permisos de esta empresa.</p>}
      <h3>Secciones permitidas</h3>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{textAlign:'left',padding:12}}>Sección</th><th>Puede ver</th><th>Puede editar</th></tr></thead><tbody>{CRM_MODULES.map(([module,label]) => <tr key={module} style={{borderTop:'1px solid #e2e8f0'}}><td style={{padding:12}}>{label}</td><td style={{textAlign:'center'}}><input type="checkbox" aria-label={`Nuevo usuario: ver ${label}`} checked={permissions[module].can_view} onChange={e => changePermission(module,'can_view',e.target.checked)} /></td><td style={{textAlign:'center'}}>{form.role !== 'demo' && !['dashboard','reports'].includes(module) ? <input type="checkbox" aria-label={`Nuevo usuario: editar ${label}`} checked={permissions[module].can_edit} onChange={e => changePermission(module,'can_edit',e.target.checked)} /> : 'Solo consulta'}</td></tr>)}</tbody></table></div>
      <div style={{display:'flex',gap:12,marginTop:20}}><button className="primary-action" type="submit">{saving ? 'Creando…' : 'Crear usuario'}</button><button type="button" onClick={onCancel}>Cancelar</button></div>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>
}

function ModulePermissions({ actorId, brandName, organizationId, onSaved }) {
  const [creating, setCreating] = useState(false)
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [draftRole, setDraftRole] = useState('agent')
  const [managing, setManaging] = useState(false)
  const pending = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    let cancelled = false
    setBusy(true); setMessage(''); setUsers([]); setPermissions([]); setSelectedUser(''); setCreating(false)
    async function load() {
      try {
        const result = await supabase.rpc('crm_list_company_users', {
          p_organization_id: organizationId,
        })
        if (result.error) throw result.error
        if (!Array.isArray(result.data?.users) || !Array.isArray(result.data?.permissions)) {
          throw new Error('El servidor no ha devuelto un listado válido.')
        }
        if (cancelled) return
        const rows = result.data.users
        setPermissions(result.data.permissions); setUsers(rows); setSelectedUser(rows[0]?.id || '')
      } catch (err) { if (!cancelled) setMessage('No se han podido cargar los permisos: ' + err.message) }
      finally { if (!cancelled) setBusy(false) }
    }
    load()
    return () => { cancelled = true }
  }, [organizationId])
  const user = users.find(u => u.id === selectedUser)
  useEffect(() => { setDraftRole(user?.role || 'agent') }, [selectedUser, user?.role])
  const protectedUser = selectedUser === actorId || selectedUser === '4572a164-9b54-46b5-8382-4e50a8b4dfef'
  const working = saving || managing
  async function manageUser(nextRole, nextActive) {
    if (!user || protectedUser || pending.current) return
    const target = user.id
    if (!nextActive && !window.confirm(`Desactivar a ${user.full_name || 'este usuario'} en ${brandName || 'esta empresa'}? Sus registros se conservarán.`)) return
    pending.current = true; setManaging(true); setMessage('')
    try {
      const result = await supabase.rpc('crm_manage_user', {
        p_organization_id: organizationId, p_user_id: target,
        p_role: nextRole, p_active: nextActive,
      })
      if (result.error) throw result.error
      if (result.data?.id !== target || result.data?.organization_id !== organizationId
          || result.data?.role !== nextRole || result.data?.active !== nextActive) {
        throw new Error('No se ha confirmado el cambio. Recarga el listado antes de repetirlo.')
      }
      if (!alive.current) return
      setUsers(current => current.map(u => u.id === target ? { ...u, role: nextRole, active: nextActive } : u))
      if (nextRole === 'demo') setPermissions(current => current.map(p => p.user_id === target ? { ...p, can_edit: false } : p))
      setMessage(nextActive ? 'Usuario actualizado. Debe cerrar sesión y volver a entrar para actualizar su acceso.' : 'Usuario desactivado en esta empresa. Sus registros se conservan.')
    } catch (err) { if (alive.current) setMessage('No se ha podido actualizar: ' + err.message) }
    finally { pending.current = false; if (alive.current) setManaging(false) }
  }
  function permission(module) {
    return permissions.find(p => p.user_id === selectedUser && p.module === module) || { organization_id: organizationId, user_id: selectedUser, module, can_view: false, can_edit: false }
  }
  function change(module, field, checked) {
    setMessage('')
    const row = { ...permission(module), [field]: checked }
    if (field === 'can_view' && !checked) row.can_edit = false
    if (field === 'can_edit' && checked) row.can_view = true
    setPermissions(previous => [...previous.filter(p => !(p.user_id === selectedUser && p.module === module)), row])
  }
  async function save(e) {
    e.preventDefault(); if (!user || !user.active || !user.profileActive || pending.current) return
    pending.current = true
    setSaving(true); setMessage('')
    try {
      const rows = CRM_MODULES.map(([module]) => {
        const row = permission(module)
        return { organization_id: organizationId, user_id: selectedUser, module, can_view: row.can_view, can_edit: user.role !== 'demo' && !['dashboard','reports'].includes(module) && row.can_edit }
      })
      const result = await supabase.from('crm_module_permissions').upsert(rows, { onConflict: 'organization_id,user_id,module' }).select('*')
      if (result.error) throw result.error
      if (result.data?.length !== rows.length) throw new Error('No tienes permiso para guardar todos los cambios.')
      if (!alive.current) return
      await onSaved()
      if (!alive.current) return
      setMessage('Permisos guardados. El usuario debe cerrar sesión y volver a entrar para actualizar el menú.')
    } catch (err) { if (alive.current) setMessage('No se han podido guardar: ' + err.message) }
    finally { pending.current = false; if (alive.current) setSaving(false) }
  }
  return <div>
    <div className="dashboard-heading"><div><p className="dashboard-kicker">{brandName || 'GLOBALTEC'} CRM</p><h1>Permisos de usuarios</h1><p>Elige qué puede consultar y editar cada usuario en esta empresa.</p></div></div>
    {!creating && <button className="primary-action" type="button" disabled={busy || working} onClick={() => { setCreating(true); setMessage('') }} style={{marginBottom:20}}>+ Nuevo usuario</button>}
    {creating && <NewCRMUser key={organizationId} organizationId={organizationId} brandName={brandName} onCancel={() => setCreating(false)} onCreated={(created, rows) => {
      setUsers(current => [...current.filter(u => u.id !== created.id), { ...created, profileActive: created.active, profileRole: created.role }])
      setPermissions(current => [...current.filter(p => p.user_id !== created.id), ...CRM_MODULES.map(([module]) => ({ organization_id: organizationId, user_id: created.id, module, ...rows[module] }))])
      setSelectedUser(created.id); setCreating(false); setMessage('Usuario creado con su empresa y permisos. Ya puede iniciar sesión con su correo y contraseña.')
    }} />}
    <p style={{color:'#526578'}}>Los permisos de edición siguen sujetos al rol del usuario. Las cuentas demo siempre son de lectura. Para elegir clientes o contactos en otras secciones, habilita también su consulta.</p>
    {busy ? <p>Cargando usuarios…</p> : <form onSubmit={save} style={{background:'white',padding:24,borderRadius:16,border:'1px solid #dce6ec'}}>
      <fieldset disabled={working || creating} style={{border:0,padding:0,margin:0}}>
        <label className="permission-select-field permission-user-field">Usuario <select value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setMessage('') }} >{users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.id} · {u.role}{!u.active ? ' · Inactivo' : ''}</option>)}</select></label>
        {user && <section style={{padding:20,marginBottom:24,borderRadius:12,background:'#f3f7fa',border:'1px solid #dce6ec'}}>
          <h2 style={{marginTop:0}}>Acceso del usuario</h2>
          <p>Estado en esta empresa: <strong>{user.active ? 'Activo' : 'Inactivo'}</strong></p>
          {!user.profileActive && <p>Su perfil está desactivado globalmente.</p>}
          <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}>
            <label className="permission-select-field">Rol<select aria-label="Rol del usuario seleccionado" value={draftRole} disabled={protectedUser} onChange={e => setDraftRole(e.target.value)}><option value="agent">Agente</option><option value="admin">Administrador</option><option value="demo">Demo · solo consulta</option></select></label>
            <button type="button" className="primary-action" disabled={protectedUser || !user.profileActive || draftRole === user.role} onClick={() => manageUser(draftRole, user.active)}>{managing ? 'Actualizando…' : 'Guardar rol'}</button>
            <button type="button" disabled={protectedUser || !user.profileActive} onClick={() => manageUser(user.role, !user.active)} style={{padding:'12px 18px',borderRadius:10,border:'1px solid #dce6ec',background:user.active ? '#fff1f0' : '#e5f7ee',color:user.active ? '#a92323' : '#176b43',cursor:'pointer'}}>{user.active ? 'Desactivar usuario' : 'Reactivar usuario'}</button>
          </div>
          {protectedUser && <p>La cuenta principal y tu propia cuenta están protegidas.</p>}
          <p style={{marginBottom:0}}>La desactivación afecta a esta empresa y conserva los registros. Si el usuario pertenece a varias empresas, el cambio de rol se bloqueará para proteger los demás accesos.</p>
        </section>}
        <fieldset disabled={!user?.active || !user?.profileActive} style={{border:0,padding:0,margin:0}}>
        {!users.length ? <p>No hay usuarios registrados en esta empresa.</p> : <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{textAlign:'left',padding:12}}>Sección</th><th>Puede ver</th><th>Puede editar</th></tr></thead><tbody>{CRM_MODULES.map(([module,label]) => { const row = permission(module); const editable = user?.role !== 'demo' && !['dashboard','reports'].includes(module); return <tr key={module} style={{borderTop:'1px solid #e2e8f0'}}><td style={{padding:12}}>{label}</td><td style={{textAlign:'center'}}><input type="checkbox" aria-label={`Ver ${label}`} checked={row.can_view} onChange={e => change(module,'can_view',e.target.checked)} /></td><td style={{textAlign:'center'}}>{editable ? <input type="checkbox" aria-label={`Editar ${label}`} checked={row.can_edit} onChange={e => change(module,'can_edit',e.target.checked)} /> : <span>Solo consulta</span>}</td></tr> })}</tbody></table></div>}
        </fieldset>
      </fieldset>
      <button className="primary-action" disabled={working || creating || !user?.active || !user?.profileActive} style={{marginTop:20}} type="submit">{saving ? 'Guardando…' : 'Guardar permisos'}</button>
    </form>}
    {message && <p role="status" style={{marginTop:16}}>{message}</p>}
  </div>
}

export default App

function ReportBars({ title, description, rows }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return <div className="dashboard-card"><div className="card-heading"><div><h2>{title}</h2><p>{description}</p></div></div>{rows.map(row => <div className="report-bars-row" key={row.label}><div className="report-bars-caption"><span>{row.label}</span><strong>{row.value} · {total ? Math.round(row.value / total * 100) : 0}%</strong></div><div className="report-bars-track" aria-hidden="true"><div className="report-bars-fill" style={{ width: `${total ? row.value / total * 100 : 0}%`, background: row.color }} /></div></div>)}{!total && <p style={{ color: '#64748b', fontSize: 13 }}>No hay registros en este periodo.</p>}</div>
}

// PDF autónomo: tablas con salto de línea, páginas y fuente estándar con acentos.
function saveReportPDF({ title, company, period, headers, rows }) {
  const byteText = value => String(value ?? '').normalize('NFC').replace(/[\u2010-\u2015]/g, '-').replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?')
  const literal = value => byteText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const wrap = (value, limit) => {
    const lines = []
    for (const paragraph of byteText(value).split(/\r?\n/)) {
      let line = ''
      for (let word of paragraph.split(/\s+/)) {
        if (line && line.length + word.length + 1 > limit) { lines.push(line); line = '' }
        while (word.length > limit) { if (line) { lines.push(line); line = '' }; lines.push(word.slice(0, limit)); word = word.slice(limit) }
        line = line ? line + ' ' + word : word
      }
      lines.push(line)
    }
    return lines.length ? lines : ['']
  }
  const width = 778 / headers.length, limit = Math.max(8, Math.floor((width - 10) / 4.2))
  const pages = []
  let commands = [], y = 0
  const text = (value, x, top, size = 8) => commands.push(`BT /F1 ${size} Tf 0.12 0.18 0.25 rg 1 0 0 1 ${x} ${top} Tm (${literal(value)}) Tj ET`)
  const line = top => commands.push(`0.82 0.86 0.9 RG 0.5 w 32 ${top} m 810 ${top} l S`)
  const headerLines = headers.map(h => wrap(h, limit))
  const headerHeight = Math.max(...headerLines.map(h => h.length)) * 10 + 12
  const start = () => {
    commands = []
    text(`${company} - ${title}`, 32, 559, 15)
    text(`Periodo: ${period}`, 32, 538, 10)
    text(`Registros: ${rows.length} | Generado: ${new Date().toLocaleString('es-ES')}`, 32, 520, 8)
    y = 500
    commands.push(`0.92 0.95 0.98 rg 32 ${y - headerHeight} 778 ${headerHeight} re f`)
    headerLines.forEach((cell, i) => cell.forEach((v, j) => text(v, 37 + i * width, y - 12 - j * 10)))
    y -= headerHeight; line(y)
  }
  const finish = () => { text(`Pagina ${pages.length + 1}`, 740, 20, 8); pages.push(commands.join('\n')) }
  start()
  if (!rows.length) text('No hay registros en este periodo.', 32, y - 22, 10)
  rows.forEach(row => {
    const cells = headers.map((_, i) => wrap(row[i], limit))
    const count = Math.max(...cells.map(c => c.length))
    let offset = 0
    while (offset < count) {
      if (y - 22 < 40) { finish(); start() }
      const take = Math.min(count - offset, Math.floor((y - 40 - 12) / 10))
      cells.forEach((cell, i) => cell.slice(offset, offset + take).forEach((v, j) => text(v, 37 + i * width, y - 12 - j * 10)))
      y -= take * 10 + 12; line(y); offset += take
      if (offset < count) { finish(); start() }
    }
  })
  finish()
  const objects = [null, '', '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']
  const kids = []
  pages.forEach(content => {
    const pageId = objects.length, streamId = pageId + 1
    kids.push(`${pageId} 0 R`)
    objects.push(`<< /Type /Page /Parent 3 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents ${streamId} 0 R >>`)
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })
  // IDs: catálogo 2, árbol de páginas 3, fuente 4.
  objects[2] = '<< /Type /Catalog /Pages 3 0 R >>'
  objects[3] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`
  objects[1] = '<< /Producer (Globaltec CRM) >>'
  let pdf = '%PDF-1.4\n', offsets = [0]
  for (let i = 1; i < objects.length; i++) { offsets.push(pdf.length); pdf += `${i} 0 obj\n${objects[i]}\nendobj\n` }
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n` + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length} /Root 2 0 R /Info 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  const bytes = Uint8Array.from(pdf, char => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${company}-${title}-${new Date().toISOString().slice(0, 10)}.pdf`.replace(/[<>:"/\\|?*]/g, '-')
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function LeadSourceSettings({ organizationId, onChanged }) {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const pending = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    load()
    return () => { alive.current = false }
  }, [organizationId])
  async function load() {
    try {
      const result = await supabase.from('lead_sources').select('*').eq('organization_id', organizationId).order('name')
      if (result.error) throw result.error
      if (alive.current) setSources(result.data || [])
    } catch (err) { if (alive.current) setError('No se han podido cargar los orígenes: ' + err.message) }
    finally { if (alive.current) setLoading(false) }
  }
  const normalize = name => name.trim().toLocaleLowerCase('es-ES')
  async function mutate(action, success) {
    if (pending.current) return
    pending.current = true; setWorking(true); setError(''); setMessage('')
    try {
      const result = await action()
      if (result.error) throw result.error
      if (!result.data?.length) throw new Error('No se ha confirmado el cambio. Comprueba los permisos de esta empresa.')
      if (!alive.current) return
      setSources(current => {
        const ids = new Set(result.data.map(row => row.id))
        return [...current.filter(row => !ids.has(row.id)), ...result.data].sort((a,b) => a.name.localeCompare(b.name, 'es'))
      })
      setDraft(null); setMessage(success)
      await onChanged?.()
    } catch (err) { if (alive.current) setError(err.message || 'No se ha podido guardar.') }
    finally { pending.current = false; if (alive.current) setWorking(false) }
  }
  function save(e) {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) { setError('Escribe el nombre del origen.'); return }
    if (sources.some(row => row.id !== draft.id && normalize(row.name) === normalize(name))) { setError('Ya existe un origen con ese nombre en esta empresa. Puedes reactivarlo si está inactivo.'); return }
    const values = { name, description: draft.description.trim() || null }
    mutate(() => draft.id
      ? supabase.from('lead_sources').update(values).eq('organization_id', organizationId).eq('id', draft.id).select('*')
      : supabase.from('lead_sources').insert({ ...values, organization_id: organizationId, active: true }).select('*'), 'Origen guardado.')
  }
  function addDefaults() {
    const names = ['Web', 'Instagram', 'Facebook', 'TikTok', 'YouTube', 'Llamada', 'Recomendación']
    const missing = names.filter(name => !sources.some(row => normalize(row.name) === normalize(name)))
    if (!missing.length) { setMessage('Los orígenes habituales ya están añadidos.'); return }
    mutate(() => supabase.from('lead_sources').insert(missing.map(name => ({ name, organization_id: organizationId, active: true }))).select('*'), 'Orígenes habituales añadidos.')
  }
  return <section className="dashboard-card lead-source-settings" style={{marginTop:24}}>
    <div className="card-heading"><div><h2>Orígenes de oportunidades</h2><p>Configura de dónde llegan los contactos de esta empresa.</p></div></div>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:18}}>
      <button type="button" className="primary-action" disabled={loading || working || !!error && !sources.length} onClick={() => { setDraft({name:'',description:''}); setError(''); setMessage('') }}>+ Nuevo origen</button>
      <button type="button" className="source-button" disabled={loading || working || !!error && !sources.length} onClick={addDefaults}>Añadir orígenes habituales</button>
      <button type="button" className="source-button" disabled={loading || working} onClick={() => {setLoading(true);setError('');load()}}>Actualizar listado</button>
    </div>
    {draft && <form onSubmit={save} style={{padding:18,background:'#f3f7fa',borderRadius:12,marginBottom:18}}>
      <fieldset disabled={working} style={{border:0,padding:0,margin:0}}>
        <div className="form-grid"><label className="form-field">Nombre<input required maxLength={150} value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})} /></label><label className="form-field">Descripción (opcional)<input maxLength={500} value={draft.description} onChange={e => setDraft({...draft,description:e.target.value})} /></label></div>
        <div style={{display:'flex',gap:12,marginTop:16}}><button type="submit" className="primary-action">{working ? 'Guardando…' : 'Guardar origen'}</button><button type="button" className="source-button" onClick={() => {setDraft(null);setError('')}}>Cancelar</button></div>
      </fieldset>
    </form>}
    {loading ? <p>Cargando orígenes…</p> : <div style={{display:'grid',gap:10}}>{sources.map(source => <div key={source.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',padding:14,border:'1px solid #dce6ec',borderRadius:10}}>
      <div><strong>{source.name}</strong><small style={{display:'block',marginTop:5}}>{source.active ? 'Activo' : 'Inactivo'}{source.description ? ` · ${source.description}` : ''}</small></div>
      <div style={{display:'flex',gap:8}}><button type="button" className="source-button" disabled={working} onClick={() => {setDraft({...source,description:source.description || ''});setError('');setMessage('')}}>Editar</button><button type="button" className="source-button" disabled={working} onClick={() => mutate(() => supabase.from('lead_sources').update({active:!source.active}).eq('organization_id',organizationId).eq('id',source.id).select('*'), source.active ? 'Origen desactivado. Las oportunidades anteriores lo conservan.' : 'Origen reactivado.')}>{source.active ? 'Desactivar' : 'Reactivar'}</button></div>
    </div>)}{!sources.length && <p>Todavía no hay orígenes. Añade los habituales o crea los tuyos.</p>}</div>}
    {error && <p role="alert" style={{color:'#b42318'}}>{error}</p>}{message && <p role="status">{message}</p>}
    <p style={{color:'#64748b',fontSize:13}}>Los orígenes desactivados se conservan en los registros existentes y dejan de ofrecerse en nuevas oportunidades.</p>
  </section>
}

function ServiceSettings({ organizationId, onChanged }) {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const pending = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    load()
    return () => { alive.current = false }
  }, [organizationId])
  async function load() {
    try {
      const result = await supabase.from('services').select('*').eq('organization_id', organizationId).order('name')
      if (result.error) throw result.error
      if (alive.current) setSources(result.data || [])
    } catch (err) { if (alive.current) setError('No se han podido cargar los servicios: ' + err.message) }
    finally { if (alive.current) setLoading(false) }
  }
  const normalize = name => name.trim().toLocaleLowerCase('es-ES')
  async function mutate(action, success) {
    if (pending.current) return
    pending.current = true; setWorking(true); setError(''); setMessage('')
    try {
      const result = await action()
      if (result.error) throw result.error
      if (!result.data?.length) throw new Error('No se ha confirmado el cambio. Comprueba los permisos de esta empresa.')
      if (!alive.current) return
      setSources(current => {
        const ids = new Set(result.data.map(row => row.id))
        return [...current.filter(row => !ids.has(row.id)), ...result.data].sort((a,b) => a.name.localeCompare(b.name, 'es'))
      })
      setDraft(null); setMessage(success)
      await onChanged?.()
    } catch (err) { if (alive.current) setError(err.message || 'No se ha podido guardar.') }
    finally { pending.current = false; if (alive.current) setWorking(false) }
  }
  function save(e) {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) { setError('Escribe el nombre del servicio.'); return }
    if (sources.some(row => row.id !== draft.id && normalize(row.name) === normalize(name))) { setError('Ya existe un servicio con ese nombre en esta empresa. Puedes reactivarlo si está inactivo.'); return }
    const values = { name, description: draft.description.trim() || null }
    mutate(() => draft.id
      ? supabase.from('services').update(values).eq('organization_id', organizationId).eq('id', draft.id).select('*')
      : supabase.from('services').insert({ ...values, organization_id: organizationId, active: true }).select('*'), 'Servicio guardado.')
  }
  return <section className="dashboard-card lead-source-settings" style={{marginTop:24}}>
    <div className="card-heading"><div><h2>Servicios de la empresa</h2><p>Añade los servicios que puedes ofrecer en las oportunidades de esta empresa.</p></div></div>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:18}}>
      <button type="button" className="primary-action" disabled={loading || working || !!error && !sources.length} onClick={() => { setDraft({name:'',description:''}); setError(''); setMessage('') }}>+ Nuevo servicio</button>
      <button type="button" className="source-button" disabled={loading || working} onClick={() => {setLoading(true);setError('');load()}}>Actualizar listado</button>
    </div>
    {draft && <form onSubmit={save} style={{padding:18,background:'#f3f7fa',borderRadius:12,marginBottom:18}}>
      <fieldset disabled={working} style={{border:0,padding:0,margin:0}}>
        <div className="form-grid"><label className="form-field">Nombre<input required maxLength={150} value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})} /></label><label className="form-field">Descripción (opcional)<input maxLength={500} value={draft.description} onChange={e => setDraft({...draft,description:e.target.value})} /></label></div>
        <div style={{display:'flex',gap:12,marginTop:16}}><button type="submit" className="primary-action">{working ? 'Guardando…' : 'Guardar servicio'}</button><button type="button" className="source-button" onClick={() => {setDraft(null);setError('')}}>Cancelar</button></div>
      </fieldset>
    </form>}
    {loading ? <p>Cargando servicios…</p> : <div style={{display:'grid',gap:10}}>{sources.map(source => <div key={source.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',padding:14,border:'1px solid #dce6ec',borderRadius:10}}>
      <div><strong>{source.name}</strong><small style={{display:'block',marginTop:5}}>{source.active ? 'Activo' : 'Inactivo'}{source.description ? ` · ${source.description}` : ''}</small></div>
      <div style={{display:'flex',gap:8}}><button type="button" className="source-button" disabled={working} onClick={() => {setDraft({...source,description:source.description || ''});setError('');setMessage('')}}>Editar</button><button type="button" className="source-button" disabled={working} onClick={() => mutate(() => supabase.from('services').update({active:!source.active}).eq('organization_id',organizationId).eq('id',source.id).select('*'), source.active ? 'Servicio desactivado. Las oportunidades anteriores lo conservan.' : 'Servicio reactivado.')}>{source.active ? 'Desactivar' : 'Reactivar'}</button></div>
    </div>)}{!sources.length && <p>Todavía no hay servicios. Crea el primero con «Nuevo servicio».</p>}</div>}
    {error && <p role="alert" style={{color:'#b42318'}}>{error}</p>}{message && <p role="status">{message}</p>}
    <p style={{color:'#64748b',fontSize:13}}>Los servicios desactivados se conservan en los registros existentes y dejan de ofrecerse en nuevas oportunidades.</p>
  </section>
}
