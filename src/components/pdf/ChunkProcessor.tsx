
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle, BookOpen } from "lucide-react";

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
  const isPageProcessing = status.includes('PAGE');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {isComplete ? (
              <CheckCircle className="h-12 w-12 text-green-500" />
            ) : (
              <div className="relative">
                {isPageProcessing ? (
                  <BookOpen className="h-12 w-12 text-blue-500" />
                ) : (
                  <FileText className="h-12 w-12 text-blue-500" />
                )}
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin absolute -top-1 -right-1" />
              </div>
            )}
          </div>
          
          <h3 className="text-lg font-semibold mb-2">
            {isComplete ? "Processing Complete!" : 
             isPageProcessing ? "Processing Pages Sequentially" :
             "Processing PDF Content"}
          </h3>
          
          <p className="text-gray-600 mb-4">
            {status}
          </p>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>
                {isPageProcessing ? `Page ${currentChunk} of ${totalChunks}` : 
                 `Chunk ${currentChunk} of ${totalChunks}`}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
          
          {isComplete ? (
            <p className="text-green-600 text-sm">
              All {isPageProcessing ? 'pages' : 'chunks'} processed successfully with preserved formatting hierarchy!
            </p>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                {isPageProcessing ? 
                  "Each page maintains formatting hierarchy from previous pages. This ensures complete information preservation and consistent numbering." :
                  "Each chunk maintains formatting hierarchy from previous chunks. This ensures complete information preservation."
                }
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
