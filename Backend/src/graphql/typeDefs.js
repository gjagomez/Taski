export const typeDefs = `#graphql
  enum Status { BACKLOG IN_PROGRESS REVIEW DONE }
  enum Priority { HIGH MEDIUM LOW }
  enum TaskType { TASK BUG }
  enum SubtaskStatus { PENDING DONE }

  type User {
    id: ID!
    name: String!
    email: String!
    role: UserRole!
    "Permisos del rol del usuario (claves de permissions.js)"
    permissions: [String!]!
    active: Boolean!
    avatarColor: String!
    createdAt: String!
  }

  type AuthPayload { token: String!, user: User! }
  "Código enviado por correo (recuperación o registro). devCode solo en desarrollo, si el correo no salió."
  type ResetRequest { message: String!, devCode: String }
  "Resultado de un envío de correo. simulated = Mailjet sin configurar (se guardó en Backend/outbox/)."
  type EmailResult { sent: Boolean!, simulated: Boolean!, to: String!, detail: String! }

  type Stats {
    total: Int!
    backlog: Int!
    inProgress: Int!
    review: Int!
    done: Int!
    overdue: Int!
    bugs: Int!
    completionRate: Int!
  }

  type Project {
    id: ID!
    name: String!
    description: String
    color: String!
    createdAt: String!
    createdBy: User
    boards: [Board!]!
    members: [User!]!
    stats: Stats!
  }

  type Board {
    id: ID!
    name: String!
    description: String
    createdAt: String!
    project: Project!
    columns: [Column!]!
    members: [User!]!
    tasks: [Task!]!
    stats: Stats!
  }

  type Column {
    id: ID!
    name: String!
    status: Status!
    position: Int!
    color: String!
    tasks: [Task!]!
  }

  type Task {
    id: ID!
    title: String!
    description: String
    type: TaskType!
    priority: Priority!
    labels: [String!]!
    acceptanceCriteria: String
    status: Status!
    position: Int!
    board: Board!
    assignee: User
    createdBy: User!
    startDate: String
    dueDate: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
    isOverdue: Boolean!
    progress: Int!
    subtaskCount: Int!
    subtaskDone: Int!
    commentCount: Int!
    subtasks: [Subtask!]!
    comments: [Comment!]!
    activity: [Activity!]!
    allowedTransitions: [Status!]!
  }

  type Subtask {
    id: ID!
    title: String!
    status: SubtaskStatus!
    createdAt: String!
    checklist: [ChecklistItem!]!
  }

  type ChecklistItem { id: ID!, text: String!, done: Boolean! }

  type Comment { id: ID!, body: String!, user: User!, createdAt: String! }

  type Activity {
    id: ID!
    action: String!
    detail: String
    user: User!
    task: Task
    createdAt: String!
  }

  type Dashboard {
    stats: Stats!
    projects: [Project!]!
    myTasks: [Task!]!
    upcomingTasks: [Task!]!
    overdueTasks: [Task!]!
    recentActivity: [Activity!]!
  }

  input ProjectInput { name: String!, description: String, color: String }
  input BoardInput { projectId: ID!, name: String!, description: String, memberIds: [ID!] }

  input TaskInput {
    boardId: ID!
    title: String!
    description: String
    type: TaskType
    priority: Priority
    labels: [String!]
    acceptanceCriteria: String
    assigneeId: ID
    startDate: String
    dueDate: String
  }

  input TaskUpdateInput {
    title: String
    description: String
    type: TaskType
    priority: Priority
    labels: [String!]
    acceptanceCriteria: String
    assigneeId: ID
    startDate: String
    dueDate: String
  }

  type Query {
    me: User
    users: [User!]!
    dashboard: Dashboard!
    projects: [Project!]!
    project(id: ID!): Project
    board(id: ID!): Board
    task(id: ID!): Task
    myTasks: [Task!]!
    activity(limit: Int): [Activity!]!
  }

  type Mutation {
    "Paso 1 del registro: envía un código al correo. La cuenta se crea en confirmRegistration."
    register(name: String!, email: String!, password: String!): ResetRequest!
    confirmRegistration(email: String!, code: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    requestPasswordReset(email: String!): ResetRequest!
    resetPassword(email: String!, code: String!, newPassword: String!): Boolean!

    createUser(name: String!, email: String!, password: String!, roleId: ID!): User!
    updateUserRole(id: ID!, roleId: ID!): User!
    setUserActive(id: ID!, active: Boolean!): User!
    "Invitación por correo con los tableros del usuario. temporaryPassword solo se incluye si coincide con la actual."
    sendInvitation(userId: ID!, message: String, temporaryPassword: String): EmailResult!

    createProject(input: ProjectInput!): Project!
    updateProject(id: ID!, input: ProjectInput!): Project!
    deleteProject(id: ID!): Boolean!

    createBoard(input: BoardInput!): Board!
    updateBoard(id: ID!, name: String!, description: String): Board!
    deleteBoard(id: ID!): Boolean!
    setBoardMembers(boardId: ID!, userIds: [ID!]!): Board!

    createTask(input: TaskInput!): Task!
    updateTask(id: ID!, input: TaskUpdateInput!): Task!
    moveTask(id: ID!, status: Status!, position: Int, reason: String): Task!
    deleteTask(id: ID!): Boolean!

    addSubtask(taskId: ID!, title: String!): Subtask!
    updateSubtask(id: ID!, title: String, status: SubtaskStatus): Subtask!
    deleteSubtask(id: ID!): Boolean!
    addChecklistItem(subtaskId: ID!, text: String!): ChecklistItem!
    toggleChecklistItem(id: ID!): Subtask!
    deleteChecklistItem(id: ID!): Boolean!

    addComment(taskId: ID!, body: String!): Comment!
  }
`;
