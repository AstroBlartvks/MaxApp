/**
 * Safe wrapper for WebApp HapticFeedback API
 * Handles errors gracefully to prevent app crashes
 * Based on MAX Bridge API documentation
 */

// Track if haptic feedback is supported (to avoid repeated failed calls)
let hapticFeedbackSupported = null;

/**
 * Checks if WebApp and HapticFeedback are available
 * @returns {boolean}
 */
const isHapticFeedbackAvailable = () => {
  if (hapticFeedbackSupported === false) {
    return false; // Already determined that it's not supported
  }
  
  const available = (
    typeof window !== 'undefined' &&
    window.WebApp &&
    window.WebApp.HapticFeedback &&
    typeof window.WebApp.HapticFeedback === 'object'
  );
  
  return available;
};

/**
 * Sets haptic feedback as unsupported (called when we get unsupported_method error)
 */
const markHapticFeedbackUnsupported = () => {
  hapticFeedbackSupported = false;
};

/**
 * Initialize error handling for HapticFeedback
 * Listens for unhandled promise rejections from max-web-app.js
 */
const initHapticFeedbackErrorHandling = () => {
  if (typeof window === 'undefined') {
    return;
  }

  // Listen for unhandled promise rejections (max-web-app.js throws these)
  // The library throws Uncaught (in promise) errors when HapticFeedback is not supported
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason) {
      let reasonString = '';
      let reasonObject = null;
      
      // Try to extract error information
      if (typeof event.reason === 'string') {
        reasonString = event.reason;
      } else if (event.reason && typeof event.reason === 'object') {
        reasonObject = event.reason;
        
        // Check for error object properties
        if (event.reason.error && event.reason.error.code) {
          const errorCode = event.reason.error.code;
          if (
            errorCode.includes('unsupported_method') ||
            errorCode.includes('not_supported') ||
            errorCode.includes('haptic_feedback') ||
            errorCode.includes('UnsupportedEvent')
          ) {
            markHapticFeedbackUnsupported();
            // Suppress the error to prevent it from appearing in console
            event.preventDefault();
            return;
          }
        }
        
        // Check for type property indicating WebAppHapticFeedbackNotification or WebAppHapticFeedbackImpact
        if (
          (event.reason.type === 'WebAppHapticFeedbackNotification' || 
           event.reason.type === 'WebAppHapticFeedbackImpact') && 
          event.reason.error
        ) {
          markHapticFeedbackUnsupported();
          event.preventDefault();
          return;
        }
        
        // Check for error type WebAppHapticFeedbackImpact
        if (reasonString.includes('WebAppHapticFeedbackImpact')) {
          markHapticFeedbackUnsupported();
          event.preventDefault();
          return;
        }
        
        // Try to stringify the object
        try {
          reasonString = JSON.stringify(event.reason);
        } catch {
          reasonString = String(event.reason);
        }
      } else {
        reasonString = String(event.reason);
      }
      
      // Check if this is a HapticFeedback error
      if (
        reasonString.includes('UnsupportedEvent') ||
        reasonString.includes('unsupported_method') ||
        reasonString.includes('WebAppHapticFeedbackNotification') ||
        reasonString.includes('WebAppHapticFeedbackImpact') ||
        (reasonString.includes('WebAppHapticFeedback') && reasonString.includes('error')) ||
        (reasonString.includes('HapticFeedback') && reasonString.includes('error'))
      ) {
        markHapticFeedbackUnsupported();
        // Suppress the error to prevent it from appearing in console
        event.preventDefault();
      }
    }
  });
  
  // Note: We don't override console.error globally as it could interfere with other error logging
  // The unhandledrejection handler should catch most haptic feedback errors
};

// Initialize error handling immediately
if (typeof window !== 'undefined') {
  initHapticFeedbackErrorHandling();
}

/**
 * Validates notification type according to MAX Bridge API
 * @param {string} type - notification type
 * @returns {boolean}
 */
const isValidNotificationType = (type) => {
  return ['success', 'warning', 'error'].includes(type);
};

/**
 * Validates impact style according to MAX Bridge API
 * @param {string} style - impact style
 * @returns {boolean}
 */
const isValidImpactStyle = (style) => {
  return ['soft', 'light', 'medium', 'heavy', 'rigid'].includes(style);
};

/**
 * Triggers haptic feedback notification
 * @param {string} type - 'success', 'warning', or 'error'
 * @param {boolean} disableVibrationFallback - разрешение использовать вибрацию с постоянной амплитудой
 */
export const triggerHapticNotification = (type = 'success', disableVibrationFallback = false) => {
  // Silently return if not available - haptic feedback is not critical
  if (!isHapticFeedbackAvailable()) {
    return;
  }

  // Validate notification type
  if (!isValidNotificationType(type)) {
    console.warn(`Invalid notification type: ${type}. Expected: success, warning, or error`);
    return;
  }

  try {
    const hapticFeedback = window.WebApp.HapticFeedback;
    
    // Check if method exists
    if (typeof hapticFeedback.notificationOccurred === 'function') {
      // Call with both parameters according to MAX Bridge API
      hapticFeedback.notificationOccurred(type, disableVibrationFallback);
    } else {
      console.debug('HapticFeedback.notificationOccurred is not a function');
      markHapticFeedbackUnsupported();
    }
  } catch (error) {
    // Silently fail - haptic feedback is not critical
    // Errors are handled by MAX Bridge events (WebAppHapticFeedbackNotification)
    console.debug('HapticFeedback notificationOccurred failed:', error);
    // If error indicates unsupported method, mark as unsupported
    if (error && (error.message?.includes('unsupported') || error.code?.includes('unsupported'))) {
      markHapticFeedbackUnsupported();
    }
  }
};

/**
 * Triggers haptic feedback impact
 * @param {string} style - 'soft', 'light', 'medium', 'heavy', or 'rigid'
 * @param {boolean} disableVibrationFallback - разрешение использовать вибрацию с постоянной амплитудой
 */
export const triggerHapticImpact = (style = 'medium', disableVibrationFallback = false) => {
  // Silently return if not available - haptic feedback is not critical
  if (!isHapticFeedbackAvailable()) {
    return;
  }

  // Validate impact style
  if (!isValidImpactStyle(style)) {
    console.warn(`Invalid impact style: ${style}. Expected: soft, light, medium, heavy, or rigid`);
    return;
  }

  try {
    const hapticFeedback = window.WebApp.HapticFeedback;
    
    // Check if method exists
    if (typeof hapticFeedback.impactOccurred === 'function') {
      // Call with both parameters according to MAX Bridge API
      hapticFeedback.impactOccurred(style, disableVibrationFallback);
    } else {
      console.debug('HapticFeedback.impactOccurred is not a function');
      markHapticFeedbackUnsupported();
    }
  } catch (error) {
    // Silently fail - haptic feedback is not critical
    // Errors are handled by MAX Bridge events (WebAppHapticFeedbackImpact)
    console.debug('HapticFeedback impactOccurred failed:', error);
    // If error indicates unsupported method, mark as unsupported
    if (error && (error.message?.includes('unsupported') || error.code?.includes('unsupported'))) {
      markHapticFeedbackUnsupported();
    }
  }
};

/**
 * Triggers haptic feedback selection change
 * @param {boolean} disableVibrationFallback - разрешение использовать вибрацию с постоянной амплитудой
 */
export const triggerHapticSelection = (disableVibrationFallback = false) => {
  // Silently return if not available - haptic feedback is not critical
  if (!isHapticFeedbackAvailable()) {
    return;
  }

  try {
    const hapticFeedback = window.WebApp.HapticFeedback;
    
    // Check if method exists
    if (typeof hapticFeedback.selectionChanged === 'function') {
      // According to MAX Bridge API, selectionChanged might accept disableVibrationFallback
      // But documentation shows it as a method without parameters
      // Try calling it with parameter if it accepts, otherwise without
      try {
        hapticFeedback.selectionChanged(disableVibrationFallback);
      } catch {
        // Fallback to calling without parameters
        hapticFeedback.selectionChanged();
      }
    } else {
      console.debug('HapticFeedback.selectionChanged is not a function');
      markHapticFeedbackUnsupported();
    }
  } catch (error) {
    // Silently fail - haptic feedback is not critical
    // Errors are handled by MAX Bridge events (WebAppHapticFeedbackSelectionChange)
    console.debug('HapticFeedback selectionChanged failed:', error);
    // If error indicates unsupported method, mark as unsupported
    if (error && (error.message?.includes('unsupported') || error.code?.includes('unsupported'))) {
      markHapticFeedbackUnsupported();
    }
  }
};
