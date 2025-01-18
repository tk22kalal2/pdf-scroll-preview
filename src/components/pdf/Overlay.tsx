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

  useEffect(() => {
    onChange(position);
  }, [position, onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.left, y: e.clientY - position.top });
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition(prev => ({
          ...prev,
          left: Math.max(0, e.clientX - dragStart.x),
          top: Math.max(0, e.clientY - dragStart.y)
        }));
      } else if (isResizing) {
        setPosition(prev => ({
          ...prev,
          width: Math.max(50, prev.width + (e.clientX - dragStart.x)),
          height: Math.max(50, prev.height + (e.clientY - dragStart.y))
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart]);

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
      <div
        className="absolute bottom-right w-4 h-4 bg-blue-500 cursor-se-resize -right-2 -bottom-2"
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
};