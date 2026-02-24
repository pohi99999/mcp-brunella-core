import { ExternalApiConfig } from './types'

export interface ApiExecutionResult {
  success: boolean
  data?: any
  error?: string
  statusCode?: number
  headers?: Record<string, string>
}

export class ExternalApiService {
  async executeApiCall(
    config: ExternalApiConfig,
    parameters: Record<string, any>
  ): Promise<ApiExecutionResult> {
    try {
      const url = this.interpolateString(config.url, parameters)
      const headers = this.buildHeaders(config)
      const body = config.bodyTemplate 
        ? this.interpolateString(config.bodyTemplate, parameters)
        : undefined

      const controller = new AbortController()
      const timeout = config.timeout || 30000
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(url, {
          method: config.method,
          headers,
          body: body && config.method !== 'GET' ? body : undefined,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const contentType = response.headers.get('content-type')
        let data: any

        if (contentType?.includes('application/json')) {
          data = await response.json()
        } else {
          data = await response.text()
        }

        if (!response.ok) {
          return {
            success: false,
            error: `API hiba: ${response.status} ${response.statusText}`,
            statusCode: response.status,
            data,
          }
        }

        const mappedData = config.responseMapping
          ? this.mapResponse(data, config.responseMapping)
          : data

        return {
          success: true,
          data: mappedData,
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return {
            success: false,
            error: `API timeout (${timeout}ms túllépve)`,
          }
        }
        
        throw fetchError
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ismeretlen API hiba',
      }
    }
  }

  private buildHeaders(config: ExternalApiConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    }

    if (config.authType && config.authValue) {
      switch (config.authType) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${config.authValue}`
          break
        case 'apikey':
          headers['X-API-Key'] = config.authValue
          break
        case 'basic':
          headers['Authorization'] = `Basic ${config.authValue}`
          break
      }
    }

    return headers
  }

  private interpolateString(template: string, parameters: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return parameters[key] !== undefined ? String(parameters[key]) : match
    })
  }

  private mapResponse(data: any, mapping: string): any {
    try {
      const paths = mapping.split('.')
      let result = data

      for (const path of paths) {
        if (result === null || result === undefined) {
          return null
        }
        result = result[path]
      }

      return result
    } catch (error) {
      return data
    }
  }

  async validateApiConfig(config: ExternalApiConfig): Promise<{ valid: boolean; error?: string }> {
    try {
      new URL(config.url)
    } catch {
      return { valid: false, error: 'Érvénytelen URL formátum' }
    }

    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method)) {
      return { valid: false, error: 'Érvénytelen HTTP metódus' }
    }

    if (config.bodyTemplate && config.method === 'GET') {
      return { valid: false, error: 'GET kérés nem tartalmazhat body-t' }
    }

    return { valid: true }
  }
}

export const externalApiService = new ExternalApiService()
