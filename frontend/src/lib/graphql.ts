import { gql } from '@apollo/client'

const USER = gql`
  fragment UserFields on User {
    id
    name
    email
    role { id name color }
    permissions
    active
    avatarColor
  }
`

const STATS = gql`
  fragment StatsFields on Stats {
    total
    backlog
    inProgress
    review
    done
    overdue
    bugs
    completionRate
  }
`

const TASK_CARD = gql`
  fragment TaskCard on Task {
    id
    title
    description
    type
    priority
    labels
    acceptanceCriteria
    status
    position
    startDate
    dueDate
    completedAt
    createdAt
    isOverdue
    progress
    subtaskCount
    subtaskDone
    commentCount
    allowedTransitions
    assignee { ...UserFields }
    createdBy { ...UserFields }
  }
  ${USER}
`

// ---------- Auth ----------
export const ME = gql`
  query Me { me { ...UserFields } }
  ${USER}
`

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) { token user { ...UserFields } }
  }
  ${USER}
`

export const REGISTER = gql`
  mutation Register($name: String!, $email: String!, $password: String!) {
    register(name: $name, email: $email, password: $password) { message devCode }
  }
`

export const CONFIRM_REGISTRATION = gql`
  mutation ConfirmRegistration($email: String!, $code: String!) {
    confirmRegistration(email: $email, code: $code) { token user { ...UserFields } }
  }
  ${USER}
`

export const REQUEST_RESET = gql`
  mutation RequestReset($email: String!) {
    requestPasswordReset(email: $email) { message devCode }
  }
`

export const RESET_PASSWORD = gql`
  mutation ResetPassword($email: String!, $code: String!, $newPassword: String!) {
    resetPassword(email: $email, code: $code, newPassword: $newPassword)
  }
`

// ---------- Dashboard ----------
export const DASHBOARD = gql`
  query Dashboard {
    dashboard {
      stats { ...StatsFields }
      projects {
        id
        name
        description
        color
        stats { ...StatsFields }
        members { ...UserFields }
        boards { id name }
      }
      myTasks { ...TaskCard board { id name project { id name color } } }
      upcomingTasks { ...TaskCard board { id name project { id name color } } }
      overdueTasks { ...TaskCard board { id name project { id name color } } }
      recentActivity {
        id
        action
        detail
        createdAt
        user { ...UserFields }
        task { id title board { id name } }
      }
    }
  }
  ${STATS}
  ${TASK_CARD}
`

// ---------- Proyectos / tableros ----------
export const PROJECTS = gql`
  query Projects {
    projects {
      id
      name
      description
      color
      createdAt
      stats { ...StatsFields }
      members { ...UserFields }
      boards { id name description stats { ...StatsFields } members { ...UserFields } }
    }
  }
  ${STATS}
  ${USER}
`

export const PROJECT = gql`
  query Project($id: ID!) {
    project(id: $id) {
      id
      name
      description
      color
      createdAt
      stats { ...StatsFields }
      members { ...UserFields }
      boards { id name description stats { ...StatsFields } members { ...UserFields } }
    }
  }
  ${STATS}
  ${USER}
`

export const CREATE_PROJECT = gql`
  mutation CreateProject($input: ProjectInput!) { createProject(input: $input) { id } }
`
export const UPDATE_PROJECT = gql`
  mutation UpdateProject($id: ID!, $input: ProjectInput!) { updateProject(id: $id, input: $input) { id name description color } }
`
export const DELETE_PROJECT = gql`
  mutation DeleteProject($id: ID!) { deleteProject(id: $id) }
`

export const CREATE_BOARD = gql`
  mutation CreateBoard($input: BoardInput!) { createBoard(input: $input) { id } }
`
export const DELETE_BOARD = gql`
  mutation DeleteBoard($id: ID!) { deleteBoard(id: $id) }
`
export const SET_BOARD_MEMBERS = gql`
  mutation SetBoardMembers($boardId: ID!, $userIds: [ID!]!) {
    setBoardMembers(boardId: $boardId, userIds: $userIds) { id members { ...UserFields } }
  }
  ${USER}
`

export const BOARD = gql`
  query Board($id: ID!) {
    board(id: $id) {
      id
      name
      description
      createdAt
      project { id name color }
      columns { id name status color }
      members { ...UserFields }
      stats { ...StatsFields }
      tasks { ...TaskCard }
    }
  }
  ${STATS}
  ${TASK_CARD}
`

// ---------- Tareas ----------
export const TASK = gql`
  query Task($id: ID!) {
    task(id: $id) {
      ...TaskCard
      board { id name project { id name color } members { ...UserFields } }
      subtasks { id title status checklist { id text done } }
      comments { id body createdAt user { ...UserFields } }
      activity { id action detail createdAt user { ...UserFields } }
    }
  }
  ${TASK_CARD}
`

export const MY_TASKS = gql`
  query MyTasks {
    myTasks { ...TaskCard board { id name project { id name color } } }
  }
  ${TASK_CARD}
`

export const CREATE_TASK = gql`
  mutation CreateTask($input: TaskInput!) { createTask(input: $input) { ...TaskCard } }
  ${TASK_CARD}
`
export const UPDATE_TASK = gql`
  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) { updateTask(id: $id, input: $input) { ...TaskCard } }
  ${TASK_CARD}
`
export const MOVE_TASK = gql`
  mutation MoveTask($id: ID!, $status: Status!, $position: Int, $reason: String) {
    moveTask(id: $id, status: $status, position: $position, reason: $reason) { ...TaskCard }
  }
  ${TASK_CARD}
`
export const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) { deleteTask(id: $id) }
`

export const ADD_SUBTASK = gql`
  mutation AddSubtask($taskId: ID!, $title: String!) { addSubtask(taskId: $taskId, title: $title) { id } }
`
export const UPDATE_SUBTASK = gql`
  mutation UpdateSubtask($id: ID!, $title: String, $status: SubtaskStatus) {
    updateSubtask(id: $id, title: $title, status: $status) { id status }
  }
`
export const DELETE_SUBTASK = gql`
  mutation DeleteSubtask($id: ID!) { deleteSubtask(id: $id) }
`
export const ADD_CHECKLIST_ITEM = gql`
  mutation AddChecklistItem($subtaskId: ID!, $text: String!) { addChecklistItem(subtaskId: $subtaskId, text: $text) { id } }
`
export const TOGGLE_CHECKLIST_ITEM = gql`
  mutation ToggleChecklistItem($id: ID!) { toggleChecklistItem(id: $id) { id status } }
`
export const DELETE_CHECKLIST_ITEM = gql`
  mutation DeleteChecklistItem($id: ID!) { deleteChecklistItem(id: $id) }
`
export const ADD_COMMENT = gql`
  mutation AddComment($taskId: ID!, $body: String!) { addComment(taskId: $taskId, body: $body) { id } }
`

// ---------- Actividad / usuarios ----------
export const ACTIVITY = gql`
  query Activity($limit: Int) {
    activity(limit: $limit) {
      id
      action
      detail
      createdAt
      user { ...UserFields }
      task { id title board { id name } }
    }
  }
  ${USER}
`

export const USERS = gql`
  query Users { users { ...UserFields createdAt } }
  ${USER}
`
export const CREATE_USER = gql`
  mutation CreateUser($name: String!, $email: String!, $password: String!, $roleId: ID!) {
    createUser(name: $name, email: $email, password: $password, roleId: $roleId) { ...UserFields }
  }
  ${USER}
`
export const SEND_INVITATION = gql`
  mutation SendInvitation($userId: ID!, $message: String, $temporaryPassword: String) {
    sendInvitation(userId: $userId, message: $message, temporaryPassword: $temporaryPassword) { sent simulated to detail }
  }
`
export const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($id: ID!, $roleId: ID!) { updateUserRole(id: $id, roleId: $roleId) { ...UserFields } }
  ${USER}
`
// ---------- Roles y permisos ----------
const ROLE = gql`
  fragment RoleFields on UserRole { id name description color system locked permissions userCount }
`
export const ROLES = gql`
  query Roles { roles { ...RoleFields } }
  ${ROLE}
`
export const PERMISSIONS = gql`
  query Permissions { permissions { key label description group } }
`
export const CREATE_ROLE = gql`
  mutation CreateRole($input: RoleInput!) { createRole(input: $input) { ...RoleFields } }
  ${ROLE}
`
export const UPDATE_ROLE = gql`
  mutation UpdateRole($id: ID!, $input: RoleInput!) { updateRole(id: $id, input: $input) { ...RoleFields } }
  ${ROLE}
`
export const DELETE_ROLE = gql`
  mutation DeleteRole($id: ID!) { deleteRole(id: $id) }
`

export const SET_USER_ACTIVE = gql`
  mutation SetUserActive($id: ID!, $active: Boolean!) { setUserActive(id: $id, active: $active) { ...UserFields } }
  ${USER}
`

// ---------- Espacio de trabajo (tableros estilo Monday) ----------
const WS_SUBITEM = gql`
  fragment WsSubitemFields on WsSubitem {
    id
    name
    status
    startDate
    dueDate
    hours
    isOverdue
    completedAt
    allowedStatuses
    kind
    severity
    steps
    reopenCount
    verifiedAt
    parentId
    testId
    evidence { id name mimeType size createdAt uploadedBy { ...UserFields } }
    commentCount
    reportedBy { ...UserFields }
    assignee { ...UserFields }
  }
  ${USER}
`

const WS_ITEM = gql`
  fragment WsItemFields on WsItem {
    id
    name
    requesters
    area
    dueDate
    position
    progress
    totalHours
    subitemCount
    updateCount
    group { id name color }
    qaGroup { id name color }
    devGroup { id name color }
    qa { ...UserFields }
    developer { ...UserFields }
    assignees { ...UserFields }
    subitems { ...WsSubitemFields }
    files { id name mimeType size createdAt uploadedBy { ...UserFields } }
  }
  ${WS_SUBITEM}
`

export const WS_QA_USERS = gql`
  query WsQaUsers { wsQaUsers { ...UserFields } }
  ${USER}
`

export const REJECT_WS_ITEM_QA = gql`
  mutation RejectWsItemQa($id: ID!, $bugs: [WsBugInput!]!) { rejectWsItemQa(id: $id, bugs: $bugs) { id } }
`

export const REPORT_WS_BUG = gql`
  mutation ReportWsBug($testId: ID!, $bugs: [WsBugInput!]!, $returnToDev: Boolean) {
    reportWsBug(testId: $testId, bugs: $bugs, returnToDev: $returnToDev) { id }
  }
`

export const APPROVE_WS_ITEM_QA = gql`
  mutation ApproveWsItemQa($id: ID!) { approveWsItemQa(id: $id) { id } }
`

export const VERIFY_WS_BUG = gql`
  mutation VerifyWsBug($id: ID!, $ok: Boolean!, $comment: String) { verifyWsBug(id: $id, ok: $ok, comment: $comment) { id } }
`

export const WS_SUBITEM_COMMENTS = gql`
  query WsSubitemComments($subitemId: ID!) {
    wsSubitemComments(subitemId: $subitemId) { id kind body createdAt user { ...UserFields } }
  }
  ${USER}
`

export const ADD_WS_SUBITEM_COMMENT = gql`
  mutation AddWsSubitemComment($subitemId: ID!, $body: String!) { addWsSubitemComment(subitemId: $subitemId, body: $body) { id } }
`

export const WS_BOARDS = gql`
  query WsBoards { wsBoards { id name folder itemCount } }
`

export const WS_BOARD = gql`
  query WsBoard($id: ID!) {
    wsBoard(id: $id) {
      id
      name
      folder
      description
      groups { id name color position items { ...WsItemFields } }
    }
  }
  ${WS_ITEM}
`

export const WS_ITEM_DETAIL = gql`
  query WsItemDetail($id: ID!) {
    wsItem(id: $id) {
      ...WsItemFields
      createdAt
      board { id name folder }
      createdBy { ...UserFields }
      updates { id body createdAt user { ...UserFields } }
      activity { id detail createdAt user { ...UserFields } }
    }
  }
  ${WS_ITEM}
`

export const CREATE_WS_BOARD = gql`
  mutation CreateWsBoard($name: String!, $folder: String, $description: String) {
    createWsBoard(name: $name, folder: $folder, description: $description) { id }
  }
`
export const UPDATE_WS_BOARD = gql`
  mutation UpdateWsBoard($id: ID!, $name: String!, $folder: String) {
    updateWsBoard(id: $id, name: $name, folder: $folder) { id name folder }
  }
`
export const DELETE_WS_BOARD = gql`
  mutation DeleteWsBoard($id: ID!) { deleteWsBoard(id: $id) }
`
export const CREATE_WS_GROUP = gql`
  mutation CreateWsGroup($boardId: ID!, $name: String!, $color: String!) {
    createWsGroup(boardId: $boardId, name: $name, color: $color) { id }
  }
`
export const UPDATE_WS_GROUP = gql`
  mutation UpdateWsGroup($id: ID!, $name: String, $color: String) {
    updateWsGroup(id: $id, name: $name, color: $color) { id name color }
  }
`
export const DELETE_WS_GROUP = gql`
  mutation DeleteWsGroup($id: ID!) { deleteWsGroup(id: $id) }
`
export const REORDER_WS_GROUPS = gql`
  mutation ReorderWsGroups($boardId: ID!, $groupIds: [ID!]!) {
    reorderWsGroups(boardId: $boardId, groupIds: $groupIds) { id position }
  }
`
export const CREATE_WS_ITEM = gql`
  mutation CreateWsItem($groupId: ID!, $name: String!) { createWsItem(groupId: $groupId, name: $name) { id } }
`
export const UPDATE_WS_ITEM = gql`
  mutation UpdateWsItem($id: ID!, $input: WsItemInput!) { updateWsItem(id: $id, input: $input) { ...WsItemFields } }
  ${WS_ITEM}
`
export const DELETE_WS_ITEM = gql`
  mutation DeleteWsItem($id: ID!) { deleteWsItem(id: $id) }
`
export const CREATE_WS_SUBITEM = gql`
  mutation CreateWsSubitem($itemId: ID!, $name: String!, $input: WsSubitemInput) {
    createWsSubitem(itemId: $itemId, name: $name, input: $input) { id }
  }
`
export const UPDATE_WS_SUBITEM = gql`
  mutation UpdateWsSubitem($id: ID!, $input: WsSubitemInput!) { updateWsSubitem(id: $id, input: $input) { ...WsSubitemFields } }
  ${WS_SUBITEM}
`
export const DELETE_WS_SUBITEM = gql`
  mutation DeleteWsSubitem($id: ID!) { deleteWsSubitem(id: $id) }
`
export const ADD_WS_UPDATE = gql`
  mutation AddWsUpdate($itemId: ID!, $body: String!, $images: [WsImageInput!]) {
    addWsUpdate(itemId: $itemId, body: $body, images: $images) { id }
  }
`

/** Actualizaciones con sus imágenes: se piden aparte para no cargarlas en el Kanban ni en la tabla. */
export const WS_ITEM_UPDATES = gql`
  query WsItemUpdates($id: ID!) {
    wsItem(id: $id) {
      id
      updates { id body createdAt user { ...UserFields } images { id name mimeType size dataBase64 } }
    }
  }
  ${USER}
`

export const UPLOAD_WS_FILE = gql`
  mutation UploadWsFile($itemId: ID!, $name: String!, $mimeType: String, $dataBase64: String!) {
    uploadWsFile(itemId: $itemId, name: $name, mimeType: $mimeType, dataBase64: $dataBase64) { id }
  }
`
export const DELETE_WS_FILE = gql`
  mutation DeleteWsFile($id: ID!) { deleteWsFile(id: $id) }
`
export const WS_FILE_CONTENT = gql`
  query WsFileContent($id: ID!) { wsFileContent(id: $id) { id name mimeType dataBase64 } }
`

export const WS_DASHBOARD = gql`
  query WsDashboard {
    wsDashboard {
      totals { boards items subitems subitemsDone hoursPlanned hoursDone overdue files completionRate }
      bugs {
        total open toVerify verified reopens reopenRate
        bySeverity { severity count }
        byDeveloper { user { ...UserFields } total open reopens }
      }
      byStage { name color items }
      byStatus { status count hours }
      workload { user { ...UserFields } tasks overdue hoursPending hoursInProgress hoursDone }
      boards { board { id name folder } items subitems subitemsDone hours overdue progress }
      upcoming { ...AgendaFields }
      overdue { ...AgendaFields }
      recentActivity { id detail createdAt itemId itemName boardId user { ...UserFields } }
    }
  }
  fragment AgendaFields on WsAgendaEntry {
    itemId
    itemName
    boardId
    boardName
    subitem { id name status startDate dueDate hours assignee { ...UserFields } }
  }
  ${USER}
`

export const WS_FOLDERS = gql`
  query WsFolders { wsFolders { name boardCount } }
`
export const CREATE_WS_FOLDER = gql`
  mutation CreateWsFolder($name: String!) { createWsFolder(name: $name) { name boardCount } }
`
export const DELETE_WS_FOLDER = gql`
  mutation DeleteWsFolder($name: String!) { deleteWsFolder(name: $name) }
`

// ---------- Asistente IA (LM Studio) ----------
export const AI_STATUS = gql`
  query AiStatus { aiStatus { available model message } }
`
export const AI_SUGGEST_SUBITEMS = gql`
  mutation AiSuggestSubitems($itemId: ID!) { aiSuggestSubitems(itemId: $itemId) { name hours } }
`

export const AI_ANALYZE_FILE = gql`
  mutation AiAnalyzeFile($fileId: ID!) {
    aiAnalyzeFile(fileId: $fileId) { fileName summary truncated pages tasks { name hours priority } }
  }
`

export const AI_CHART = gql`
  mutation AiChart($prompt: String!, $previousSpec: String) {
    aiChart(prompt: $prompt, previousSpec: $previousSpec) {
      title chartType metricLabel xLabel stackLabel filters categories insight spec
      series { name color values }
    }
  }
`

export const WS_MY_SUBITEMS = gql`
  query WsMySubitems {
    wsMySubitems {
      itemId
      itemName
      boardId
      boardName
      stageName
      stageColor
      subitem { id name status startDate dueDate hours isOverdue completedAt allowedStatuses assignee { ...UserFields } }
    }
  }
  ${USER}
`

export const WS_ACTIVITY = gql`
  query WsActivity($limit: Int) {
    wsActivity(limit: $limit) { id detail createdAt itemId itemName boardId boardName user { ...UserFields } }
  }
  ${USER}
`
