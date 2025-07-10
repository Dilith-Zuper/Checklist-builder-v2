import React, { useState, useRef } from 'react';
import { Upload, FileText, Check, X, Loader2, Settings, Send, AlertCircle, Eye, Code, RefreshCw, Clock, BarChart3 } from 'lucide-react';
import Select from 'react-select';
import ErrorModal from './ErrorModal';

const ZuperChecklistTool = () => {
  const [activeTab, setActiveTab] = useState(1);
  const [config, setConfig] = useState({
    apiKey: '',
    region: '',
    categoryUid: '',
    statusUid: ''
  });
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [categoriesFetched, setCategoriesFetched] = useState(false);
  
  const [file, setFile] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [showPayloadPreview, setShowPayloadPreview] = useState(false);
  const [previewPayload, setPreviewPayload] = useState(null);
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Enhanced error handling state
  const [detailedError, setDetailedError] = useState(null);
  
  // Enhanced state for real-time progress tracking
  const [processingProgress, setProcessingProgress] = useState({
    show: false,
    currentChunk: 0,
    totalChunks: 0,
    currentAttempt: 0,
    maxAttempts: 0,
    status: '',
    percentage: 0,
    estimatedTime: '',
    startTime: null,
    errors: [],
    isComplete: false
  });

  // Question type mapping
  const questionTypes = [
    { label: 'Multi Line Input', value: 'textArea' },
    { label: 'Single Line Input', value: 'textField' },
    { label: 'Date Input', value: 'date' },
    { label: 'Time Input', value: 'time' },
    { label: 'DateTime Input', value: 'dateTime' },
    { label: 'Dropdown', value: 'dropdown' },
    { label: 'Checkbox', value: 'checkbox' },
    { label: 'Radio Button', value: 'radio' },
    { label: 'Multiple Picture', value: 'multiImage' },
    { label: 'Signature', value: 'signature' },
    { label: 'Section Header', value: 'header' }
  ];

  // Region options
  const regionOptions = [
    { value: 'us-east-1', label: 'US East 1' },
    { value: 'us-west-1c', label: 'US West 1C' },
    { value: 'eu-central-1', label: 'EU Central 1' },
    { value: 'apac-mumbai', label: 'APAC Mumbai' },
    { value: 'ap-southeast-2', label: 'AP Southeast 2' },
    { value: 'staging', label: 'Staging' }
  ];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const validateApiConfig = () => {
    const newErrors = {};
    if (!config.apiKey.trim()) newErrors.apiKey = 'API Key is required';
    if (!config.region.trim()) newErrors.region = 'Region is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateFullConfig = () => {
    const newErrors = {};
    if (!config.apiKey.trim()) newErrors.apiKey = 'API Key is required';
    if (!config.region.trim()) newErrors.region = 'Region is required';
    if (!selectedCategory) newErrors.category = 'Category is required';
    if (!selectedStatus) newErrors.status = 'Status is required';
    if (!file) newErrors.file = 'Excel file is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Reset dependent fields when API key or region changes
    if (field === 'apiKey' || field === 'region') {
      setCategoriesFetched(false);
      setCategories([]);
      setStatuses([]);
      setSelectedCategory(null);
      setSelectedStatus(null);
      setErrors(prev => ({ 
        ...prev, 
        category: '', 
        status: '' 
      }));
    }
  };

  // API Base URL with fallback
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Fetch categories from API
  const fetchCategories = async () => {
    if (!validateApiConfig()) return;
    
    setLoadingCategories(true);
    try {
      console.log('🔍 Fetching categories from:', `${API_BASE_URL}/api/checklist/zuper/categories`);
      
      const response = await fetch(
        `${API_BASE_URL}/api/checklist/zuper/categories`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'x-region': config.region
          }
        }
      );

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        
        if (errorText.includes('<!doctype') || errorText.includes('<html')) {
          throw new Error('API endpoint not found. Please check if the backend server is running on port 3001.');
        }
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to fetch categories');
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log('✅ Categories response:', result);
      
      setCategories(result.categories || []);
      setCategoriesFetched(true);
      showToast('Categories loaded successfully!');
    } catch (error) {
      console.error('❌ Categories fetch error:', error);
      showToast(error.message || 'Failed to fetch categories. Please check your API key and region.', 'error');
    } finally {
      setLoadingCategories(false);
    }
  };

  // Fetch statuses based on selected category
  const fetchStatuses = async (categoryUid) => {
    setLoadingStatuses(true);
    try {
      console.log('🔍 Fetching statuses from:', `${API_BASE_URL}/api/checklist/zuper/statuses?category_uid=${categoryUid}`);
      
      const response = await fetch(
        `${API_BASE_URL}/api/checklist/zuper/statuses?category_uid=${categoryUid}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'x-region': config.region
          }
        }
      );

      console.log('📥 Statuses response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Statuses error response:', errorText);
        
        if (errorText.includes('<!doctype') || errorText.includes('<html')) {
          throw new Error('API endpoint not found. Please check if the backend server is running.');
        }
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to fetch statuses');
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log('✅ Statuses response:', result);
      
      setStatuses(result.statuses || []);
      showToast('Statuses loaded successfully!');
    } catch (error) {
      console.error('❌ Statuses fetch error:', error);
      showToast(error.message || 'Failed to fetch statuses.', 'error');
    } finally {
      setLoadingStatuses(false);
    }
  };

  // Handle category selection
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedStatus(null);
    setStatuses([]);
    setConfig(prev => ({ ...prev, categoryUid: category.id }));
    
    if (errors.category) {
      setErrors(prev => ({ ...prev, category: '' }));
    }
    
    fetchStatuses(category.id);
  };

  // Handle status selection
  const handleStatusChange = (status) => {
    setSelectedStatus(status);
    setConfig(prev => ({ ...prev, statusUid: status.id }));
    
    if (errors.status) {
      setErrors(prev => ({ ...prev, status: '' }));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (selectedFile) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!validTypes.includes(selectedFile.type)) {
      setErrors(prev => ({ ...prev, file: 'Please select a valid Excel file (.xlsx or .xls)' }));
      return;
    }
    
    if (selectedFile.size > 20 * 1024 * 1024) { // 20MB limit
      setErrors(prev => ({ ...prev, file: 'File size must be less than 20MB' }));
      return;
    }
    
    setFile(selectedFile);
    if (errors.file) {
      setErrors(prev => ({ ...prev, file: '' }));
    }
  };

  const handleFileInput = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelection(selectedFile);
    }
  };

  // Calculate estimated remaining time
  const getEstimatedTimeRemaining = () => {
    if (!processingProgress.startTime || processingProgress.totalChunks === 0 || processingProgress.currentChunk === 0) {
      return 'Calculating...';
    }
    
    const elapsed = Date.now() - processingProgress.startTime;
    const chunksCompleted = processingProgress.currentChunk;
    
    if (chunksCompleted === 0) return 'Calculating...';
    
    const avgTimePerChunk = elapsed / chunksCompleted;
    const remainingChunks = processingProgress.totalChunks - chunksCompleted;
    const estimatedRemaining = remainingChunks * avgTimePerChunk;
    
    const minutes = Math.floor(estimatedRemaining / 60000);
    const seconds = Math.floor((estimatedRemaining % 60000) / 1000);
    
    if (minutes > 0) {
      return `~${minutes}m ${seconds}s remaining`;
    } else if (seconds > 0) {
      return `~${seconds}s remaining`;
    } else {
      return 'Almost done...';
    }
  };

  // Enhanced function to extract checklist from Excel file with real-time progress
  const extractChecklist = async () => {
    if (!validateFullConfig()) return;
    
    setLoading(true);
    setProcessingProgress({
      show: true,
      currentChunk: 0,
      totalChunks: 0,
      currentAttempt: 0,
      maxAttempts: 0,
      status: 'Preparing file...',
      percentage: 0,
      estimatedTime: '',
      startTime: Date.now(),
      errors: [],
      isComplete: false
    });

    let progressEventSource = null;

    try {
      console.log('🚀 Extracting checklist from:', `${API_BASE_URL}/api/extract-checklist`);
      
      // Start listening for progress updates via Server-Sent Events
      try {
        progressEventSource = new EventSource(`${API_BASE_URL}/api/progress-stream`);
        
        progressEventSource.onmessage = (event) => {
          try {
            const progressData = JSON.parse(event.data);
            console.log('📊 Real-time progress update:', progressData);
            
            if (progressData.type !== 'connected') {
              setProcessingProgress(prev => ({
                ...prev,
                currentChunk: progressData.currentChunk || prev.currentChunk,
                totalChunks: progressData.totalChunks || prev.totalChunks,
                currentAttempt: progressData.currentAttempt || prev.currentAttempt,
                maxAttempts: progressData.maxAttempts || prev.maxAttempts,
                status: progressData.status || prev.status,
                percentage: progressData.percentage || prev.percentage,
                isComplete: progressData.percentage === 100
              }));
            }
          } catch (error) {
            console.error('❌ Error parsing progress data:', error);
          }
        };

        progressEventSource.onerror = (error) => {
          console.warn('⚠️ Progress stream error, continuing without real-time updates:', error);
        };
      } catch (error) {
        console.warn('⚠️ Could not establish progress stream, continuing without real-time updates');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('categoryUid', config.categoryUid);
      formData.append('statusUid', config.statusUid);
      formData.append('apiKey', config.apiKey);
      formData.append('region', config.region);
      formData.append('enableProgress', 'true');

      const response = await fetch(
        `${API_BASE_URL}/api/extract-checklist`,
        {
          method: 'POST',
          body: formData,
        }
      );

      console.log('📥 Extract response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Extract error response:', errorText);
        
        if (errorText.includes('<!doctype') || errorText.includes('<html')) {
          throw new Error('API endpoint not found. Please check if the backend server is running.');
        }
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.details) {
            setDetailedError(errorData);
            return;
          }
          throw new Error(errorData.error || 'Failed to extract checklist');
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log("📦 Extracted result from backend:", result);
      
      // Process the checklist
      const extractedChecklist = result.checklist || [];
      const processedChecklist = extractedChecklist.map(item => ({
        id: item.id,
        question: item.question || '',
        type: item.type || 'textField',
        options: item.options || '',
        required: Boolean(item.required),
        isDependent: Boolean(item.isDependent),
        dependentOn: item.dependentOn || '',
        dependentOptions: item.dependentOptions || ''
      }));
      
      console.log("🔧 Processed checklist with dependency fields:", processedChecklist);
      
      setChecklist(processedChecklist);
      setActiveTab(2);
      
      // Update progress to complete
      setProcessingProgress(prev => ({
        ...prev,
        currentChunk: prev.totalChunks || 1,
        totalChunks: prev.totalChunks || 1,
        status: 'Processing complete!',
        percentage: 100,
        isComplete: true
      }));
      
      const itemCount = processedChecklist.length;
      const processingStats = result.metadata?.processingStats;
      
      let successMessage = `Successfully extracted ${itemCount} checklist items!`;
      if (processingStats) {
        successMessage += ` (Processed ${processingStats.totalChunks} chunks)`;
      }
      
      showToast(successMessage);
      
      if (result.validation?.warnings?.length > 0) {
        console.warn('Processing warnings:', result.validation.warnings);
      }
      
    } catch (error) {
      console.error('❌ Extraction error:', error);
      
      setProcessingProgress(prev => ({
        ...prev,
        errors: [...prev.errors, error.message],
        status: `Error: ${error.message}`,
        isComplete: true
      }));
      
      showToast(error.message || 'Failed to extract checklist. Please try again.', 'error');
    } finally {
      setLoading(false);
      
      // Close progress stream
      if (progressEventSource) {
        progressEventSource.close();
      }
      
      // Hide progress after a delay
      setTimeout(() => {
        setProcessingProgress(prev => ({ ...prev, show: false }));
      }, 3000);
    }
  };

  const updateChecklistItem = (id, field, value) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeChecklistItem = (id) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
  };

  const addChecklistItem = () => {
    const newId = Math.max(...checklist.map(item => item.id), 0) + 1;
    setChecklist(prev => [...prev, {
      id: newId,
      question: '',
      type: 'textField',
      options: '',
      required: false,
      isDependent: false,    
      dependentOn: '',      
      dependentOptions: ''  
    }]);
  };

  const generateZuperPayload = () => {
    const mapTypeToComponent = (type) => {
      const mapping = {
        'textArea': 'textArea',
        'textField': 'textField',
        'date': 'date',
        'time': 'time',
        'dateTime': 'dateTime',
        'dropdown': 'dropdown',
        'checkbox': 'checkbox',
        'radio': 'radio',
        'multiImage': 'multiImage',
        'signature': 'signature',
        'header': 'header'
      };
      return mapping[type] || 'textField';
    };

    return {
      category_uid: config.categoryUid,
      job_status_uid: config.statusUid,
      checklist: checklist.map((item, index) => ({
        id: index + 1,
        component: mapTypeToComponent(item.type),
        editable: true,
        index: index,
        label: item.question,
        description: "",
        placeholder: "",
        options: item.options ? item.options.split(',').map(opt => opt.trim()).filter(opt => opt) : [],
        required: item.required,
        validation: "/.*/",
        hide_to_fe: false,
        is_dependent: item.isDependent,
        dependent_on: item.dependentOn,
        dependent_options: item.dependentOptions
          ? item.dependentOptions.split(',').map(opt => opt.trim()).filter(opt => opt !== '')
          : [],
        attributes: {},
        hide_field: false,
        read_only: false,
        regex_value: "",
        min_value: null,
        max_value: null,
        default_option: null,
        group: "Default",
        dependents: [],
        restrict_status_update: {},
        meta_options: {
          restrict_status_update: {
            is_enabled: false,
            restricted_options: []
          }
        },
        checklist_view_type: "SINGLE_PAGE"
      })),
      prefill_checklist: false
    };
  };

  const previewPayloadHandler = async () => {
    try {
      const payload = generateZuperPayload();
      setPreviewPayload(payload);
      setShowPayloadPreview(true);
    } catch (error) {
      showToast('Failed to generate payload preview', 'error');
    }
  };

  const submitToZuper = async () => {
    setLoading(true);
    try {
      console.log('🚀 Submitting to Zuper via:', `${API_BASE_URL}/api/submit-checklist`);
      console.log("🔍 Sending checklist data:", checklist);
      console.log("📤 Config:", JSON.stringify(config, null, 2));
      
      const response = await fetch(
        `${API_BASE_URL}/api/submit-checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            checklist: checklist,
            config: config,
          }),
        }
      );

      console.log('📥 Submit response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Submit error response:', errorText);
        
        if (errorText.includes('<!doctype') || errorText.includes('<html')) {
          throw new Error('API endpoint not found. Please check if the backend server is running.');
        }
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.details) {
            setDetailedError(errorData);
            return;
          }
          throw new Error(errorData.error || 'Failed to submit checklist');
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log('✅ Submit result:', result);
      
      showToast('Checklist submitted successfully to Zuper!');
      
      setTimeout(() => {
        setActiveTab(1);
        setChecklist([]);
        setFile(null);
        setConfig({ apiKey: '', region: '', categoryUid: '', statusUid: '' });
        setCategories([]);
        setStatuses([]);
        setSelectedCategory(null);
        setSelectedStatus(null);
        setCategoriesFetched(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    } catch (error) {
      console.error('❌ Submission error:', error);
      showToast(error.message || 'Failed to submit checklist. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isConfigValid = config.apiKey && config.region && selectedCategory && selectedStatus && file;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Enhanced Error Modal */}
      {detailedError && (
        <ErrorModal 
          error={detailedError} 
          onClose={() => setDetailedError(null)}
          onRetry={() => {
            setDetailedError(null);
            extractChecklist();
          }}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Settings className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Checklist Builder - Implementation Team</h1>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 toast-enter ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
            {toast.message}
          </div>
        </div>
      )}

      {/* Enhanced Real-time Progress Modal */}
      {processingProgress.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-backdrop">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  {processingProgress.isComplete ? (
                    <Check className="w-8 h-8 text-green-600" />
                  ) : (
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  )}
                  <BarChart3 className="w-4 h-4 text-blue-400 absolute top-1 right-1" />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {processingProgress.isComplete ? 'Processing Complete!' : 'Processing Checklist'}
              </h3>
              
              {/* Real-time chunk progress */}
              {processingProgress.totalChunks > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span className="font-medium">
                      {processingProgress.totalChunks > 1 ? (
                        `Chunk ${processingProgress.currentChunk} of ${processingProgress.totalChunks}`
                      ) : (
                        'Processing single chunk'
                      )}
                    </span>
                    {processingProgress.maxAttempts > 1 && (
                      <span className="text-xs">
                        Attempt {processingProgress.currentAttempt}/{processingProgress.maxAttempts}
                      </span>
                    )}
                  </div>
                  
                  {/* Enhanced Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 relative overflow-hidden ${
                        processingProgress.isComplete 
                          ? 'bg-gradient-to-r from-green-500 to-green-600' 
                          : 'bg-gradient-to-r from-blue-500 to-blue-600'
                      }`}
                      style={{ 
                        width: `${processingProgress.percentage || (processingProgress.totalChunks > 0 ? (processingProgress.currentChunk / processingProgress.totalChunks) * 100 : 0)}%` 
                      }}
                    >
                      {/* Animated shimmer effect */}
                      {!processingProgress.isComplete && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress percentage */}
                  <div className={`text-xs font-semibold mb-2 ${
                    processingProgress.isComplete ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {processingProgress.percentage || (processingProgress.totalChunks > 0 ? 
                      Math.round((processingProgress.currentChunk / processingProgress.totalChunks) * 100) : 0)}% Complete
                  </div>
                  
                  {/* Time estimation */}
                  {!processingProgress.isComplete && (
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{getEstimatedTimeRemaining()}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Status message */}
              <p className="text-gray-600 mb-4 min-h-[1.5rem]">
                {processingProgress.status || 'Processing your checklist...'}
              </p>
              
              {/* Error messages */}
              {processingProgress.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">Processing Issues:</span>
                  </div>
                  {processingProgress.errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-600">{error}</p>
                  ))}
                </div>
              )}
              
              {/* Info message */}
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                {processingProgress.totalChunks > 1 ? (
                  <>
                    <BarChart3 className="w-3 h-3 inline mr-1" />
                    Large file processing: {processingProgress.totalChunks} chunks for optimal performance
                  </>
                ) : (
                  'Processing your checklist with AI...'
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payload Preview Modal */}
      {showPayloadPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-backdrop">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Code className="w-6 h-6 text-blue-600" />
                Zuper Payload Preview
              </h3>
              <button
                onClick={() => setShowPayloadPreview(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[70vh] payload-scroll">
              <div className="bg-gray-900 rounded-lg p-4 overflow-auto">
                <pre className="text-green-400 text-sm whitespace-pre-wrap font-mono">
                  {JSON.stringify(previewPayload, null, 2)}
                </pre>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(previewPayload, null, 2));
                    showToast('Payload copied to clipboard!');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium"
                >
                  Copy JSON
                </button>
                <button
                  onClick={() => setShowPayloadPreview(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        {/* Tab Navigation */}
        <div className="flex mb-8 bg-white rounded-2xl shadow-lg p-2">
          <button
            onClick={() => setActiveTab(1)}
            className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 tab-button ${
              activeTab === 1 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Upload className="w-5 h-5" />
            Config & Upload
          </button>
          <button
            onClick={() => isConfigValid && setActiveTab(2)}
            disabled={!isConfigValid}
            className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 tab-button ${
              activeTab === 2 
                ? 'bg-blue-600 text-white shadow-md' 
                : isConfigValid
                  ? 'text-gray-600 hover:bg-gray-50'
                  : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            <FileText className="w-5 h-5" />
            Review & Submit
          </button>
        </div>

        {/* Tab 1: Configuration & Upload */}
        {activeTab === 1 && (
          <div className="space-y-8">
            {/* API Configuration Card */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <Settings className="w-6 h-6 text-blue-600" />
                API Configuration
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company API Key *
                  </label>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                    placeholder="Enter your API key"
                    className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.apiKey ? 'border-red-500 bg-red-50' : ''
                    }`}
                  />
                  {errors.apiKey && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.apiKey}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Region *
                  </label>
                  <select
                    value={config.region}
                    onChange={(e) => handleConfigChange('region', e.target.value)}
                    className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.region ? 'border-red-500 bg-red-50' : ''
                    }`}
                  >
                    <option value="">Select Region</option>
                    {regionOptions.map(region => (
                      <option key={region.value} value={region.value}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                  {errors.region && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.region}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-center mt-6">
                <button
                  onClick={fetchCategories}
                  disabled={!config.apiKey || !config.region || loadingCategories}
                  className={`px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 flex items-center gap-3 shadow-lg ${
                    loadingCategories ? 'animate-pulse' : ''
                  }`}
                >
                  {loadingCategories ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  {loadingCategories ? 'Fetching Categories...' : 'Fetch Categories'}
                </button>
              </div>
            </div>

            {/* Category Selection Card */}
            {categoriesFetched && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                  Category Selection
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Category *
                    </label>
                    <select
                      value={selectedCategory?.id || ''}
                      onChange={(e) => {
                        const category = categories.find(cat => cat.id === e.target.value);
                        if (category) handleCategoryChange(category);
                      }}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        errors.category ? 'border-red-500 bg-red-50' : ''
                      }`}
                    >
                      <option value="">Choose a category</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {errors.category && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.category}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Status Selection Card */}
            {selectedCategory && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  <Check className="w-6 h-6 text-blue-600" />
                  Status Selection
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Status *
                    </label>
                    {loadingStatuses ? (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        <span className="text-gray-600">Loading statuses...</span>
                      </div>
                    ) : (
                      <select
                        value={selectedStatus?.id || ''}
                        onChange={(e) => {
                          const status = statuses.find(stat => stat.id === e.target.value);
                          if (status) handleStatusChange(status);
                        }}
                        className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                          errors.status ? 'border-red-500 bg-red-50' : ''
                        }`}
                      >
                        <option value="">Choose a status</option>
                        {statuses.map(status => (
                          <option key={status.id} value={status.id}>
                            {status.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {errors.status && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.status}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* File Upload Card */}
            {selectedStatus && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  <Upload className="w-6 h-6 text-blue-600" />
                  Upload Checklist File
                </h2>
                
                <div
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : errors.file 
                        ? 'border-red-500 bg-red-50' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <div className="space-y-4">
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                      file ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {file ? (
                        <Check className="w-8 h-8 text-green-600" />
                      ) : (
                        <Upload className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-700">
                        {file ? file.name : 'Drop your Excel file here or click to browse'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Supports .xlsx and .xls files (max 20MB)
                      </p>
                      {file && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-gray-400">
                            Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          {file.size > 1024 * 1024 && (
                            <p className="text-xs text-blue-600 flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              Large file will be processed in chunks for optimal performance
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {errors.file && (
                  <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.file}
                  </p>
                )}
              </div>
            )}

            {/* Extract Button */}
            {file && (
              <div className="flex justify-center">
                <button
                  onClick={extractChecklist}
                  disabled={!isConfigValid || loading}
                  className={`px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 flex items-center gap-3 shadow-lg ${
                    loading ? 'animate-pulse' : ''
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                  {loading ? 'Extracting Checklist...' : 'Extract Checklist'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Review & Submit */}
        {activeTab === 2 && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                  Review Checklist ({checklist.length} items)
                </h2>
                <button
                  onClick={addChecklistItem}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-medium"
                >
                  + Add Item
                </button>
              </div>

              {checklist.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No checklist items found</p>
                  <p className="text-sm">Go back to extract checklist from your Excel file</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {checklist.map((item, index) => (
                    <div key={item.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200">
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Question
                          </label>
                          <input
                            type="text"
                            value={item.question}
                            onChange={(e) => updateChecklistItem(item.id, 'question', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            placeholder="Enter question text"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Type
                          </label>
                          <select
                            value={item.type}
                            onChange={(e) => updateChecklistItem(item.id, 'type', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          >
                            {questionTypes.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Required
                          </label>
                          <div className="flex items-center pt-2">
                            <input
                              type="checkbox"
                              checked={item.required}
                              onChange={(e) => updateChecklistItem(item.id, 'required', e.target.checked)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="ml-2 text-sm text-gray-700">Required field</label>
                          </div>
                        </div>
                      </div>
                      
                      {/* Dependency Fields Section */}
                      <div className="mt-4 border-t pt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Is Dependent
                            </label>
                            <div className="flex items-center pt-2">
                              <input
                                type="checkbox"
                                checked={item.isDependent}
                                onChange={(e) => updateChecklistItem(item.id, 'isDependent', e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label className="ml-2 text-sm text-gray-700">Mark as dependent field</label>
                            </div>
                          </div>

                          {item.isDependent && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Dependent Question
                                </label>
                                <input
                                  type="text"
                                  value={item.dependentOn}
                                  onChange={(e) => updateChecklistItem(item.id, 'dependentOn', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter the question this depends on"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Dependent Options
                                </label>
                                <input
                                  type="text"
                                  value={item.dependentOptions}
                                  onChange={(e) => updateChecklistItem(item.id, 'dependentOptions', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter dependent options (comma-separated)"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {['dropdown', 'radio', 'checkbox'].includes(item.type) && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Options (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={item.options}
                            onChange={(e) => updateChecklistItem(item.id, 'options', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            placeholder="Option 1, Option 2, Option 3"
                          />
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Item #{index + 1}</span>
                        <button
                          onClick={() => removeChecklistItem(item.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {checklist.length > 0 && (
              <div className="flex justify-center gap-4">
                <button
                  onClick={previewPayloadHandler}
                  className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transform hover:scale-105 transition-all duration-200 flex items-center gap-3 shadow-lg"
                >
                  <Eye className="w-5 h-5" />
                  Preview Payload
                </button>
                <button
                  onClick={submitToZuper}
                  disabled={loading}
                  className={`px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 flex items-center gap-3 shadow-lg ${
                    loading ? 'animate-pulse' : ''
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {loading ? 'Submitting to Zuper...' : 'Submit to Zuper'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ZuperChecklistTool;