import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const compile = async (file, harness, formOnly = false) => {
  const result = await build({
    entryPoints: [new URL(`../src/pages/LoginPage/ChangePassword/${file}`, import.meta.url).pathname],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    external: ['react/jsx-runtime'],
    plugins: [{
      name: 'ui-fixture',
      setup(builder) {
        builder.onResolve({ filter: /^(react|react-router-dom|@mui\/material)$/ },
          (args) => ({ path: args.path, namespace: 'fixture' }))
        builder.onResolve({ filter: /centralApi$|UserStateContext$|\.\/useChangePassword$/ },
          (args) => formOnly && args.path === './useChangePassword'
            ? { path: 'form-hook', namespace: 'fixture' }
            : args.path !== './useChangePassword' ? { path: args.path, namespace: 'fixture' } : undefined)
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
          contents: args.path === 'react'
            ? 'export const useState = __nfTest.useState; export const useRef = __nfTest.useRef;'
            : args.path === 'react-router-dom'
              ? 'export const useNavigate = () => __nfTest.navigate;'
              : args.path === '@mui/material'
                ? [
                    "export const Box='Box',Button='Button',TextField='TextField';",
                    "export const CircularProgress='Spinner',Alert='Alert',Typography='Typography';",
                  ].join('\n')
                : args.path === 'form-hook'
                  ? 'export const useChangePassword = () => __nfTest.formHook;'
                  : args.path.endsWith('UserStateContext')
                    ? 'export const useUserState = () => ({clearUserData: __nfTest.clearUserData});'
                    : 'export const useCentralApi = () => ({userChangePassword: __nfTest.userChangePassword});',
        }))
      },
    }],
  })
  const module = { exports: {} }
  runInNewContext(result.outputFiles[0].text, {
    require, module, exports: module.exports, __nfTest: harness, Error,
  })
  return module.exports
}

const hooks = () => {
  const values = []
  let index = 0
  return {
    values,
    reset: () => { index = 0 },
    useState: (initial) => {
      const slot = index++
      if (!(slot in values)) values[slot] = initial
      return [values[slot], (next) => { values[slot] = next }]
    },
    useRef: (initial) => ({ current: initial }),
  }
}
const find = (node, type, name) => {
  if (!node) return null
  if (node.type === type && (!name || node.props.name === name)) return node
  for (const child of [node.props?.children].flat()) {
    const match = find(child, type, name)
    if (match) return match
  }
  return null
}

test('password-change hook rejects empty credentials and only signs out after a successful save', async () => {
  const state = hooks()
  let calls = 0; let signouts = 0
  const navigation = []
  const harness = {
    ...state,
    clearUserData: () => { signouts++ },
    navigate: (...args) => navigation.push(args),
    userChangePassword: async (input) => {
      calls++
      assert.deepEqual(JSON.parse(JSON.stringify(input)), { currentPassword: 'old-secret', password: 'new-secret' })
    },
  }
  const { useChangePassword } = await compile('useChangePassword.tsx', harness)
  const change = useChangePassword()
  assert.equal(await change.handleChangePassword('', 'new-secret'), false)
  assert.equal(calls, 0)
  assert.equal(await change.handleChangePassword('old-secret', 'new-secret'), true)
  assert.equal(signouts, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(navigation)), [['/', { replace: true, state: { passwordChanged: true } }]])
  assert.ok(!JSON.stringify(state.values).includes('secret'))
})

test('failed saves retain the login and display the API error; duplicate submissions are blocked', async () => {
  const state = hooks()
  let rejectRequest; let calls = 0; let signouts = 0
  const harness = {
    ...state,
    clearUserData: () => { signouts++ },
    navigate: () => assert.fail('Unexpected navigation'),
    userChangePassword: () => { calls++; return new Promise((_resolve, reject) => { rejectRequest = reject }) },
  }
  const { useChangePassword } = await compile('useChangePassword.tsx', harness)
  const change = useChangePassword()
  const pending = change.handleChangePassword('wrong', 'new-secret')
  assert.equal(await change.handleChangePassword('wrong', 'new-secret'), false)
  assert.equal(calls, 1)
  rejectRequest(new Error('Current password is incorrect'))
  assert.equal(await pending, false)
  assert.equal(signouts, 0)
  assert.equal(state.values[0], false)
  assert.equal(state.values[1], 'Current password is incorrect')
})

test('form requires the current password and matching confirmation, and clears secrets after submission', async () => {
  const state = hooks()
  let calls = 0; let saved = false
  const harness = {
    ...state,
    formHook: {
      loading: false,
      error: null,
      handleChangePassword: async (current, next) => {
        calls++
        assert.equal(current, 'old-secret')
        assert.equal(next, 'new-secret')
        return saved
      },
    },
  }
  const { ChangePassword } = await compile('ChangePassword.tsx', harness, true)
  const render = () => { state.reset(); return ChangePassword() }
  const change = (name, value) => find(render(), 'TextField', name).props.onChange({ target: { value } })
  let form = render()
  const current = find(form, 'TextField', 'currentPassword')
  assert.equal(current.props.type, 'password')
  assert.equal(current.props.required, true)
  assert.equal(current.props.autoComplete, 'current-password')
  assert.equal(find(form, 'Button').props.disabled, true)
  change('newPassword', 'new-secret')
  change('confirmPassword', 'mismatch')
  await render().props.onSubmit({ preventDefault() {} })
  assert.equal(calls, 0)
  change('currentPassword', 'old-secret')
  change('confirmPassword', 'new-secret')
  form = render()
  assert.equal(find(form, 'Button').props.disabled, false)
  await form.props.onSubmit({ preventDefault() {} })
  assert.equal(calls, 1)
  assert.equal(find(render(), 'TextField', 'currentPassword').props.value, '')
  assert.equal(find(render(), 'TextField', 'newPassword').props.value, 'new-secret')
  saved = true
  change('currentPassword', 'old-secret')
  await render().props.onSubmit({ preventDefault() {} })
  for (const name of ['currentPassword', 'newPassword', 'confirmPassword']) {
    assert.equal(find(render(), 'TextField', name).props.value, '')
  }
})
