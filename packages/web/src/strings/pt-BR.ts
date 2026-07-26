/**
 * Central PT-BR copy. "Tasks" and "Dashboard" stay in English per spec;
 * everything else is translated here — components should never inline
 * literal copy, always reference this file.
 */
export const strings = {
  appName: 'Gloo',
  nav: {
    dashboard: 'Dashboard',
    tasks: 'Tasks',
    signOut: 'Sair',
  },
  auth: {
    email: 'E-mail',
    password: 'Senha',
    login: 'Entrar',
    invalidCredentials: 'E-mail ou senha inválidos',
    genericError: 'Não foi possível entrar. Tente novamente.',
  },
  task: {
    priority: {
      HIGH: 'Alta',
      MEDIUM: 'Média',
      LOW: 'Baixa',
    },
    status: {
      TODO: 'To Do',
      IN_PROGRESS: 'Em Progresso',
      IN_REVIEW: 'Em Review',
      DONE: 'Concluído',
    },
    filters: {
      all: 'Todas',
      overdue: 'Atrasada',
    },
    fields: {
      title: 'Título',
      description: 'Descrição',
      dueDate: 'Data de vencimento',
      sector: 'Setor',
      assignees: 'Responsáveis',
      progress: 'Progresso',
      subtasks: 'Subtarefas',
    },
    addTask: 'Adicionar tarefa',
    copyLink: 'Copiar link',
  },
  routine: {
    recurrence: {
      WEEKLY: 'Semanal',
      MONTHLY: 'Mensal',
    },
    addRoutine: 'Adicionar rotina',
    title: 'Rotinas',
    recurrenceLabel: 'Recorrência',
    weekdayLabel: 'Dia da semana',
    dayOfMonthLabel: 'Dia do mês',
    assigneeLabel: 'Responsável',
    empty: 'Nenhuma rotina por aqui.',
  },
  dashboard: {
    taskSummary: 'Resumo de tarefas',
    taskSummarySubtitle: 'Acompanhe o andamento das suas tarefas',
    myTasks: 'Minhas tarefas',
    openBySector: 'Tarefas abertas por setor',
    calendar: 'Calendário',
    summary: {
      upcoming: 'A fazer',
      inProgress: 'Em progresso',
      completed: 'Concluídas',
      overdue: 'Atrasadas',
    },
    noTasks: 'Nenhuma tarefa por aqui.',
    tasksSuffix: 'tarefas',
  },
  profile: {
    title: 'Meu perfil',
    changePhoto: 'Alterar foto',
    uploading: 'Enviando...',
    uploadError: 'Não foi possível enviar a imagem.',
    hint: 'PNG, JPEG ou WebP, até 2MB.',
  },
  timeBlocking: {
    title: 'Time blocking',
    subtitle: 'Escolha um bloco de foco',
    custom: 'Personalizado',
    customPrompt: 'Minutos:',
    start: 'Iniciar',
    pause: 'Pausar',
    reset: 'Zerar',
  },
  theme: {
    light: 'Modo claro',
    dark: 'Modo escuro',
  },
  common: {
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    search: 'Buscar',
    sortBy: 'Ordenar por',
    filterBy: 'Filtrar por',
    loading: 'Carregando...',
  },
} as const;
