import { Slider } from "@/components/ui/slider";

type Props = {
  value: [number, number];
  onChange: (range: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
};

export default function PriceRange({
  value,
  onChange,
  min = 0,
  max = 5000,
  step = 1,
}: Props) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Price Range ($)</label>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange([vals[0], vals[1] ?? vals[0]])}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>${value[0]}</span>
        <span>${value[1]}</span>
      </div>
    </div>
  );
}
