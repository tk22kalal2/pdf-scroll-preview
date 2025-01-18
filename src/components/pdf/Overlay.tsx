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
  const [initialPosition, setInitialPosition] = useState({ top, left, width, height });
  const [currentPosition, setCurrentPosition] = useState({ top, left, width, height });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      setIsDragging(true);
      setDragStart({ 
        x: e.clientX - currentPosition.left, 
        y: e.clientY - currentPosition.top 
      });
      setInitialPosition(currentPosition);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPosition(currentPosition);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newLeft = Math.max(0, e.clientX - dragStart.x);
        const newTop = Math.max(0, e.clientY - dragStart.y);
        
        const newPosition = {
          ...currentPosition,
          left: newLeft,
          top: newTop
        };
        
        setCurrentPosition(newPosition);
        onChange(newPosition);
      } else if (isResizing && resizeHandle) {
        e.preventDefault();
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        let newPosition = { ...initialPosition };

        switch (resizeHandle) {
          case 'top-left':
            newPosition = {
              top: initialPosition.top + deltaY,
              left: initialPosition.left + deltaX,
              width: Math.max(50, initialPosition.width - deltaX),
              height: Math.max(50, initialPosition.height - deltaY)
            };
            break;
          case 'top-right':
            newPosition = {
              top: initialPosition.top + deltaY,
              left: initialPosition.left,
              width: Math.max(50, initialPosition.width + deltaX),
              height: Math.max(50, initialPosition.height - deltaY)
            };
            break;
          case 'bottom-left':
            newPosition = {
              top: initialPosition.top,
              left: initialPosition.left + deltaX,
              width: Math.max(50, initialPosition.width - deltaX),
              height: Math.max(50, initialPosition.height + deltaY)
            };
            break;
          case 'bottom-right':
            newPosition = {
              top: initialPosition.top,
              left: initialPosition.left,
              width: Math.max(50, initialPosition.width + deltaX),
              height: Math.max(50, initialPosition.height + deltaY)
            };
            break;
        }

        setCurrentPosition(newPosition);
        onChange(newPosition);
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
  }, [isDragging, isResizing, dragStart, resizeHandle, initialPosition]);

  return (
    <div
      ref={overlayRef}
      className="absolute bg-white border-2 border-blue-500 cursor-move opacity-80"
      style={{
        top: currentPosition.top,
        left: currentPosition.left,
        width: currentPosition.width,
        height: currentPosition.height,
      }}
      onMouseDown={handleMouseDown}
    >
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