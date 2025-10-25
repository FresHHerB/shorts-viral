import { useState, useRef } from 'react'
import { Upload, Image as ImageIcon, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '@shared/contexts/AuthContext'
import { apiService } from '@shared/services/api'
import { supabase } from '@shared/lib/supabase'

type StatusType = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export default function GerarShortsPage() {
  const { user, signOut } = useAuth()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusType>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setStatus('idle')
  }

  const handleUploadAndGenerate = async () => {
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

      // Enviar para o webhook de geração
      const payload = {
        imagem_base64: base64Only,
        imagem_nome: selectedFile.name,
        user_id: userId,
        opcoes: {
          estilo: 'viral',
          duracao: 30,
        }
      }

      const result = await apiService.gerarShorts(payload)

      setStatus('success')
      setSuccessMessage('Short gerado com sucesso! O vídeo estará pronto em breve.')

      // Limpar após 3 segundos
      setTimeout(() => {
        setSelectedFile(null)
        setPreviewUrl(null)
        setStatus('idle')
        setSuccessMessage('')
      }, 3000)

    } catch (error: any) {
      console.error('Erro ao processar:', error)
      setStatus('error')
      setErrorMessage(error.message || 'Erro ao gerar short. Tente novamente.')
    }
  }

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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              Gerar Short Viral
            </h2>
            <p className="text-gray-400">
              Faça upload de uma imagem para gerar seu vídeo viral
            </p>
          </div>

          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
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
              <div className="space-y-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-64 mx-auto rounded-lg shadow-lg"
                />
                <p className="text-gray-300 font-medium">{selectedFile?.name}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                    setPreviewUrl(null)
                    setStatus('idle')
                  }}
                  className="text-sm text-gray-400 hover:text-gray-300 underline"
                >
                  Escolher outra imagem
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-16 h-16 mx-auto text-gray-500" />
                <div>
                  <p className="text-lg text-gray-300 font-medium mb-1">
                    Clique ou arraste uma imagem
                  </p>
                  <p className="text-sm text-gray-500">
                    PNG, JPG, GIF até 10MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-6 bg-red-500/10 border border-red-500 rounded-lg p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-500 text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mt-6 bg-green-500/10 border border-green-500 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-green-500 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Generate Button */}
          {selectedFile && (
            <button
              onClick={handleUploadAndGenerate}
              disabled={status === 'uploading' || status === 'processing'}
              className={`
                w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white
                transition-all duration-200 flex items-center justify-center gap-2
                ${status === 'uploading' || status === 'processing'
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                }
              `}
            >
              {status === 'uploading' && (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Fazendo upload...
                </>
              )}
              {status === 'processing' && (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando short...
                </>
              )}
              {status === 'idle' && (
                <>
                  <ImageIcon className="w-5 h-5" />
                  Gerar Short Viral
                </>
              )}
              {status === 'success' && (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Sucesso!
                </>
              )}
              {status === 'error' && (
                <>
                  <XCircle className="w-5 h-5" />
                  Tentar Novamente
                </>
              )}
            </button>
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
