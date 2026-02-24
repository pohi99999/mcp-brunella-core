import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { User, UserRole } from '@/lib/types'
import { validateLogin, MOCK_USERS, getRoleDisplayName } from '@/lib/auth'
import { SignIn, Warning } from '@phosphor-icons/react'

interface LoginFormProps {
  onLogin: (user: User) => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    setTimeout(() => {
      const user = validateLogin(username, password)
      
      if (user) {
        onLogin(user)
      } else {
        setError('Hibás felhasználónév vagy jelszó')
      }
      
      setIsLoading(false)
    }, 800)
  }

  const handleDemoLogin = (role: UserRole) => {
    const mockUser = MOCK_USERS.find(u => u.role === role)
    if (mockUser) {
      setUsername(mockUser.username)
      setPassword('demo123')
      setError('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">MCP Brunella Core</CardTitle>
          <CardDescription>
            Jelentkezz be az irányítópult eléréséhez
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Felhasználónév</Label>
              <Input
                id="username"
                type="text"
                placeholder="Írj be felhasználónevet"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Jelszó</Label>
              <Input
                id="password"
                type="password"
                placeholder="Írj be jelszót"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <Warning className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              <SignIn className="mr-2" size={18} />
              {isLoading ? 'Bejelentkezés...' : 'Bejelentkezés'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Vagy próbáld ki demo fiókkal
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => handleDemoLogin('admin')}
              disabled={isLoading}
              className="w-full justify-start"
            >
              <div className="flex flex-col items-start flex-1">
                <span className="font-medium">admin</span>
                <span className="text-xs text-muted-foreground">
                  {getRoleDisplayName('admin')} - Teljes hozzáférés
                </span>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleDemoLogin('operator')}
              disabled={isLoading}
              className="w-full justify-start"
            >
              <div className="flex flex-col items-start flex-1">
                <span className="font-medium">operator</span>
                <span className="text-xs text-muted-foreground">
                  {getRoleDisplayName('operator')} - Szerver vezérlés
                </span>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleDemoLogin('viewer')}
              disabled={isLoading}
              className="w-full justify-start"
            >
              <div className="flex flex-col items-start flex-1">
                <span className="font-medium">viewer</span>
                <span className="text-xs text-muted-foreground">
                  {getRoleDisplayName('viewer')} - Csak olvasás
                </span>
              </div>
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Demo jelszó: <code className="font-mono bg-muted px-1 py-0.5 rounded">demo123</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
