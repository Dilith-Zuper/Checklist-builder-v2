const axios = require('axios');

/**
 * Map checklist type to Zuper component
 * @param {string} type - Checklist item type
 * @returns {string} - Zuper component type
 */
function mapTypeToComponent(type) {
  const normalizedType = type.trim().toLowerCase();

  const mapping = {
    // Frontend types to Zuper components
    "textarea": "textArea",
    "textfield": "textInput", 
    "date": "dateInput",
    "time": "timeInput",
    "datetime": "dateTimeInput",
    "dropdown": "select",
    "checkbox": "checkbox",
    "radio": "radio",
    "multiimage": "multi_image",
    "signature": "signature",
    "header":"header",
    
    // Alternative mappings for consistency
    "multi line input": "textArea",
    "single line input": "textInput",
    "photo": "multi_image",
    "Header":"header",
  };

  return mapping[normalizedType] || "textInput";
}

/**
 * Get meta options based on component type
 * @param {string} type - Component type
 * @returns {Object} - Meta options object
 */
function getMetaOptionsByComponent(type) {
  if (type === "multi_image") {
    return {
      watermark_image: false,
      restrict_to_camera: false,
      watermark_timestamp: false,
      watermark_geo_cords: false,
      restrict_status_update: {
        is_enabled: false
      }
    };
  }

  return {
    restrict_status_update: {
      is_enabled: false,
    }
  };
}

/**
 * Generate Zuper API payload from checklist data
 * @param {Array} checklist - Array of checklist items
 * @param {Object} config - Configuration object with categoryUid, statusUid, etc.
 * @returns {Object} - Zuper API payload
 */
const generateZuperPayload = (checklist, config) => {
  try {
    console.log('📦 Generating Zuper payload...');
    
    const { categoryUid, statusUid } = config;

    console.log('📋 Raw checklist input:');
    console.dir(checklist, { depth: null });

    const zuperChecklist = checklist.map((item, index) => {
      const componentType = mapTypeToComponent(item.type);
      console.log(`Type: ${item.type}, Component: ${componentType}`);

      return {
        id: index + 1,
        component: componentType,
        editable: true,
        index: index,
        label: item.question,
        description: "",
        placeholder: "",
        options: item.options
          ? item.options.split(',').map(opt => opt.trim()).filter(Boolean)
          : [],
        required: Boolean(item.required),
        validation: "/.*/",
        hide_to_fe: false,
        // FIXED: Properly map dependency fields with fallbacks
        is_dependent: Boolean(item.isDependent),
        dependent_on: item.dependentOn || '',
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
        restrict_status_update: null,
        meta_options: getMetaOptionsByComponent(componentType),
        checklist_view_type: "SINGLE_PAGE"
      };
    });

    const payload = {
      category_uid: categoryUid,
      job_status_uid: statusUid,
      checklist: zuperChecklist,
      prefill_checklist: false
    };

    console.log('✅ Generated Zuper payload with dependency fields');
    console.log(JSON.stringify(payload, null, 2));
    
    return payload;

  } catch (error) {
    console.error('❌ Error generating Zuper payload:', error);
    throw new Error(`Failed to generate Zuper payload: ${error.message}`);
  }
};

/**
 * Submit checklist to Zuper FSM API
 * @param {Object} payload - Zuper API payload
 * @param {string} apiKey - Company API key
 * @param {string} region - Zuper region
 * @returns {Promise<Object>} - API response
 */
const submitToZuper = async (payload, apiKey, region) => {
  try {
    console.log(`🚀 Submitting to Zuper API (region: ${region})`);
    
    console.log('📦 Final payload being submitted to Zuper:');
    console.dir(payload, { depth: null });
    
    // Construct Zuper API URL
    const zuperUrl = `https://${region}.zuperpro.com/api/settings/checklist`;
   
    console.log(`📡 Zuper URL: ${zuperUrl}`);

    // Prepare request headers
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'User-Agent': 'Zuper-Checklist-Tool/1.0.0'
    };

    // Configure axios request
    const requestConfig = {
      method: 'POST',
      url: zuperUrl,
      headers: headers,
      data: payload,
      timeout: 60000, // 60 seconds timeout
      validateStatus: function (status) {
        // Accept status codes from 200-299
        return status >= 200 && status < 300;
      }
    };

    console.log('📤 Sending request to Zuper...');
    
    // Make the API request
    const response = await axios(requestConfig);
    
    console.log(`✅ Zuper API response: ${response.status} ${response.statusText}`);
    
    return {
      success: true,
      status: response.status,
      data: response.data,
      message: 'Checklist submitted successfully to Zuper'
    };

  } catch (error) {
    console.error('❌ Zuper API submission failed:', error);
    
    // Handle specific error types
    if (error.code === 'ECONNREFUSED') {
      const connError = new Error('Unable to connect to Zuper API. Please check the region setting.');
      connError.code = 'ZUPER_API_ERROR';
      connError.statusCode = 503;
      throw connError;
    } else if (error.code === 'ENOTFOUND') {
      const dnsError = new Error('Invalid Zuper region. Please check the region setting.');
      dnsError.code = 'ZUPER_API_ERROR';
      dnsError.statusCode = 400;
      throw dnsError;
    } else if (error.code === 'ECONNABORTED') {
      const timeoutError = new Error('Request to Zuper API timed out. Please try again.');
      timeoutError.code = 'TIMEOUT_ERROR';
      timeoutError.statusCode = 408;
      throw timeoutError;
    }

    // Handle HTTP errors
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      let errorMessage = 'Zuper API error';
      
      switch (status) {
        case 400:
          errorMessage = 'Invalid request data. Please check your category UID and status UID.';
          break;
        case 401:
          errorMessage = 'Invalid API key. Please check your Zuper API key.';
          break;
        case 403:
          errorMessage = 'Access denied. Please check your API key permissions.';
          break;
        case 404:
          errorMessage = 'Zuper API endpoint not found. Please check the region setting.';
          break;
        case 429:
          errorMessage = 'Too many requests to Zuper API. Please try again later.';
          break;
        case 500:
          errorMessage = 'Zuper server error. Please try again later.';
          break;
        default:
          errorMessage = `Zuper API error (${status}): ${errorData?.message || error.message}`;
      }
      
      const apiError = new Error(errorMessage);
      apiError.code = 'ZUPER_API_ERROR';
      apiError.statusCode = status;
      apiError.response = errorData;
      throw apiError;
    }
    
    // Handle other errors
    const genericError = new Error(`Failed to submit to Zuper: ${error.message}`);
    genericError.code = 'ZUPER_API_ERROR';
    genericError.statusCode = 500;
    throw genericError;
  }
};

/**
 * Validate Zuper configuration
 * @param {Object} config - Configuration object
 * @returns {Object} - Validation result
 */
const validateZuperConfig = (config) => {
  const { categoryUid, statusUid, apiKey, region } = config;
  
  const validation = {
    isValid: true,
    errors: []
  };

  if (!categoryUid || typeof categoryUid !== 'string' || categoryUid.trim() === '') {
    validation.isValid = false;
    validation.errors.push('Category UID is required');
  }

  if (!statusUid || typeof statusUid !== 'string' || statusUid.trim() === '') {
    validation.isValid = false;
    validation.errors.push('Status UID is required');
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    validation.isValid = false;
    validation.errors.push('API Key is required');
  }

  if (!region || typeof region !== 'string' || region.trim() === '') {
    validation.isValid = false;
    validation.errors.push('Region is required');
  } else {
    // Validate region format (basic validation)
    const regionPattern = /^[a-zA-Z0-9\-]+$/;
    if (!regionPattern.test(region)) {
      validation.isValid = false;
      validation.errors.push('Invalid region format');
    }
  }

  return validation;
};

/**
 * Test Zuper API connection
 * @param {string} apiKey - API key
 * @param {string} region - Region
 * @returns {Promise<boolean>} - Connection status
 */
const testZuperConnection = async (apiKey, region) => {
  try {
    const testUrl = `https://${region}.zuperpro.com/api/health`;
    
    const response = await axios({
      method: 'GET',
      url: testUrl,
      headers: {
        'x-api-key': apiKey,
        'User-Agent': 'Zuper-Checklist-Tool/1.0.0'
      },
      timeout: 10000 // 10 seconds timeout
    });
    
    return response.status === 200;
  } catch (error) {
    console.error('Connection test failed:', error.message);
    return false;
  }
};

/**
 * Get Zuper job categories
 * @param {string} apiKey - API key
 * @param {string} region - Region
 * @returns {Promise<Array>} - List of categories
 */
const getZuperCategories = async (apiKey, region) => {
  try {
    const url = `https://${region}.zuperpro.com/api/jobs/category`;

    const response = await axios({
      method: 'GET',
      url: url,
      headers: {
        'x-api-key': apiKey,
        'User-Agent': 'Zuper-Checklist-Tool/1.0.0'
      },
      timeout: 15000
    });

    const rawCategories = response.data.data || [];

    // Transform into desired format
    const transformedCategories = rawCategories.map(cat => ({
      id: cat.category_uid,
      name: cat.category_name
    }));

    return transformedCategories;
  } catch (error) {
    console.error('Failed to fetch categories:', error.message);
    throw error;
  }
};

/**
 * Get Zuper job statuses
 * @param {string} apiKey - API key
 * @param {string} region - Region
 * @param {string} categoryUid - Category UID
 * @returns {Promise<Array>} - List of statuses
 */
const getZuperStatuses = async (apiKey, region, categoryUid) => {
  try {
    const url = `https://${region}.zuperpro.com/api/jobs/status/${categoryUid}`;

    const response = await axios({
      method: 'GET',
      url: url,
      headers: {
        'x-api-key': apiKey,
        'User-Agent': 'Zuper-Checklist-Tool/1.0.0'
      },
      timeout: 15000
    });

    const rawStatuses = response.data.data?.job_statuses || [];

    // Transform into desired format
    const transformed = rawStatuses.map(status => ({
      id: status.status_uid,
      name: status.status_name
    }));

    return transformed;
  } catch (error) {
    console.error('Failed to fetch statuses:', error.message);
    throw error;
  }
};

module.exports = {
  generateZuperPayload,
  submitToZuper,
  validateZuperConfig,
  testZuperConnection,
  getZuperCategories,
  getZuperStatuses,
  mapTypeToComponent
};