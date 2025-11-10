import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Preset = "7d" | "30d" | "90d" | "1y";

export function SafetyControls(props: {
  enabled: boolean; onToggle: (v: boolean) => void;
  preset: Preset; onPresetChange: (p: Preset) => void;
  mode: "clusters" | "heat"; onModeChange: (m: "clusters" | "heat") => void;
}) {
  const chips: Preset[] = ["7d", "30d", "90d", "1y"];

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface/95 border border-border shadow-lg p-3 text-foreground backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Safety</span>
        <Switch checked={props.enabled} onCheckedChange={props.onToggle} />
      </div>

      {props.enabled && (
        <>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1 transition-all">
            {chips.map(c => (
              <Button
                key={c}
                variant={props.preset === c ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "rounded-full",
                  c === props.preset && "ring-2 ring-primary"
                )}
                onClick={() => props.onPresetChange(c)}
              >
                {c}
              </Button>
            ))}
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={props.mode === "clusters" ? "default" : "ghost"}
              onClick={() => props.onModeChange("clusters")}
              disabled={!props.enabled}
            >
              Clusters
            </Button>
            <Button
              size="sm"
              variant={props.mode === "heat" ? "default" : "ghost"}
              onClick={() => props.onModeChange("heat")}
              disabled={!props.enabled}
            >
              Heat
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
