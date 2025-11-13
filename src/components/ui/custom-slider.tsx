import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CustomSliderProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    disabled?: boolean;
}

const CustomSlider = React.forwardRef<HTMLDivElement, CustomSliderProps>(
    ({ value, onChange, min = 0, max = 50, step = 1, className, disabled = false }, ref) => {
        const [isDragging, setIsDragging] = useState(false);
        const sliderRef = useRef<HTMLDivElement>(null);

        const getPercentage = useCallback(() => {
            return ((value - min) / (max - min)) * 100;
        }, [value, min, max]);

        const getValueFromPosition = useCallback((clientX: number) => {
            if (!sliderRef.current) return value;

            const rect = sliderRef.current.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
            const rawValue = min + (percentage / 100) * (max - min);
            const steppedValue = Math.round(rawValue / step) * step;

            return Math.max(min, Math.min(max, steppedValue));
        }, [min, max, step, value]);

        const handleMouseDown = useCallback((e: React.MouseEvent) => {
            if (disabled) return;
            e.preventDefault();
            setIsDragging(true);

            const newValue = getValueFromPosition(e.clientX);
            if (newValue !== value) {
                onChange(newValue);
            }
        }, [disabled, getValueFromPosition, value, onChange]);

        const handleMouseMove = useCallback((e: MouseEvent) => {
            if (!isDragging || disabled) return;

            const newValue = getValueFromPosition(e.clientX);
            if (newValue !== value) {
                onChange(newValue);
            }
        }, [isDragging, disabled, getValueFromPosition, value, onChange]);

        const handleMouseUp = useCallback(() => {
            setIsDragging(false);
        }, []);

        React.useEffect(() => {
            if (isDragging) {
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);

                return () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };
            }
        }, [isDragging, handleMouseMove, handleMouseUp]);

        return (
            <div
                ref={ref}
                className={cn(
                    "relative flex w-full touch-none select-none items-center h-6",
                    disabled && "opacity-50 cursor-not-allowed",
                    className
                )}
            >
                <div
                    ref={sliderRef}
                    className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-700 cursor-pointer"
                    onMouseDown={handleMouseDown}
                >
                    <div
                        className="absolute h-full bg-gradient-to-r from-[#861F41] to-[#E87722] rounded-full"
                        style={{ width: `${getPercentage()}%` }}
                    />
                    <div
                        className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-[#861F41] bg-white shadow-lg transition-all hover:scale-110 cursor-grab active:cursor-grabbing"
                        style={{ left: `calc(${getPercentage()}% - 10px)` }}
                    />
                </div>
            </div>
        );
    }
);

CustomSlider.displayName = 'CustomSlider';

export { CustomSlider };






