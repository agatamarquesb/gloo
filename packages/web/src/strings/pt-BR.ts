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
    // English like its two neighbours: these three are the page names, and a
    // sidebar reading "Dashboard / Tasks / Calendário" reads as an oversight.
    // Everything *inside* the page is PT-BR, as everywhere else.
    calendar: 'Calendar',
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
    projectsEmpty: 'Nenhum projeto por aqui',
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
    /**
     * The task modal's way in: an icon with no words, so the hint lives on the
     * cursor. Phrased as the thing it produces rather than as "Etiquetas",
     * because the same button also creates one.
     */
    add: 'Nova etiqueta',
    /** On the button itself while a task has none, where a glyph said nothing. */
    one: 'Etiqueta',
    search: 'Buscar etiquetas...',
    create: 'Criar uma nova etiqueta',
    createHeading: 'Criar etiqueta',
    editHeading: 'Editar etiqueta',
    nameLabel: 'Título',
    namePlaceholder: 'Nome da etiqueta',
    colorLabel: 'Selecionar uma cor',
    edit: 'Editar etiqueta',
    /** Named in full: at "Excluir" it read as "discard the changes". */
    remove: 'Excluir etiqueta',
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
    bySector: 'Tarefas por setor',
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
    title: 'Timer',
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
  calendar: {
    today: 'Hoje',
    searchPlaceholder: 'Buscar evento',
    // Named for what they move rather than just "anterior"/"próximo": the mini
    // calendar's own month arrows carry those, and two controls sharing an
    // accessible name is exactly what a screen reader cannot disambiguate.
    previous: 'Período anterior',
    next: 'Próximo período',
    newEvent: 'Novo evento',
    /** Tail of "+2 mais" in a crowded month cell. */
    more: 'mais',
    /** Gutter label for the strip of all-day events above the grid. */
    allDay: 'Dia todo',
    view: {
      DAY: 'Dia',
      WEEK: 'Semana',
      MONTH: 'Mês',
    },
    details: {
      title: 'Detalhes',
      empty: 'Selecione um evento para ver os detalhes.',
      category: 'Agenda',
      date: 'Data',
      time: 'Horário',
      location: 'Local',
      team: 'Time',
      repeats: 'Repete',
    },
    agendas: {
      title: 'Agendas',
      glooAccount: 'Gloo',
      shared: 'Compartilhados comigo',
      sharedHint: 'Eventos em que você foi incluído. Somente leitura.',
      newAgenda: 'Nova agenda',
      addAccount: 'Adicionar conta de calendário',
      rename: 'Renomear',
      manageAccount: 'Gerenciar conta de calendário',
      disconnect: 'Desconectar conta',
      reconnect: 'Reconectar',
      reauthNeeded: 'O acesso a esta conta expirou.',
      color: 'Cor',
      makeDefault: 'Tornar agenda padrão',
      isDefault: 'Padrão',
      showOnlyThis: 'Mostrar apenas esta',
      show: 'Mostrar agenda',
      hide: 'Ocultar agenda',
      remove: 'Remover agenda da lista',
      readOnly: 'Somente leitura',
    },
    removeAgenda: {
      // The tail of "12 eventos serão movidos para X". Two forms because PT-BR
      // agrees the verb with the count, and the agenda name is a separate
      // element so it can be emphasised — which is what stops this being one
      // interpolated string.
      movingOne: 'evento será movido para',
      movingMany: 'eventos serão movidos para',
      googleNote:
        'A agenda sai da lista do Gloo. Nada é alterado no Google Agenda — você pode adicioná-la de volta nas configurações da sua conta.',
      hideHint: 'Para ocultar temporariamente, use o ícone de olho ao lado da agenda.',
      confirm: 'Remover agenda',
    },
    recurrence: {
      none: 'Não se repete',
      DAILY: 'Diariamente',
      WEEKLY: 'Semanalmente',
      BIWEEKLY: 'Quinzenalmente',
      MONTHLY: 'Mensalmente',
      until: 'Repetir até',
      noEnd: 'Sem data final',
      onDays: 'Nos dias',
      // Single letters under the weekday toggles, Sunday first like the grid.
      weekdayInitials: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
      weekdayNames: [
        'domingo',
        'segunda-feira',
        'terça-feira',
        'quarta-feira',
        'quinta-feira',
        'sexta-feira',
        'sábado',
      ],
    },
    scope: {
      this: 'Apenas este evento',
      all: 'Todos os eventos da série',
    },
    confirmChange: {
      edit: {
        title: 'Salvar alteração',
        question: 'Esta alteração vale para qual ocorrência?',
        notifyLabel: 'Avisar participantes por e-mail',
        confirm: 'Salvar',
      },
      delete: {
        title: 'Excluir evento',
        question: 'Excluir qual ocorrência?',
        notifyLabel: 'Avisar participantes do cancelamento',
        confirm: 'Excluir',
      },
      // Tail of "3 pessoas serão avisadas" — the count sits in front of it.
      oneAttendee: '1 pessoa será avisada.',
      manyAttendees: 'pessoas serão avisadas.',
    },
    event: {
      titleLabel: 'Título',
      titlePlaceholder: 'Nome do evento',
      agenda: 'Agenda',
      date: 'Data',
      startsAt: 'Início',
      endsAt: 'Fim',
      allDay: 'Dia inteiro',
      location: 'Local',
      locationPlaceholder: 'Link da reunião ou endereço',
      team: 'Time',
      description: 'Descrição',
      untitled: 'Sem título',
      endBeforeStart: 'O fim precisa ser depois do início.',
    },
    google: {
      linking: 'Conectando ao Google...',
      linked: 'Conta do Google conectada.',
      linkFailed: 'Não foi possível conectar a conta do Google.',
      scopeDenied: 'Algumas permissões não foram concedidas. Conecte novamente e aceite todas.',
      syncNow: 'Sincronizar agora',
      syncing: 'Sincronizando...',
      lastSynced: 'Sincronizado',
    },
  },
  /** The colour picker, wherever it opens — a label's, an agenda's. */
  color: {
    /** The ten the app ships with. */
    palette: 'Cores',
    /** And the ones this browser has mixed, under a rule of their own. */
    custom: 'Cores personalizadas',
    add: 'Nova cor',
    hex: 'Hexadecimal',
    hue: 'Matiz',
  },
  common: {
    save: 'Salvar',
    add: 'Adicionar',
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
