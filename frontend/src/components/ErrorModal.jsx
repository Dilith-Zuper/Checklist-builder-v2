import React from 'react';
import { X, AlertTriangle, RefreshCw, FileText, Zap, HelpCircle } from 'lucide-react';

const ErrorModal = ({ error, onClose, onRetry = null }) => {
  const getErrorIcon = (errorType) => {
    switch (errorType) {
      case 'CHUNKING_ERROR':
        return <Zap className="w-6 h-6 text-orange-500" />;
      case 'AI_PROCESSING_ERROR':
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
      case 'FILE_PARSING_ERROR':
        return <FileText className="w-6 h-6 text-blue-500" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
    }
  };

  const getErrorColor = (errorType) => {
    switch (errorType) {
      case 'CHUNKING_ERROR':
        return 'orange';
      case 'AI_PROCESSING_ERROR':
        return 'red';
      case 'FILE_PARSING_ERROR':
        return 'blue';
      default:
        return 'red';
    }
  };

  const getSolutionSteps = (errorType) => {
    switch (errorType) {
      case 'CHUNKING_ERROR':
        return [
          'Try uploading a smaller Excel file (fewer rows)',
          'Check if the file format follows the expected structure',
          'Ensure stable internet connection during processing',
          'Contact support if the issue persists with valid files'
        ];
      case 'AI_PROCESSING_ERROR':
        return [
          'Wait a moment and try again (AI service may be busy)',
          'Check if your Excel data is clean and properly formatted',
          'Try breaking large files into smaller chunks manually',
          'Contact support if repeated failures occur'
        ];
      case 'FILE_PARSING_ERROR':
        return [
          'Ensure the file is a valid Excel format (.xlsx or .xls)',
          'Check that the file is not corrupted',
          'Verify the file follows the expected column structure',
          'Try saving the file again from Excel and re-uploading'
        ];
      default:
        return [
          'Try the operation again',
          'Check your internet connection',
          'Verify all required fields are filled',
          'Contact support if the problem continues'
        ];
    }
  };

  const errorType = error?.details?.type || 'UNKNOWN_ERROR';
  const colorClass = getErrorColor(errorType);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`bg-${colorClass}-50 border-b border-${colorClass}-200 p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getErrorIcon(errorType)}
              <div>
                <h3 className={`text-xl font-bold text-${colorClass}-800`}>
                  Processing Error
                </h3>
                <p className={`text-sm text-${colorClass}-600`}>
                  {error?.details?.type?.replace(/_/g, ' ') || 'An error occurred'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`text-${colorClass}-400 hover:text-${colorClass}-600 transition-colors`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[60vh]">
          {/* Error Message */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-800 mb-2">What happened:</h4>
            <div className={`bg-${colorClass}-50 border border-${colorClass}-200 rounded-lg p-4`}>
              <p className={`text-${colorClass}-800`}>
                {error?.message || 'An unexpected error occurred during processing.'}
              </p>
              {error?.details?.message && (
                <p className={`text-sm text-${colorClass}-600 mt-2`}>
                  {error.details.message}
                </p>
              )}
            </div>
          </div>

          {/* Technical Details (if available) */}
          {error?.details && (
            <div className="mb-6">
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-800">
                  <HelpCircle className="w-4 h-4" />
                  <span className="font-medium">Technical Details</span>
                  <span className="text-xs text-gray-400 group-open:hidden">Click to expand</span>
                </summary>
                <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {error.details.statusCode && (
                      <div>
                        <span className="font-medium text-gray-600">Status Code:</span>
                        <span className="ml-2 text-gray-800">{error.details.statusCode}</span>
                      </div>
                    )}
                    {error.code && (
                      <div>
                        <span className="font-medium text-gray-600">Error Code:</span>
                        <span className="ml-2 text-gray-800">{error.code}</span>
                      </div>
                    )}
                    {error.timestamp && (
                      <div>
                        <span className="font-medium text-gray-600">Timestamp:</span>
                        <span className="ml-2 text-gray-800">
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>
          )}

          {/* Solution Steps */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              How to resolve this:
            </h4>
            <div className="space-y-3">
              {getSolutionSteps(errorType).map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full bg-${colorClass}-100 text-${colorClass}-600 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5`}>
                    {index + 1}
                  </div>
                  <p className="text-gray-700">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chunking Information (if relevant) */}
          {errorType === 'CHUNKING_ERROR' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h5 className="font-medium text-blue-800 mb-2">About Chunked Processing:</h5>
              <p className="text-sm text-blue-700">
                Large files are automatically split into smaller chunks for processing. 
                This error suggests an issue with one or more chunks. The system includes 
                retry logic, but some chunks may have failed after multiple attempts.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`bg-gray-50 px-6 py-4 flex items-center justify-between border-t`}>
          <div className="text-sm text-gray-500">
            Need help? Contact the Zuper Implementation Team
          </div>
          <div className="flex gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className={`px-4 py-2 bg-${colorClass}-600 text-white rounded-lg hover:bg-${colorClass}-700 transition-colors flex items-center gap-2`}
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;