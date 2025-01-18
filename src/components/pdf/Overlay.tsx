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
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = useState({ top, left, width, height });
  const [currentPosition, setCurrentPosition] = useState({ top, left, width, height });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  const getClientCoords = (event: MouseEvent | TouchEvent) => {
    if ('touches' in event) {
      return {
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY
      };
    }
    return {
      clientX: event.clientX,
      clientY: event.clientY
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.target === overlayRef.current) {
      setIsDragging(true);
      const coords = getClientCoords(e.nativeEvent);
      setStartPoint({ 
        x: coords.clientX - currentPosition.left, 
        y: coords.clientY - currentPosition.top 
      });
      setInitialPosition(currentPosition);
    }
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, handle: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    const coords = getClientCoords(e.nativeEvent);
    setStartPoint({ x: coords.clientX, y: coords.clientY });
    setInitialPosition(currentPosition);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const coords = getClientCoords(e);

      if (isDragging) {
        const newLeft = Math.max(0, coords.clientX - startPoint.x);
        const newTop = Math.max(0, coords.clientY - startPoint.y);
        
        const newPosition = {
          ...currentPosition,
          left: newLeft,
          top: newTop
        };
        
        setCurrentPosition(newPosition);
        onChange(newPosition);
      } else if (isResizing && resizeHandle) {
        e.preventDefault();
        const deltaX = coords.clientX - startPoint.x;
        const deltaY = coords.clientY - startPoint.y;
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

    const handleEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove);
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, isResizing, startPoint, initialPosition, resizeHandle]);

  return (
    <div
      ref={overlayRef}
      className="absolute bg-white border-2 border-blue-500 cursor-move opacity-90 touch-none"
      style={{
        top: currentPosition.top,
        left: currentPosition.left,
        width: currentPosition.width,
        height: currentPosition.height,
        zIndex: 1000,
      }}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      <div
        className="absolute w-6 h-6 bg-blue-500 cursor-nw-resize -left-3 -top-3 rounded-full"
        onMouseDown={(e) => handleResizeStart(e, 'top-left')}
        onTouchStart={(e) => handleResizeStart(e, 'top-left')}
      />
      <div
        className="absolute w-6 h-6 bg-blue-500 cursor-ne-resize -right-3 -top-3 rounded-full"
        onMouseDown={(e) => handleResizeStart(e, 'top-right')}
        onTouchStart={(e) => handleResizeStart(e, 'top-right')}
      />
      <div
        className="absolute w-6 h-6 bg-blue-500 cursor-sw-resize -left-3 -bottom-3 rounded-full"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
        onTouchStart={(e) => handleResizeStart(e, 'bottom-left')}
      />
      <div
        className="absolute w-6 h-6 bg-blue-500 cursor-se-resize -right-3 -bottom-3 rounded-full"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
        onTouchStart={(e) => handleResizeStart(e, 'bottom-right')}
      />
    </div>
  );
};