import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const port = Number(process.env.PORT || 3005)
const messages = []

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function includesRecipient(message, recipient) {
  const recipients = Array.isArray(message.to) ? message.to : [message.to]
  return recipients.includes(recipient)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`)

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { status: 'ok' })
    }

    if (request.method === 'POST' && url.pathname === '/emails') {
      const message = await readJson(request)
      const id = randomUUID()
      messages.push({ ...message, id })
      return sendJson(response, 200, { id })
    }

    if (request.method === 'GET' && url.pathname === '/messages/latest') {
      const recipient = url.searchParams.get('to')
      const message = messages.findLast(
        (candidate) => !recipient || includesRecipient(candidate, recipient),
      )
      return message
        ? sendJson(response, 200, message)
        : sendJson(response, 404, { error: 'Message not found' })
    }

    if (request.method === 'DELETE' && url.pathname === '/messages') {
      messages.length = 0
      return sendJson(response, 200, { success: true })
    }

    return sendJson(response, 404, { error: 'Not found' })
  } catch (error) {
    return sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'Invalid request',
    })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Resend mock listening on port ${port}`)
})

process.on('SIGTERM', () => server.close())
