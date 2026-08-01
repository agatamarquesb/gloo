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
      TODO: 'A fazer',
      IN_PROGRESS: 'Em andamento',
      DONE: 'Feita',
      OVERDUE: 'Atrasada',
    },
    filters: {
      all: 'Todas',
      overdue: 'Atrasada',
      /**
       * Plural, unlike the status itself: the pill filters a list of tasks
       * ("show me the done ones"), while the chip labels one task.
       */
      done: 'Feitas',
    },
    fields: {
      title: 'Título',
      description: 'Descrição',
      status: 'Status',
      dueDate: 'Data de vencimento',
      /** The modal's name for the same date: what the task is due by. */
      deadline: 'Deadline',
      priority: 'Prioridade',
      sector: 'Setor',
      project: 'Projeto',
      assignees: 'Responsáveis',
      /** Singular in the modal's property list, as on a routine. */
      assignee: 'Responsável',
      progress: 'Progresso',
      subtasks: 'Subtarefas',
    },
    addTask: 'Adicionar tarefa',
    copyLink: 'Copiar link',
    deleteTask: 'Deletar',
    hasSubtasks: 'Tem subtarefas',
    noSubtasks: 'Sem subtarefas',
    attachmentCount: 'Anexos',
    /** Replaces "Editar" in the modal header while the dialog is unlocked. */
    editing: 'Editando',
    lastUpdated: 'Última alteração',
    notesTitle: 'Visão geral',
    /**
     * Phrased as an empty state rather than as an instruction, and set at the
     * same size as "Nenhum anexo por aqui": the two blocks sit side by side in
     * the modal and an empty one should read the same way on both sides.
     */
    notesPlaceholder: 'Nenhuma anotação por aqui :(',
    subtasksTitle: 'Subtarefas',
    addSubtask: 'Adicionar subtarefa',
    subtaskPlaceholder: 'Subtarefa',
    removeSubtask: 'Remover subtarefa',
    /**
     * Projects have no page of their own yet, so the picker opens on this and
     * nothing else — the row exists, and says plainly that there is nothing to
     * choose from rather than opening an empty list.
     */
    projectsEmpty: 'Nenhum projeto criado ainda.',
    noAssignees: 'Ninguém',
  },
  routine: {
    recurrence: {
      WEEKLY: 'Semanal',
      MONTHLY: 'Mensal',
    },
    addRoutine: 'Adicionar rotina',
    copyLink: 'Copiar link',
    deleteRoutine: 'Deletar',
    title: 'Rotinas',
    recurrenceLabel: 'Recorrência',
    weekdayLabel: 'Dia da semana',
    dayOfMonthLabel: 'Dia do mês',
    assigneeLabel: 'Responsável',
    empty: 'Nenhuma rotina por aqui.',
    titleLabel: 'Título',
    notesTitle: 'Notas:',
    notesPlaceholder: 'Notas sobre esta rotina',
    clearNotes: 'Limpar',
    bold: 'Negrito',
    italic: 'Itálico',
    underline: 'Sublinhado',
    strikethrough: 'Traçado',
    checklist: 'Checklist',
    checklistTitlePlaceholder: 'Título da checklist:',
    deleteChecklist: 'Excluir',
    checklistItemPlaceholder: 'Item',
    addChecklistItem: 'Adicionar item',
    removeChecklistItem: 'Remover item',
    labels: 'Etiquetas',
    attachments: 'Anexos',
    lastUpdated: 'Última alteração',
    duplicate: 'Duplicar rotina',
    /** The tag row on a routine, which folds down to bars when clicked. */
    toggleLabels: 'Minimizar etiquetas',
    /** Replaces "Editar" in the header while the dialog is unlocked. */
    editing: 'Editando',
    trash: {
      /** The link in the card's corner that opens the panel. */
      open: 'Lixeira',
      heading: 'Lixeira',
      restore: 'Recuperar',
      empty: 'A lixeira está vazia.',
      emptyTrash: 'Esvaziar lixeira',
      deleteSelected: 'Deletar permanentemente',
      select: 'Selecionar rotina',
      close: 'Voltar',
      deletePermanently: 'Deletar permanente',
      deletedAt: 'Apagada em',
    },
  },
  label: {
    title: 'Etiquetas',
    search: 'Buscar etiquetas...',
    create: 'Criar uma nova etiqueta',
    createHeading: 'Criar etiqueta',
    editHeading: 'Editar etiqueta',
    nameLabel: 'Título',
    namePlaceholder: 'Nome da etiqueta',
    colorLabel: 'Selecionar uma cor',
    edit: 'Editar etiqueta',
    back: 'Voltar',
    empty: 'Nenhuma etiqueta criada.',
  },
  attachment: {
    title: 'Anexos',
    linkPlaceholder: 'Cole um link aqui',
    addLink: 'Adicionar link',
    add: 'Adicionar anexo',
    chooseFile: 'Escolher arquivo',
    uploading: 'Enviando...',
    editHeading: 'Editar anexo',
    titleLabel: 'Título',
    titlePlaceholder: 'Nome que aparece na lista',
    urlLabel: 'Link',
    replaceFile: 'Trocar arquivo',
    edit: 'Editar anexo',
    remove: 'Excluir anexo',
    download: 'Baixar anexo',
    preview: 'Visualizar anexo',
    empty: 'Nenhum anexo por aqui.',
  },
  dashboard: {
    taskSummary: 'Resumo de tarefas',
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
    nameLabel: 'Nome',
    jobTitleLabel: 'Função',
    jobTitlePlaceholder: 'Ex.: Designer',
    changePhoto: 'Alterar foto',
    saving: 'Salvando...',
    saveError: 'Não foi possível salvar as alterações.',
    hint: 'PNG, JPEG ou WebP.',
    cropHint: 'Arraste para posicionar e use o controle abaixo para ampliar.',
    zoom: 'Ampliar',
    applyCrop: 'Aplicar recorte',
  },
  notifications: {
    title: 'Notificações',
    empty: 'Tudo em dia por aqui.',
    open: 'Abrir notificações',
    dismiss: 'Descartar notificação',
    viewTask: 'Ver tarefa',
    viewRoutine: 'Ver rotina',
    /** Days late, as a positive number. */
    overdueByDays: (days: number) => {
      if (days <= 0) return 'Venceu hoje';
      return days === 1 ? 'Atrasada há 1 dia' : `Atrasada há ${days} dias`;
    },
    dueInDays: (days: number) => {
      if (days <= 0) return 'Vence hoje';
      return days === 1 ? 'Vence amanhã' : `Vence em ${days} dias`;
    },
  },
  timeBlocking: {
    title: 'Time blocking',
    customOpen: 'Tempo personalizado',
    customLabel: 'Tempo (hh:mm:ss)',
    customConfirm: 'Confirmar tempo',
    customCancel: 'Cancelar',
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
    close: 'Fechar',
    search: 'Buscar',
    sortBy: 'Ordenar por',
    filterBy: 'Filtrar por',
    loading: 'Carregando...',
  },
} as const;
