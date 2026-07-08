import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import type { PublicInterviewSession } from '@/types'
import { CheckCircle2, Send, Bot, User } from 'lucide-react'

type Message = {
  id: string
  role: 'bot' | 'user'
  content: string
}

export function PublicInterviewWorkspacePage() {
  const { token = '' } = useParams()
  const storageKey = `hrbot_interview_chat_${token}`
  const [session, setSession] = useState<PublicInterviewSession | null>(null)
  
  const [messages, setMessages] = useState<Message[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1)
  const [inputValue, setInputValue] = useState('')
  
  const [isLoading, setIsLoading] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  useEffect(() => {
    api.interviews.publicFind(token)
      .then((data) => {
        setSession(data)
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          setMessages(parsed.messages || [])
          setAnswers(parsed.answers || {})
          setCurrentQuestionIndex(parsed.currentQuestionIndex ?? -1)
          if (parsed.isSubmitted) setIsSubmitted(true)
        } else {
          // Initialize chat
          setMessages([{
            id: 'welcome',
            role: 'bot',
            content: `Xin chào! Tôi là AI Interviewer của HR-Bot. Cảm ơn bạn đã tham gia buổi phỏng vấn hôm nay. Hãy bắt đầu nhé!`
          }])
          setCurrentQuestionIndex(0)
        }
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Interview link is invalid or expired'))
      .finally(() => setIsLoading(false))
  }, [storageKey, token])

  // Save state to local storage
  useEffect(() => {
    if (!isLoading && session) {
      localStorage.setItem(storageKey, JSON.stringify({
        messages,
        answers,
        currentQuestionIndex,
        isSubmitted
      }))
    }
  }, [messages, answers, currentQuestionIndex, isSubmitted, storageKey, isLoading, session])

  // Bot asking question logic
  useEffect(() => {
    if (!session || isSubmitted) return
    const questions = session.questions || []
    
    // If it's the bot's turn to ask
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      const q = questions[currentQuestionIndex]
      // Check if this question is already in messages
      const questionAlreadyAsked = messages.some(m => m.id === `q_${q.id}`)
      if (!questionAlreadyAsked && !isTyping) {
        setIsTyping(true)
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: `q_${q.id}`,
            role: 'bot',
            content: q.question
          }])
          setIsTyping(false)
        }, 1500)
      }
    } else if (currentQuestionIndex >= questions.length && questions.length > 0) {
      // Finished all questions
      const finalMsgExists = messages.some(m => m.id === 'final')
      if (!finalMsgExists && !isTyping && !isSubmitting) {
        setIsTyping(true)
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: 'final',
            role: 'bot',
            content: 'Cảm ơn bạn đã hoàn thành tất cả câu hỏi! Hệ thống đang nộp bài...'
          }])
          setIsTyping(false)
          submitInterview()
        }, 1500)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, session, messages, isSubmitted])

  const handleSend = () => {
    if (!inputValue.trim() || !session || isTyping || isSubmitting) return
    const questions = session.questions || []
    const currentQ = questions[currentQuestionIndex]
    
    if (!currentQ) return

    const newAnswer = inputValue.trim()
    
    // Add user message
    setMessages(prev => [...prev, {
      id: `a_${currentQ.id}`,
      role: 'user',
      content: newAnswer
    }])
    
    // Record answer
    setAnswers(prev => ({ ...prev, [currentQ.id]: newAnswer }))
    setInputValue('')
    
    // Move to next question
    setCurrentQuestionIndex(prev => prev + 1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const submitInterview = async () => {
    if (!session) return
    setIsSubmitting(true)
    try {
      // In this chat flow, we just use a generic duration for each, or recalculate if needed.
      // We stored the answers in state.
      const questions = session.questions || []
      await api.interviews.publicSubmit(token, questions.map((item) => ({
        questionId: item.id,
        answer: answers[item.id] ?? '',
        duration: 60, // Simplified duration for chatbot mode
      })))
      setIsSubmitted(true)
      setError('')
      localStorage.removeItem(storageKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit interview')
      setMessages(prev => [...prev, {
        id: 'error',
        role: 'bot',
        content: 'Đã có lỗi xảy ra khi nộp bài. Vui lòng thử tải lại trang.'
      }])
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground animate-pulse">Loading AI Interviewer...</p>
      </main>
    )
  }

  if (isSubmitted || session?.status === 'completed') {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-6" />
        <h1 className="text-3xl font-bold mb-3">Interview Completed</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Cảm ơn bạn đã tham gia buổi phỏng vấn. Hệ thống AI đã ghi nhận câu trả lời và sẽ gửi kết quả cho bộ phận tuyển dụng.
        </p>
      </main>
    )
  }

  const questions = session?.questions || []
  const hasQuestions = questions.length > 0

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card shadow-sm z-10 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">AI Interviewer</h1>
            <p className="text-xs text-muted-foreground">
              {session ? `${session.application.candidateProfile.firstName} ${session.application.candidateProfile.lastName}` : ''}
            </p>
          </div>
        </div>
      </header>

      <section className="flex-1 w-full max-w-4xl mx-auto flex flex-col relative">
        {error && (
          <div className="p-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}
        
        {!hasQuestions && !error ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            No interview questions are available.
          </div>
        ) : (
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'bot' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {msg.role === 'bot' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex gap-3 flex-row">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-4 flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-background border-t border-border">
              <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isTyping ? "Đang đợi câu hỏi..." : "Nhập câu trả lời của bạn..."}
                  className="min-h-[60px] max-h-[200px] resize-none pr-12 rounded-xl"
                  disabled={isTyping || isSubmitting || currentQuestionIndex >= questions.length}
                />
                <Button 
                  size="sm" 
                  className="absolute right-2 bottom-2 rounded-full w-9 h-9 p-0"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping || isSubmitting || currentQuestionIndex >= questions.length}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Bấm Enter để gửi, Shift + Enter để xuống dòng
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
