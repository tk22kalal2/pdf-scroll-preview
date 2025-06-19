
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle } from "lucide-react";

interface ChunkProcessorProps {
  isVisible: boolean;
  currentChunk: number;
  totalChunks: number;
  status: string;
  onCancel?: () => void;
}

export const ChunkProcessor = ({ 
  isVisible, 
  currentChunk, 
  totalChunks, 
  status, 
  onCancel 
}: ChunkProcessorProps) => {
  if (!isVisible) return null;

  const progress = totalChunks > 0 ? (currentChunk / totalChunks) * 100 : 0;
  const isComplete = currentChunk === totalChunks && totalChunks > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {isComplete ? (
              <CheckCircle className="h-12 w-12 text-green-500" />
            ) : (
              <div className="relative">
                <FileText className="h-12 w-12 text-blue-500" />
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin absolute -top-1 -right-1" />
              </div>
            )}
          </div>
          
          <h3 className="text-lg font-semibold mb-2">
            {isComplete ? "Processing Complete!" : "Processing PDF in Chunks"}
          </h3>
          
          <p className="text-gray-600 mb-4">
            {status}
          </p>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Chunk {currentChunk} of {totalChunks}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
          
          {isComplete ? (
            <p className="text-green-600 text-sm">
              All chunks processed successfully with preserved formatting!
            </p>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Each chunk maintains formatting hierarchy from previous chunks.
                This ensures complete information preservation.
              </p>
              
              {onCancel && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onCancel}
                  disabled={isComplete}
                >
                  Cancel Processing
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
