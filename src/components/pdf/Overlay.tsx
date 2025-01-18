import { useState, useEffect, useRef } from 'react';

interface OverlayProps {
  top: number;
  left: number;
  width: number;
  height: number;
  onChange: (position: { top: number; left: number; width: number; height: number }) => void;
}

export const Overlay = ({ top, left, width, height, onChange }: OverlayProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ top, left, width, height });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  useEffect(() => {
    onChange(position);
  }, [position, onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.left, y: e.clientY - position.top });
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newLeft = Math.max(0, e.clientX - dragStart.x);
        const newTop = Math.max(0, e.clientY - dragStart.y);
        
        setPosition(prev => ({
          ...prev,
          left: newLeft,
          top: newTop
        }));
      } else if (isResizing && resizeHandle) {
        e.preventDefault();
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        setPosition(prev => {
          let newPosition = { ...prev };

          switch (resizeHandle) {
            case 'top-left':
              newPosition = {
                ...prev,
                top: prev.top + deltaY,
                left: prev.left + deltaX,
                width: prev.width - deltaX,
                height: prev.height - deltaY
              };
              break;
            case 'top-right':
              newPosition = {
                ...prev,
                top: prev.top + deltaY,
                width: prev.width + deltaX,
                height: prev.height - deltaY
              };
              break;
            case 'bottom-left':
              newPosition = {
                ...prev,
                left: prev.left + deltaX,
                width: prev.width - deltaX,
                height: prev.height + deltaY
              };
              break;
            case 'bottom-right':
              newPosition = {
                ...prev,
                width: prev.width + deltaX,
                height: prev.height + deltaY
              };
              break;
          }

          // Ensure minimum dimensions
          newPosition.width = Math.max(50, newPosition.width);
          newPosition.height = Math.max(50, newPosition.height);

          return newPosition;
        });

        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeHandle]);

  return (
    <div
      ref={overlayRef}
      className="absolute bg-white border-2 border-blue-500 cursor-move"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Resize handles */}
      <div
        className="absolute w-3 h-3 bg-blue-500 cursor-nw-resize -left-1.5 -top-1.5"
        onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')}
      />
      <div
        className="absolute w-3 h-3 bg-blue-500 cursor-ne-resize -right-1.5 -top-1.5"
        onMouseDown={(e) => handleResizeMouseDown(e, 'top-right')}
      />
      <div
        className="absolute w-3 h-3 bg-blue-500 cursor-sw-resize -left-1.5 -bottom-1.5"
        onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-left')}
      />
      <div
        className="absolute w-3 h-3 bg-blue-500 cursor-se-resize -right-1.5 -bottom-1.5"
        onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')}
      />
    </div>
  );
};