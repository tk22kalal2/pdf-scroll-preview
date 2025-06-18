
import { Progress } from "@/components/ui/progress";
import { ProcessingProgress as ProgressType } from "@/utils/hierarchicalProcessor";

interface ProcessingProgressProps {
  progress: ProgressType;
  isVisible: boolean;
}

export const ProcessingProgress = ({ progress, isVisible }: ProcessingProgressProps) => {
  if (!isVisible) return null;
  
  const percentage = (progress.currentChunk / progress.totalChunks) * 100;
  
  const getPhaseDescription = (phase: string) => {
    switch (phase) {
      case 'analyzing': return 'Analyzing document structure...';
      case 'chunking': return 'Creating intelligent chunks...';
      case 'processing': return 'Processing content sections...';
      case 'merging': return 'Merging into final notes...';
      case 'complete': return 'Processing complete!';
      default: return 'Processing...';
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Processing Large Document</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{getPhaseDescription(progress.phase)}</span>
              <span>{progress.currentChunk}/{progress.totalChunks}</span>
            </div>
            <Progress value={percentage} className="w-full" />
          </div>
          
          <p className="text-sm text-gray-600">{progress.message}</p>
          
          {progress.totalChunks > 1 && (
            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
              <strong>Hierarchical Processing:</strong> Your document is being processed in {progress.totalChunks} sections 
              to ensure complete information and proper heading structure across all pages.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
