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

  // Video Realtime states
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const channelRef = useRef<any>(null)

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

      // Iniciar Realtime listener para detectar quando vídeo estiver pronto
      startVideoRealtime(taskUuid)

    } catch (error: any) {
      console.error('Erro ao processar:', error)
      setStatus('error')
      setIsGeneratingVideo(false)
      setErrorMessage(error.message || 'Erro ao gerar vídeo. Tente novamente.')
    }
  }

  const startVideoRealtime = async (taskUuid: string) => {
    // 1. Buscar status inicial (caso já esteja pronto)
    try {
      const { data: initialData } = await supabase
        .from('shorts_generation')
        .select('status, video_url, error_message')
        .eq('id', taskUuid)
        .single()

      if (initialData?.status === 'completed' && initialData.video_url) {
        // Já está pronto!
        setVideoUrl(initialData.video_url)
        setStatus('success')
        setIsGeneratingVideo(false)
        setSuccessMessage('Vídeo gerado com sucesso!')
        return
      } else if (initialData?.status === 'error') {
        setStatus('error')
        setIsGeneratingVideo(false)
        setErrorMessage(initialData.error_message || 'Erro ao gerar vídeo')
        return
      }
    } catch (err) {
      console.error('Erro ao buscar status inicial:', err)
    }

    // 2. Inscrever para receber atualizações em tempo real
    const channel = supabase
      .channel(`video_generation_${taskUuid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shorts_generation',
          filter: `id=eq.${taskUuid}`
        },
        (payload) => {
          console.log('🔔 Realtime update recebido:', payload)
          const data = payload.new as any

          if (data.status === 'completed' && data.video_url) {
            // Vídeo pronto!
            setVideoUrl(data.video_url)
            setStatus('success')
            setIsGeneratingVideo(false)
            setSuccessMessage('Vídeo gerado com sucesso!')
            stopRealtime()
          } else if (data.status === 'error') {
            setStatus('error')
            setIsGeneratingVideo(false)
            setErrorMessage(data.error_message || 'Erro ao gerar vídeo')
            stopRealtime()
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status)
      })

    channelRef.current = channel

    // 3. Timeout de segurança (10 minutos)
    setTimeout(() => {
      if (isGeneratingVideo) {
        setStatus('error')
        setIsGeneratingVideo(false)
        setErrorMessage('Tempo esgotado. O vídeo pode ainda estar sendo processado.')
        stopRealtime()
      }
    }, 600000) // 10 minutos
  }

  const stopRealtime = () => {
    if (channelRef.current) {
      console.log('🔌 Desconectando Realtime...')
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }

  // Limpar Realtime ao desmontar componente
  useEffect(() => {
    return () => stopRealtime()
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
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
      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="h-full bg-gray-800 rounded-2xl shadow-2xl p-6 flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-white mb-1">
                Gerar Short Viral
              </h2>
              <p className="text-gray-400 text-sm">
                Faça upload de uma imagem para gerar seu vídeo viral
              </p>
            </div>

          {/* Dynamic Layout - Horizontal Flow */}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 mb-4 min-h-0 justify-center">
            {/* Upload Area - Always visible */}
            <div className="flex flex-col min-h-0 h-full">
              <h3 className="text-base font-semibold text-white mb-2 flex-shrink-0">Upload</h3>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed rounded-xl flex-1 flex items-center justify-center cursor-pointer
                  transition-all duration-200 overflow-hidden aspect-[9/16]
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
                  <div className="p-4 w-full h-full flex flex-col">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full flex-1 object-contain rounded-lg"
                    />
                    <p className="text-gray-300 text-xs text-center mt-3 truncate">{selectedFile?.name}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFile(null)
                        setPreviewUrl(null)
                        setGeneratedResult(null)
                        setVideoUrl(null)
                        setStatus('idle')
                      }}
                      className="text-xs text-gray-400 hover:text-gray-300 underline mt-2"
                    >
                      Escolher outra
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <Upload className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                    <p className="text-sm text-gray-300 font-medium mb-1">
                      Clique ou arraste
                    </p>
                    <p className="text-xs text-gray-500">
                      Até 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Image - Visible when result exists */}
            {generatedResult && (
              <div className="flex flex-col min-h-0 h-full">
                <h3 className="text-base font-semibold text-white mb-2 flex-shrink-0">Imagem Gerada</h3>
                <div className="border-2 border-green-500 rounded-xl flex-1 flex items-center justify-center bg-gray-900 overflow-hidden aspect-[9/16]">
                  <img
                    src={generatedResult.image_url}
                    alt="Imagem gerada"
                    className="w-full h-full object-contain p-4"
                  />
                </div>
              </div>
            )}

            {/* Control Panel - Visible when result exists */}
            {generatedResult && (
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <h3 className="text-base font-semibold text-white mb-2 flex-shrink-0">Controles</h3>
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {/* Prompt Section */}
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <label className="text-xs font-medium text-gray-400 block mb-2">Prompt Positivo</label>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 max-h-32 overflow-y-auto">
                      <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{generatedResult.positivePrompt}</p>
                    </div>
                    <button
                      onClick={handleGenerateImage}
                      disabled={status === 'processing'}
                      className="w-full mt-3 py-2 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {status === 'processing' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4" />
                          Gerar Nova Imagem
                        </>
                      )}
                    </button>
                  </div>

                  {/* Video Description Section */}
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <label className="text-xs font-medium text-gray-400 block mb-2">Descrição do Vídeo</label>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 max-h-32 overflow-y-auto">
                      <p className="text-gray-300 text-xs leading-relaxed">{generatedResult.video_description}</p>
                    </div>
                    <button
                      onClick={handleGenerateVideo}
                      disabled={isGeneratingVideo}
                      className="w-full mt-3 py-2 px-4 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isGeneratingVideo ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Gerando vídeo...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Gerar Vídeo
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Video Section - Loading or Ready */}
            {(isGeneratingVideo || videoUrl) && (
              <div className="flex flex-col min-h-0 h-full">
                <h3 className="text-base font-semibold text-white mb-2 flex-shrink-0 flex items-center gap-2">
                  {videoUrl ? (
                    <>
                      <Video className="w-5 h-5 text-green-500" />
                      Vídeo Pronto
                    </>
                  ) : (
                    'Processando Vídeo'
                  )}
                </h3>
                <div className={`border-2 rounded-xl flex-1 flex flex-col overflow-hidden aspect-[9/16] ${
                  videoUrl ? 'border-green-500 bg-gray-900' : 'border-blue-500 bg-blue-500/5'
                }`}>
                  {videoUrl ? (
                    <>
                      {/* Video Player */}
                      <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                        <video
                          src={videoUrl}
                          controls
                          className="w-full h-full object-contain"
                        />
                      </div>
                      {/* Action Buttons */}
                      <div className="flex gap-2 p-3 bg-gray-800 border-t border-gray-700">
                        <a
                          href={videoUrl}
                          download
                          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold text-center transition-colors"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(videoUrl)
                            setSuccessMessage('URL copiada!')
                          }}
                          className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Copiar URL
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center flex-1 p-6">
                      <div className="text-center">
                        <Loader2 className="w-16 h-16 mx-auto text-blue-500 animate-spin mb-4" />
                        <p className="text-blue-400 text-sm font-medium mb-2">
                          Gerando vídeo...
                        </p>
                        <p className="text-gray-400 text-xs">
                          Isso pode levar alguns minutos
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Messages and Buttons - Fixed at bottom */}
          <div className="flex-shrink-0 space-y-3">
            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-red-500 text-xs">{errorMessage}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-500/10 border border-green-500 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-green-500 text-xs">{successMessage}</p>
              </div>
            )}

            {/* Generate Image Button - Only when no result */}
            {selectedFile && !generatedResult && (
              <button
                onClick={handleGenerateImage}
                disabled={status === 'processing'}
                className={`
                  w-full py-3 px-6 rounded-xl font-semibold text-white text-sm
                  transition-all duration-200 flex items-center justify-center gap-2
                  ${status === 'processing'
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                  }
                `}
              >
                {status === 'processing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando imagem...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    Gerar Imagem
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  </div>
  )
}
