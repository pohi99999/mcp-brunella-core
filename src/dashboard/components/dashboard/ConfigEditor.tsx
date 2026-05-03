import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { ConfigItem, User } from '@/lib/types'
import { Gear, FloppyDisk } from '@phosphor-icons/react'
import { useState } from 'react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { canPerformAction } from '@/lib/auth'

interface ConfigEditorProps {
  config: ConfigItem[]
  user: User | null
  onSave: (updatedConfig: ConfigItem[]) => void
}

export function ConfigEditor({ config, user, onSave }: ConfigEditorProps) {
  const [editedConfig, setEditedConfig] = useState<ConfigItem[]>(config)
  const canEdit = canPerformAction(user, 'editConfig')

  const handleValueChange = (key: string, newValue: string | number | boolean) => {
    setEditedConfig(prev =>
      prev.map(item =>
        item.key === key ? { ...item, value: newValue } : item
      )
    )
  }

  const handleSave = () => {
    onSave(editedConfig)
  }

  const groupedConfig = editedConfig.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, ConfigItem[]>)

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gear size={24} />
            Konfiguráció
          </CardTitle>
          <PermissionGuard
            user={user}
            action="editConfig"
            fallback={
              <Button disabled className="flex items-center gap-2">
                <FloppyDisk size={20} />
                Mentés
              </Button>
            }
          >
            <Button onClick={handleSave} className="flex items-center gap-2">
              <FloppyDisk size={20} />
              Mentés
            </Button>
          </PermissionGuard>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedConfig).map(([category, items]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-sm font-semibold text-accent border-b border-border/50 pb-2">
              {category}
            </h3>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.key} className="space-y-2">
                  <Label htmlFor={item.key} className="text-sm">
                    {item.key}
                  </Label>
                  <p className="text-xs text-zinc-500">{item.description}</p>
                  {item.type === 'boolean' ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        id={item.key}
                        checked={item.value as boolean}
                        onCheckedChange={(checked) => handleValueChange(item.key, checked)}
                        disabled={!canEdit}
                      />
                      <span className="text-sm text-zinc-500">
                        {item.value ? 'Engedélyezve' : 'Letiltva'}
                      </span>
                    </div>
                  ) : item.type === 'number' ? (
                    <Input
                      id={item.key}
                      type="number"
                      value={item.value as number}
                      onChange={(e) => handleValueChange(item.key, parseFloat(e.target.value) || 0)}
                      className="font-mono"
                      disabled={!canEdit}
                    />
                  ) : (
                    <Input
                      id={item.key}
                      type="text"
                      value={item.value as string}
                      onChange={(e) => handleValueChange(item.key, e.target.value)}
                      className="font-mono"
                      disabled={!canEdit}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
