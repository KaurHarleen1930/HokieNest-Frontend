import { useCallback } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemePreferences } from "@/lib/theme";
import { useTheme } from "next-themes";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { preference, setPreference, loading } = useThemePreferences();
  const { resolvedTheme } = useTheme();

  const handleThemeChange = useCallback(
    async (value: string) => {
      if (value === preference) return;
      await setPreference(value as typeof themeOptions[number]["value"]);
    },
    [preference, setPreference]
  );

  const ActiveIcon = themeOptions.find((option) => option.value === preference)?.icon ??
    (resolvedTheme === "dark" ? Moon : Sun);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="Toggle theme"
          disabled={loading}
        >
          <ActiveIcon className="h-5 w-5" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 z-[10001]">
        <DropdownMenuRadioGroup value={preference} onValueChange={handleThemeChange}>
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="flex items-center gap-2 capitalize">
              <Icon className="h-4 w-4" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

