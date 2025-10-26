const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const WEBHOOK_GERA_SHORTS = import.meta.env.VITE_WEBHOOK_GERA_SHORTS

export interface GerarShortsPayload {
  generation_type: 'imagem' | 'video'
  task_uuid?: string // Para rastreamento de vídeo
  imagem_base64?: string // Para geração de imagem
  imagem_nome?: string // Nome do arquivo de imagem
  video_description?: string // Para geração de vídeo
  image_url?: string // URL da imagem gerada
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

      console.log('Making API call to:', url)
      console.log('Request payload:', payload)

      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors', // Crucial for CORS requests
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error Response:', errorText)
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const responseText = await response.text()
      console.log('Response body:', responseText)

      // Try to parse as JSON, fallback to text if it fails
      try {
        return JSON.parse(responseText)
      } catch (parseError) {
        return responseText
      }
    } catch (error) {
      console.error('Erro ao gerar shorts:', error)
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Não foi possível conectar ao servidor. Verifique se o serviço está rodando e se há problemas de CORS.')
      }
      throw error
    }
  },
}
