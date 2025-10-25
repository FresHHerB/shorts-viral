const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const WEBHOOK_GERA_SHORTS = import.meta.env.VITE_WEBHOOK_GERA_SHORTS

export interface GerarShortsPayload {
  imagem_url: string
  user_id: string
  opcoes?: {
    estilo?: string
    duracao?: number
    [key: string]: any
  }
}

export const apiService = {
  /**
   * Envia requisição para o webhook de geração de shorts
   */
  async gerarShorts(payload: GerarShortsPayload): Promise<any> {
    try {
      const url = `${API_BASE_URL}${WEBHOOK_GERA_SHORTS}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Erro ao gerar shorts:', error)
      throw error
    }
  },
}
