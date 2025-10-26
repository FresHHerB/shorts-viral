import { useState, useRef, useEffect } from 'react'
import { Upload, Image as ImageIcon, Loader2, CheckCircle, XCircle, Video } from 'lucide-react'
import { useAuth } from '@shared/contexts/AuthContext'
import { apiService } from '@shared/services/api'
import { supabase } from '@shared/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

type StatusType = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

interface GeneratedResult {
  positivePrompt: string
  video_description: string
  image_url: string
}

export default function GerarShortsPage() {
  const { user, signOut } = useAuth()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusType>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Video polling states
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecione apenas arquivos de imagem')
      return
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('A imagem deve ter no máximo 10MB')
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setErrorMessage('')
    setSuccessMessage('')
    setGeneratedResult(null)
    setStatus('idle')
  }

  const handleGenerateImage = async () => {
    if (!selectedFile) return

    // BYPASS TEMPORÁRIO: Use test-user se não houver autenticação
    const userId = user?.id || 'test-user'

    try {
      setStatus('processing')
      setErrorMessage('')
      setSuccessMessage('')

      // Converter imagem para base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(selectedFile)
      })

      const imageBase64 = await base64Promise

      // Remove o prefixo "data:image/...;base64," e envia apenas o código base64
      const base64Only = imageBase64.split(',')[1] || imageBase64

      // Enviar para o webhook de geração de imagem
      const payload = {
        generation_type: 'imagem',
        imagem_base64: base64Only,
        imagem_nome: selectedFile.name,
        user_id: userId,
        opcoes: {
          estilo: 'viral',
          duracao: 30,
        }
      }

      const result = await apiService.gerarShorts(payload)

      // Processar resposta do webhook
      // Espera array: [{ positivePrompt, video_description, image_url }]
      if (Array.isArray(result) && result.length > 0) {
        const firstResult = result[0]
        setGeneratedResult(firstResult)
        setStatus('success')
        setSuccessMessage('Imagem gerada com sucesso!')
      } else {
        throw new Error('Resposta inesperada do servidor')
      }

    } catch (error: any) {
      console.error('Erro ao processar:', error)
      setStatus('error')
      setErrorMessage(error.message || 'Erro ao gerar imagem. Tente novamente.')
    }
  }

  const handleGenerateVideo = async () => {
    if (!generatedResult) return

    // BYPASS TEMPORÁRIO: Use test-user se não houver autenticação
    const userId = user?.id || 'test-user'
    const taskUuid = uuidv4() // Gerar UUID único para rastreamento

    try {
      setIsGeneratingVideo(true)
      setStatus('processing')
      setErrorMessage('')
      setSuccessMessage('')
      setVideoUrl(null)

      // Enviar para o webhook de geração de vídeo
      const payload = {
        generation_type: 'video',
        task_uuid: taskUuid,
        video_description: generatedResult.video_description,
        image_url: generatedResult.image_url,
        user_id: userId,
        opcoes: {
          estilo: 'viral',
          duracao: 30,
        }
      }

      await apiService.gerarShorts(payload)

      setSuccessMessage('Vídeo enviado para geração! Aguardando processamento...')

      // Iniciar polling para verificar quando vídeo estiver pronto
      startVideoPolling(taskUuid)

    } catch (error: any) {
      console.error('Erro ao processar:', error)
      setStatus('error')
      setIsGeneratingVideo(false)
      setErrorMessage(error.message || 'Erro ao gerar vídeo. Tente novamente.')
    }
  }

  const startVideoPolling = (taskUuid: string) => {
    let attempts = 0
    const maxAttempts = 60 // 10 minutos (10s * 60)

    pollingIntervalRef.current = setInterval(async () => {
      attempts++

      try {
        const { data, error } = await supabase
          .from('shorts_generation')
          .select('status, video_url, error_message')
          .eq('id', taskUuid)
          .single()

        if (error) {
          console.log('Aguardando vídeo... tentativa', attempts)
          return
        }

        if (data?.status === 'completed' && data.video_url) {
          // Vídeo pronto!
          setVideoUrl(data.video_url)
          setStatus('success')
          setIsGeneratingVideo(false)
          setSuccessMessage('Vídeo gerado com sucesso!')
          stopPolling()
        } else if (data?.status === 'error') {
          setStatus('error')
          setIsGeneratingVideo(false)
          setErrorMessage(data.error_message || 'Erro ao gerar vídeo')
          stopPolling()
        } else if (attempts >= maxAttempts) {
          // Timeout
          setStatus('error')
          setIsGeneratingVideo(false)
          setErrorMessage('Tempo esgotado. O vídeo pode ainda estar sendo processado.')
          stopPolling()
        }
      } catch (err) {
        console.error('Erro no polling:', err)
      }
    }, 10000) // Verificar a cada 10 segundos
  }

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  // Limpar polling ao desmontar componente
  useEffect(() => {
    return () => stopPolling()
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setErrorMessage('')
      setSuccessMessage('')
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-8 h-8 text-blue-500" />
            Shorts Viral
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user?.email}</span>
            <button
              onClick={signOut}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              Gerar Short Viral
            </h2>
            <p className="text-gray-400">
              Faça upload de uma imagem para gerar seu vídeo viral
            </p>
          </div>

          {/* Images Grid - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Upload Area */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Imagem de Upload</h3>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed rounded-xl h-full min-h-[400px] flex items-center justify-center cursor-pointer
                  transition-all duration-200
                  ${previewUrl
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="p-6 w-full h-full flex flex-col">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain rounded-lg"
                    />
                    <p className="text-gray-300 font-medium text-center mt-4">{selectedFile?.name}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFile(null)
                        setPreviewUrl(null)
                        setGeneratedResult(null)
                        setStatus('idle')
                      }}
                      className="text-sm text-gray-400 hover:text-gray-300 underline mt-2"
                    >
                      Escolher outra imagem
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-12">
                    <Upload className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                    <p className="text-lg text-gray-300 font-medium mb-1">
                      Clique ou arraste uma imagem
                    </p>
                    <p className="text-sm text-gray-500">
                      PNG, JPG, GIF até 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Image */}
            <div className={generatedResult ? '' : 'hidden lg:block'}>
              <h3 className="text-lg font-semibold text-white mb-4">Imagem Gerada</h3>
              <div className="border-2 border-gray-700 rounded-xl h-full min-h-[400px] flex items-center justify-center bg-gray-900">
                {generatedResult ? (
                  <img
                    src={generatedResult.image_url}
                    alt="Imagem gerada"
                    className="w-full h-full object-contain rounded-lg p-6"
                  />
                ) : (
                  <div className="text-center p-12">
                    <ImageIcon className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-500">
                      A imagem gerada aparecerá aqui
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 bg-red-500/10 border border-red-500 rounded-lg p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-500 text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 bg-green-500/10 border border-green-500 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-green-500 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Generate Image Button - Only when no result */}
          {selectedFile && !generatedResult && (
            <button
              onClick={handleGenerateImage}
              disabled={status === 'processing'}
              className={`
                w-full mb-6 py-4 px-6 rounded-xl font-semibold text-white
                transition-all duration-200 flex items-center justify-center gap-2
                ${status === 'processing'
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                }
              `}
            >
              {status === 'processing' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando imagem...
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  Gerar Imagem
                </>
              )}
            </button>
          )}

          {/* Seção: Geração de Imagem */}
          {generatedResult && (
            <div className="mb-6 bg-gray-900 border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Geração de Imagem</h3>

              {/* Positive Prompt */}
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-gray-400">Prompt Positivo</label>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{generatedResult.positivePrompt}</p>
                </div>
              </div>

              {/* Generate New Image Button */}
              <button
                onClick={handleGenerateImage}
                disabled={status === 'processing'}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {status === 'processing' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5" />
                    Gerar Nova Imagem
                  </>
                )}
              </button>
            </div>
          )}

          {/* Seção: Geração de Vídeo */}
          {generatedResult && (
            <div className="mb-6 bg-gray-900 border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Geração de Vídeo</h3>

              {/* Video Description */}
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-gray-400">Descrição do Vídeo</label>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-gray-300 text-sm leading-relaxed">{generatedResult.video_description}</p>
                </div>
              </div>

              {/* Processing Indicator */}
              {isGeneratingVideo && !videoUrl && (
                <div className="mb-4 bg-blue-500/10 border border-blue-500 rounded-lg p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
                  <p className="text-blue-500 text-sm">
                    Gerando vídeo... Isso pode levar alguns minutos. Aguarde na página.
                  </p>
                </div>
              )}

              {/* Generate Video Button */}
              <button
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando vídeo...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Gerar Vídeo
                  </>
                )}
              </button>
            </div>
          )}

          {/* Seção: Vídeo Gerado */}
          {videoUrl && (
            <div className="mb-6 bg-gray-900 border border-green-500 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Video className="w-6 h-6 text-green-500" />
                Vídeo Gerado
              </h3>

              {/* Video Player */}
              <div className="bg-black rounded-lg overflow-hidden mb-4">
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-lg"
                  style={{ maxHeight: '600px' }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <a
                  href={videoUrl}
                  download
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-center transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(videoUrl)
                    setSuccessMessage('URL copiada para a área de transferência!')
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Copiar URL
                </button>
              </div>
            </div>
          )}

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-8 border-t border-gray-700">
            <div className="text-center">
              <div className="text-blue-500 font-bold text-2xl mb-1">1</div>
              <p className="text-gray-400 text-sm">Escolha uma imagem</p>
            </div>
            <div className="text-center">
              <div className="text-blue-500 font-bold text-2xl mb-1">2</div>
              <p className="text-gray-400 text-sm">Clique em gerar</p>
            </div>
            <div className="text-center">
              <div className="text-blue-500 font-bold text-2xl mb-1">3</div>
              <p className="text-gray-400 text-sm">Aguarde o processamento</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
