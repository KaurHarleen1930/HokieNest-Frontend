import { useRef, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Upload, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in MB
  children?: ReactNode;
  className?: string;
}

export function FileUpload({ 
  onFileSelect, 
  accept = "*/*", 
  maxSize = 10, 
  children,
  className 
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }

    onFileSelect(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      
      {children ? (
        <div onClick={handleClick} className="cursor-pointer">
          {children}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Upload File
        </Button>
      )}
    </div>
  );
}

interface FilePreviewProps {
  file: File;
  onRemove: () => void;
  className?: string;
}

export function FilePreview({ file, onRemove, className }: FilePreviewProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
    return '📎';
  };

  return (
    <div className={cn(
      "flex items-center space-x-3 p-3 bg-muted/50 rounded-lg border",
      className
    )}>
      <span className="text-2xl">{getFileIcon(file.type)}</span>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{file.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
