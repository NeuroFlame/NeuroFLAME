import assert from 'node:assert/strict'
import test from 'node:test'
import { filterConsortiumList } from '../src/pages/ConsortiumList/filterConsortiumList.ts'

const consortium = (id, createdAt, memberIds = [], title = id) => ({
  id,
  title,
  createdAt: String(createdAt),
  members: memberIds.map((id) => ({ id })),
})

const list = [
  consortium('other-new', 400, ['other-user'], 'Brain New'),
  consortium('joined-old', 100, ['current-user'], 'Brain Old'),
  consortium('other-old', 200, [], 'Other Study'),
  consortium('joined-new', 300, ['other-user', 'current-user'], 'Brain Joined'),
]

const ids = (items) => items.map(({ id }) => id)

for (const [sortOrder, expected] of [
  ['newest', ['joined-new', 'joined-old', 'other-new', 'other-old']],
  ['oldest', ['joined-old', 'joined-new', 'other-old', 'other-new']],
]) {
  test(`joined consortia stay first with ${sortOrder} date sorting`, () => {
    const result = filterConsortiumList(list, { name: '', sortOrder }, 'current-user')
    assert.deepEqual(ids(result), expected)
    assert.deepEqual(ids(list), ['other-new', 'joined-old', 'other-old', 'joined-new'])
  })
}

test('name filtering preserves membership priority and date order', () => {
  const result = filterConsortiumList(list, { name: '  bRaIn  ', sortOrder: 'newest' }, 'current-user')
  assert.deepEqual(ids(result), ['joined-new', 'joined-old', 'other-new'])
  assert.deepEqual(filterConsortiumList(list, { name: 'missing', sortOrder: 'newest' }, 'current-user'), [])
})

test('ordering follows the current user, including after identity initialization', () => {
  const filter = { name: '', sortOrder: 'newest' }
  assert.deepEqual(ids(filterConsortiumList(list, filter, '')), [
    'other-new', 'joined-new', 'other-old', 'joined-old',
  ])
  assert.deepEqual(ids(filterConsortiumList(list, filter, 'current-user')), [
    'joined-new', 'joined-old', 'other-new', 'other-old',
  ])
  assert.deepEqual(ids(filterConsortiumList(list, filter, 'other-user')), [
    'other-new', 'joined-new', 'other-old', 'joined-old',
  ])
})

test('membership changes on reload move consortia to the appropriate group', () => {
  const updatedList = list.map((item) => item.id === 'joined-new' ? { ...item, members: [] } : item)
  const result = filterConsortiumList(updatedList, { name: '', sortOrder: 'newest' }, 'current-user')
  assert.deepEqual(ids(result), ['joined-old', 'other-new', 'joined-new', 'other-old'])
})

test('equal dates preserve order within each membership group', () => {
  const sameDate = list.map((item) => ({ ...item, createdAt: '100' }))
  const result = filterConsortiumList(sameDate, { name: '', sortOrder: 'newest' }, 'current-user')
  assert.deepEqual(ids(result), ['joined-old', 'joined-new', 'other-new', 'other-old'])
  assert.deepEqual(filterConsortiumList([], { name: '', sortOrder: 'newest' }, 'current-user'), [])
})
