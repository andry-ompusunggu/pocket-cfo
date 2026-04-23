// src/components/ModeToggle.tsx
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  // Logika putaran: System -> Light -> Dark -> System
  const cycleTheme = () => {
    if (theme === 'system') setTheme('light')
    else if (theme === 'light') setTheme('dark')
    else setTheme('system')
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={cycleTheme} 
      className="h-7 w-7 lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
      title={`Theme: ${theme}`}
    >
      {theme === 'light' ? (
        <Sun size={14} className="text-amber-500" />
      ) : theme === 'dark' ? (
        <Moon size={14} className="text-primary" />
      ) : (
        <Monitor size={14} className="text-muted-foreground" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}