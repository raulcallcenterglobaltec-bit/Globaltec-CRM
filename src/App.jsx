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

export default App
