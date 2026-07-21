import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { API_BASE_URL } from '@/constants'
import type { PublicInterviewSession } from '@/types'
import { CheckCircle2, Bot, Mic, MicOff, PhoneOff } from 'lucide-react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  useLocalParticipant,
  useVoiceAssistant,
} from '@livekit/components-react'
import '@livekit/components-styles'

export function PublicInterviewWorkspacePage() {
  const { token = '' } = useParams()
  const [session, setSession] = useState<PublicInterviewSession | null>(null)
  const [lkToken, setLkToken] = useState('')
  const [lkUrl, setLkUrl] = useState('')
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')
  const tabSwitchesRef = React.useRef(0)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        tabSwitchesRef.current += 1
        console.warn('Tab switched! Potential cheating detected.', tabSwitchesRef.current)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // 1. Fetch Session Info
    api.interviews.publicFind(token)
      .then((data) => {
        setSession(data)
        if (data.status === 'completed' || data.status === 'COMPLETED') {
          setIsSubmitted(true)
          return
        }
        
        // 2. Fetch LiveKit Token
        fetch(`${API_BASE_URL}/ai/interviews/public/${token}/livekit-token`)
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch voice token');
            return res.json();
          })
          .then(resData => {
            const payload = resData.data || resData;
            if (payload.token) {
              setLkToken(payload.token)
              const wsUrl = payload.url.replace('http://', 'ws://').replace('https://', 'wss://');
              setLkUrl(wsUrl)
            } else {
              throw new Error('Invalid voice token response');
            }
          })
          .catch(err => {
            console.error(err)
            setError('Could not connect to voice server.')
          })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Interview link is invalid or expired'))
      .finally(() => setIsLoading(false))
  }, [token])

  const handleDisconnect = async () => {
    if (!session) return
    
    if (!isConnected) {
      setError('Connection to the voice server failed. Please check if the LiveKit server is running.')
      return
    }

    setIsSubmitted(true)
    // End interview on backend
    try {
      await fetch(`${API_BASE_URL}/ai/interviews/${session.id}/end`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabSwitches: tabSwitchesRef.current })
      })
    } catch (e) {
      console.error(e)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground animate-pulse">Loading Voice Interviewer...</p>
      </main>
    )
  }

  if (isSubmitted || session?.status === 'completed') {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-6" />
        <h1 className="text-3xl font-bold mb-3">Interview Completed</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Cảm ơn bạn đã tham gia buổi phỏng vấn. Hệ thống AI đã ghi nhận cuộc hội thoại và sẽ gửi kết quả cho bộ phận tuyển dụng.
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card shadow-sm z-10 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">AI Voice Interviewer</h1>
            <p className="text-xs text-muted-foreground">
              {session ? `${session.application.candidateProfile.firstName} ${session.application.candidateProfile.lastName}` : ''}
            </p>
          </div>
        </div>
      </header>

      <section className="flex-1 w-full max-w-4xl mx-auto flex flex-col relative p-6">
        {error && (
          <div className="mb-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}
        
        {!lkToken ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <Mic className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Ready to start?</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Please ensure you are in a quiet environment and your microphone is working.
              The AI interviewer will speak to you in real-time.
            </p>
            <p className="text-sm text-muted-foreground animate-pulse">Waiting for Voice Server connection...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            <LiveKitRoom
              token={lkToken}
              serverUrl={lkUrl}
              connect={true}
              audio={true}
              video={false}
              onConnected={() => setIsConnected(true)}
              onDisconnected={handleDisconnect}
              className="w-full flex-1 flex flex-col relative"
            >
              <RoomAudioRenderer />
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <VoiceAssistantVisualizer />
              </div>
              <div className="fixed bottom-0 left-0 right-0 p-6 bg-background border-t">
                <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
                  <VoiceAssistantControlBar />
                  <Button variant="danger" size="lg" className="rounded-full w-14 h-14 p-0" onClick={handleDisconnect}>
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            </LiveKitRoom>
          </div>
        )}
      </section>
    </main>
  )
}

function VoiceAssistantVisualizer() {
  const { state } = useVoiceAssistant()
  const { isMicrophoneEnabled } = useLocalParticipant()

  return (
    <div className="flex flex-col items-center gap-8">
      <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
        state === 'speaking' ? 'bg-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.5)] scale-110' :
        state === 'listening' ? 'bg-primary/10 scale-100' : 'bg-muted'
      }`}>
        <Bot className={`w-16 h-16 ${state === 'speaking' ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-xl font-semibold capitalize">
          {state === 'disconnected' ? 'Connecting...' : state}
        </h3>
        {!isMicrophoneEnabled && (
          <p className="text-destructive flex items-center gap-2 text-sm">
            <MicOff className="w-4 h-4" /> Please enable your microphone
          </p>
        )}
      </div>
    </div>
  )
}
