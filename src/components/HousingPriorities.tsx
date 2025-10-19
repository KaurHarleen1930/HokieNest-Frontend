import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { preferencesAPI } from "@/lib/api";
import { 
  DollarSign, 
  MapPin, 
  Shield, 
  Users, 
  Save, 
  RotateCcw,
  AlertCircle,
  Target
} from "lucide-react";

interface HousingPriorities {
  budget: number;
  commute: number;
  safety: number;
  roommates: number;
}

interface HousingPrioritiesProps {
  onSave?: (priorities: HousingPriorities) => void;
  readOnly?: boolean;
}

const defaultPriorities: HousingPriorities = {
  budget: 25,
  commute: 25,
  safety: 25,
  roommates: 25,
};

export const HousingPriorities = ({ onSave, readOnly = false }: HousingPrioritiesProps) => {
  const { toast } = useToast();
  const [priorities, setPriorities] = useState<HousingPriorities>(defaultPriorities);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing priorities on mount
  useEffect(() => {
    const loadPriorities = async () => {
      setLoading(true);
      try {
        const data = await preferencesAPI.getHousingPriorities();
        setPriorities(data);
      } catch (error) {
        console.error('Failed to load housing priorities:', error);
        // Use default priorities if loading fails
        setPriorities(defaultPriorities);
      } finally {
        setLoading(false);
      }
    };

    loadPriorities();
  }, []);

  const updatePriority = (type: keyof HousingPriorities, value: number) => {
    if (readOnly) return;
    
    setPriorities(prev => {
      const newPriorities = { ...prev, [type]: value };
      
      // Ensure total is 100 by adjusting other values proportionally
      const total = Object.values(newPriorities).reduce((sum, val) => sum + val, 0);
      if (total !== 100) {
        const remaining = 100 - value;
        const otherTypes = Object.keys(newPriorities).filter(k => k !== type) as (keyof HousingPriorities)[];
        
        if (remaining < 0) {
          // If the new value makes total > 100, cap it and adjust others to 0
          Object.keys(newPriorities).forEach(key => {
            if (key !== type) {
              newPriorities[key as keyof HousingPriorities] = Math.max(0, Math.floor(remaining / otherTypes.length));
            }
          });
        } else {
          // Distribute remaining among other priorities proportionally
          const otherTotal = otherTypes.reduce((sum, key) => sum + prev[key], 0);
          if (otherTotal > 0) {
            otherTypes.forEach(key => {
              const proportion = prev[key] / otherTotal;
              newPriorities[key] = Math.round(remaining * proportion);
            });
          } else {
            // If all others are 0, distribute evenly
            otherTypes.forEach(key => {
              newPriorities[key] = Math.round(remaining / otherTypes.length);
            });
          }
        }
      }
      
      return newPriorities;
    });
  };

  const resetToDefaults = () => {
    if (readOnly) return;
    setPriorities(defaultPriorities);
  };

  const handleSave = async () => {
    if (readOnly) return;
    
    const total = Object.values(priorities).reduce((sum, val) => sum + val, 0);
    if (total !== 100) {
      toast({
        title: "Invalid Priorities",
        description: "All priorities must total exactly 100%",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await preferencesAPI.saveHousingPriorities(priorities);
      toast({
        title: "Success",
        description: "Housing priorities saved successfully!",
      });
      onSave?.(priorities);
    } catch (error) {
      console.error('Failed to save housing priorities:', error);
      toast({
        title: "Error",
        description: "Failed to save housing priorities. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const total = Object.values(priorities).reduce((sum, val) => sum + val, 0);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Housing Priorities</CardTitle>
          <CardDescription>Loading your preferences...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Housing Priorities
        </CardTitle>
        <CardDescription>
          Set the relative importance of different factors for your housing search.
          Total must equal 100%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {total !== 100 && !readOnly && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Priorities must total exactly 100%. Current total: {total}%
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <PrioritySlider
            icon={DollarSign}
            label="Budget"
            value={priorities.budget}
            onChange={(value) => updatePriority('budget', value)}
            disabled={readOnly}
            description="How important is staying within your budget?"
          />
          
          <PrioritySlider
            icon={MapPin}
            label="Location/Commute"
            value={priorities.commute}
            onChange={(value) => updatePriority('commute', value)}
            disabled={readOnly}
            description="How important is proximity to campus/work?"
          />
          
          <PrioritySlider
            icon={Shield}
            label="Safety"
            value={priorities.safety}
            onChange={(value) => updatePriority('safety', value)}
            disabled={readOnly}
            description="How important is neighborhood safety?"
          />
          
          <PrioritySlider
            icon={Users}
            label="Roommate Compatibility"
            value={priorities.roommates}
            onChange={(value) => updatePriority('roommates', value)}
            disabled={readOnly}
            description="How important is finding compatible roommates?"
          />
        </div>

        <div className="pt-4 border-t space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Priority</span>
            <span className={`text-sm font-bold ${total === 100 ? 'text-green-600' : 'text-red-600'}`}>
              {total}%
            </span>
          </div>

          {!readOnly && (
            <div className="flex gap-3">
              <Button 
                onClick={handleSave} 
                disabled={saving || total !== 100}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Priorities'}
              </Button>
              <Button 
                onClick={resetToDefaults} 
                variant="outline"
                disabled={saving}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface PrioritySliderProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  description?: string;
}

const PrioritySlider = ({ 
  icon: Icon, 
  label, 
  value, 
  onChange, 
  disabled = false,
  description 
}: PrioritySliderProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <Label htmlFor={label.toLowerCase()} className="font-medium">
            {label}
          </Label>
        </div>
        <span className="text-sm font-bold text-primary">{value}%</span>
      </div>
      
      <Slider
        id={label.toLowerCase()}
        value={[value]}
        max={100}
        min={0}
        step={1}
        onValueChange={(vals) => onChange(vals[0])}
        disabled={disabled}
        className="w-full"
      />
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
};
