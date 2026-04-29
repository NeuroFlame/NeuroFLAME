const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ACCESS_TOKEN_KEY = 'accessToken'

const state = {
  inviteToken: getInviteToken(),
  inviteInfo: null,
  user: null,
  authMode: 'login',
  isSubmittingAuth: false,
  isJoining: false,
}

const elements = {
  topbarUser: document.getElementById('topbarUser'),
  topbarEmail: document.getElementById('topbarEmail'),
  logoutButton: document.getElementById('logoutButton'),
  inviteSubtitle: document.getElementById('inviteSubtitle'),
  status: document.getElementById('status'),
  authPanel: document.getElementById('authPanel'),
  authForm: document.getElementById('authForm'),
  authHeading: document.getElementById('authHeading'),
  loginTab: document.getElementById('loginTab'),
  signupTab: document.getElementById('signupTab'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  formError: document.getElementById('formError'),
  submitButton: document.getElementById('submitButton'),
  joinPanel: document.getElementById('joinPanel'),
  joinCopy: document.getElementById('joinCopy'),
  joinError: document.getElementById('joinError'),
  joinActions: document.getElementById('joinActions'),
  retryJoinButton: document.getElementById('retryJoinButton'),
}

boot().catch((error) => {
  showStatus('error', error.message || 'Something went wrong while loading this invite.')
})

async function boot() {
  wireEvents()

  if (!state.inviteToken) {
    renderInviteUnavailable('Invalid invite link.')
    return
  }

  await loadInviteInfo()
  await restoreUser()
  render()

  if (state.user) {
    await joinInvite()
  }
}

function wireEvents() {
  elements.loginTab.addEventListener('click', () => setAuthMode('login'))
  elements.signupTab.addEventListener('click', () => setAuthMode('signup'))
  elements.authForm.addEventListener('submit', handleAuthSubmit)
  elements.retryJoinButton.addEventListener('click', () => {
    joinInvite().catch((error) => {
      renderJoinError(error.message || 'Failed to join consortium.')
    })
  })
  elements.logoutButton.addEventListener('click', async () => {
    clearToken()
    state.user = null
    render()
  })
}

function getInviteToken() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] !== 'invite') {
    return ''
  }

  return parts[1] || ''
}

async function loadInviteInfo() {
  showStatus()

  try {
    const data = await graphqlRequest(
      `query GetInviteInfo($inviteToken: String!) {
        getInviteInfo(inviteToken: $inviteToken) {
          consortiumName
          leaderName
          isExpired
        }
      }`,
      { inviteToken: state.inviteToken },
    )

    state.inviteInfo = data.getInviteInfo

    if (state.inviteInfo.isExpired) {
      renderInviteUnavailable(
        `This invite link has expired. Please contact ${state.inviteInfo.leaderName} for a new invite.`,
      )
      return
    }

    elements.inviteSubtitle.textContent =
      `${state.inviteInfo.leaderName} invites you to join ${state.inviteInfo.consortiumName} on NeuroFLAME.`
  } catch (error) {
    renderInviteUnavailable(error.message || 'Invalid invite link.')
  }
}

async function restoreUser() {
  const token = getToken()
  if (!token) {
    return
  }

  try {
    const data = await graphqlRequest(
      `query GetUserProfile {
        getUserProfile {
          userId
          username
          roles
        }
      }`,
      {},
      token,
    )

    state.user = data.getUserProfile
  } catch {
    clearToken()
    state.user = null
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault()

  if (!state.inviteInfo || state.inviteInfo.isExpired) {
    return
  }

  const username = elements.emailInput.value.trim()
  const password = elements.passwordInput.value

  if (!EMAIL_REGEX.test(username)) {
    renderFormError('Please enter a valid email address.')
    return
  }

  if (!password) {
    renderFormError('Please enter a password.')
    return
  }

  setAuthSubmitting(true)
  renderFormError('')

  const operation =
    state.authMode === 'login'
      ? {
          query: `mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
              accessToken
              userId
              username
              roles
            }
          }`,
          field: 'login',
        }
      : {
          query: `mutation UserCreate($username: String!, $password: String!) {
            userCreate(username: $username, password: $password) {
              accessToken
              userId
              username
              roles
            }
          }`,
          field: 'userCreate',
        }

  try {
    const data = await graphqlRequest(operation.query, { username, password })
    const payload = data[operation.field]
    setToken(payload.accessToken)
    state.user = {
      userId: payload.userId,
      username: payload.username,
      roles: payload.roles,
    }
    elements.passwordInput.value = ''
    render()
    await joinInvite()
  } catch (error) {
    renderFormError(error.message || `Failed to ${state.authMode}.`)
  } finally {
    setAuthSubmitting(false)
  }
}

async function joinInvite() {
  if (!state.user || !state.inviteToken || !state.inviteInfo || state.inviteInfo.isExpired) {
    return
  }

  state.isJoining = true
  render()
  renderJoinError('')
  elements.joinActions.hidden = true

  try {
    await graphqlRequest(
      `mutation ConsortiumJoinByInvite($inviteToken: String!) {
        consortiumJoinByInvite(inviteToken: $inviteToken)
      }`,
      { inviteToken: state.inviteToken },
      getToken(),
    )

    state.isJoining = false
    showStatus(
      'success',
      `You've been added to ${state.inviteInfo.consortiumName}! Download NeuroFLAME to get started.`,
    )
    elements.joinCopy.textContent = 'Your account is ready. You can download the desktop app and continue there.'
    elements.joinError.textContent = ''
    elements.joinActions.hidden = true
  } catch (error) {
    state.isJoining = false
    handleJoinFailure(error.message || 'Failed to join consortium.')
  } finally {
    render()
  }
}

function setAuthMode(mode) {
  state.authMode = mode
  renderFormError('')
  render()
}

function setAuthSubmitting(isSubmitting) {
  state.isSubmittingAuth = isSubmitting
  render()
}

function renderInviteUnavailable(message) {
  state.inviteInfo = null
  elements.inviteSubtitle.textContent = message
  elements.authPanel.hidden = true
  elements.joinPanel.hidden = true
  showStatus('error', message)
}

function renderJoinError(message) {
  elements.joinError.textContent = message || ''
  elements.joinActions.hidden = !message
  if (message) {
    elements.joinCopy.textContent = 'We could not add you to this consortium yet.'
    showStatus('error', message)
  }
}

function handleJoinFailure(message) {
  if (message.includes('already a member')) {
    showStatus('success', "You're already a member of this consortium.")
    elements.joinCopy.textContent = 'Your account already has access to this consortium. Download NeuroFLAME to continue.'
    elements.joinError.textContent = ''
    elements.joinActions.hidden = true
    return
  }

  renderJoinError(message)
}

function renderFormError(message) {
  elements.formError.textContent = message || ''
}

function showStatus(kind, message) {
  if (!kind || !message) {
    elements.status.innerHTML = ''
    return
  }

  elements.status.innerHTML = `<div class="status-message ${kind}">${escapeHtml(message)}</div>`
}

function render() {
  const hasInvite = Boolean(state.inviteInfo && !state.inviteInfo.isExpired)
  const isAuthenticated = Boolean(state.user)

  elements.topbarUser.hidden = !isAuthenticated
  elements.topbarEmail.textContent = isAuthenticated ? state.user.username : ''

  elements.authPanel.hidden = !hasInvite || isAuthenticated
  elements.joinPanel.hidden = !hasInvite || !isAuthenticated

  elements.loginTab.classList.toggle('is-active', state.authMode === 'login')
  elements.signupTab.classList.toggle('is-active', state.authMode === 'signup')
  elements.loginTab.setAttribute('aria-selected', String(state.authMode === 'login'))
  elements.signupTab.setAttribute('aria-selected', String(state.authMode === 'signup'))
  elements.authHeading.textContent = state.authMode === 'login' ? 'Log In' : 'Sign Up'
  elements.submitButton.textContent = state.isSubmittingAuth
    ? state.authMode === 'login'
      ? 'Logging In...'
      : 'Signing Up...'
    : state.authMode === 'login'
      ? 'Log In'
      : 'Sign Up'
  elements.passwordInput.setAttribute(
    'autocomplete',
    state.authMode === 'login' ? 'current-password' : 'new-password',
  )

  const disableAuth = state.isSubmittingAuth || !hasInvite
  elements.emailInput.disabled = disableAuth
  elements.passwordInput.disabled = disableAuth
  elements.submitButton.disabled = disableAuth
  elements.loginTab.disabled = state.isSubmittingAuth
  elements.signupTab.disabled = state.isSubmittingAuth

  if (isAuthenticated) {
    elements.joinCopy.textContent = state.isJoining
      ? 'Joining consortium now...'
      : 'Checking your invite status.'
  }
}

async function graphqlRequest(query, variables, token = '') {
  let response

  try {
    response = await fetch('/graphql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { 'x-access-token': token } : {}),
      },
      body: JSON.stringify({ query, variables }),
    })
  } catch {
    throw new Error('Network error. Please check your connection and try again.')
  }

  if (!response.ok) {
    throw new Error('Network error. Please try again in a moment.')
  }

  const payload = await response.json()
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors.map((error) => error.message).join(', '))
  }

  return payload.data
}

function getToken() {
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY) || ''
}

function setToken(token) {
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
}

function clearToken() {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
