import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const WEBHOOK_PATTERN =
  /^https?:\/\/[a-z0-9.-]+(?::\d+)?\/rest\/\d+\/[a-z0-9]+\/?$/i

function flattenPayload(
  base: unknown,
  target: Record<string, string>,
  prefix = '',
) {
  if (Array.isArray(base)) {
    base.forEach((value, index) => {
      flattenPayload(value, target, `${prefix}[${index}]`)
    })
    return
  }

  if (base !== null && typeof base === 'object') {
    for (const [key, value] of Object.entries(base as Record<string, unknown>)) {
      flattenPayload(value, target, prefix ? `${prefix}[${key}]` : key)
    }
    return
  }

  if (base !== undefined && base !== null && prefix) {
    target[prefix] = String(base)
  }
}

function bitrixProxyPlugin(): Plugin {
  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    if (req.method !== 'POST' || req.url !== '/api/bitrix') {
      next()
      return
    }

    let body = ''
    for await (const chunk of req) {
      body += chunk
    }

    try {
      const { webhookUrl, method, params, encoding } = JSON.parse(body) as {
        webhookUrl?: string
        method?: string
        params?: Record<string, unknown>
        encoding?: 'json' | 'form'
      }

      if (!webhookUrl || !method) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', error_description: 'webhookUrl and method are required' }))
        return
      }

      const normalized = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`

      if (!WEBHOOK_PATTERN.test(normalized)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'INVALID_WEBHOOK', error_description: 'Webhook URL format is invalid' }))
        return
      }

      const useForm = encoding === 'form'
      let requestBody: string
      let contentType: string

      if (useForm) {
        const flattened: Record<string, string> = {}
        flattenPayload(params ?? {}, flattened)
        requestBody = new URLSearchParams(flattened).toString()
        contentType = 'application/x-www-form-urlencoded'
      } else {
        requestBody = JSON.stringify(params ?? {})
        contentType = 'application/json'
      }

      const response = await fetch(`${normalized}${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          Accept: 'application/json',
        },
        body: requestBody,
      })

      const text = await response.text()
      res.statusCode = response.status
      res.setHeader('Content-Type', 'application/json')
      res.end(text)
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: 'PROXY_ERROR',
          error_description: error instanceof Error ? error.message : 'Unknown proxy error',
        }),
      )
    }
  }

  const register = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(handler)
  }

  return {
    name: 'bitrix-proxy',
    configureServer: register,
    configurePreviewServer: register,
  }
}

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss(), bitrixProxyPlugin()],
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
})
