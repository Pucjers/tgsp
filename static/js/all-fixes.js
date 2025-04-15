/**
 * TgNinja UI Fix Script
 * 
 * This script consolidates all fixes for modal interactions, file uploads,
 * and other UI functionality issues in the TgNinja application.
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log("🔧 UI Fix Script initialized");
    
    // ============================
    // SECTION 1: MODAL BUTTON FIXES
    // ============================
    
    function fixModalCloseButtons() {
      console.log("Fixing modal close buttons");
      
      document.querySelectorAll('.btn-close, [data-close-modal]').forEach(button => {
        // Clone to remove existing event listeners
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add click event listener
        newButton.addEventListener('click', function() {
          const modalId = this.dataset.closeModal;
          if (modalId) {
            hideModal(modalId);
          }
        });
      });
    }
    
    // ============================
    // SECTION 2: ACCOUNT IMPORT FIXES
    // ============================
    
    function fixImportOptions() {
      console.log("Fixing import options");
      
      // Get all import options
      const importOptions = document.querySelectorAll('.import-option');
      
      importOptions.forEach(option => {
        // Clone to remove existing event listeners
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
        
        // Add new click handler
        newOption.addEventListener('click', function() {
          console.log(`Import option clicked: ${this.dataset.option}`);
          
          // Remove selected class from all options
          document.querySelectorAll('.import-option').forEach(opt => {
            opt.classList.remove('selected');
          });
          
          // Add selected class to this option
          this.classList.add('selected');
        });
      });
    }
    
    function fixContinueButton() {
      console.log("Fixing continue import button");
      
      const continueBtn = document.getElementById('continue-import-btn');
      if (!continueBtn) return;
      
      // Clone to remove existing event listeners
      const newContinueBtn = continueBtn.cloneNode(true);
      continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
      
      // Add our custom handler
      newContinueBtn.addEventListener('click', function() {
        // Get selected import option
        const selectedOption = document.querySelector('.import-option.selected');
        if (!selectedOption) {
          showToast('Please select an import method', 'error');
          return;
        }
        
        // Get selected proxy
        const proxySelect = document.getElementById('account-proxy');
        if (!proxySelect || !proxySelect.value) {
          showToast('Please select a proxy', 'error');
          return;
        }
        
        // Store the proxy info for later use
        const proxyId = proxySelect.value;
        const proxyOption = proxySelect.options[proxySelect.selectedIndex];
        const proxyText = proxyOption ? proxyOption.textContent.trim() : "None";
        sessionStorage.setItem('selectedProxyId', proxyId);
        sessionStorage.setItem('selectedProxyText', proxyText);
        
        console.log(`Selected proxy: ${proxyText} (${proxyId})`);
        console.log(`Selected import method: ${selectedOption.dataset.option}`);
        
        // Hide the current modal
        hideModal('account-import-modal');
        
        // Update all proxy displays BEFORE showing the next modal
        const proxyDisplays = {
          'session': document.getElementById('session-selected-proxy'),
          'tdata': document.getElementById('tdata-selected-proxy'),
          'phone': document.getElementById('phone-selected-proxy')
        };
        
        // Update all proxy displays
        Object.values(proxyDisplays).forEach(display => {
          if (display) display.textContent = proxyText;
        });
        
        // Show the appropriate modal based on the selected method
        const modalMap = {
          'session': 'session-import-modal',
          'tdata': 'tdata-import-modal',
          'phone': 'phone-import-modal'
        };
        
        const targetModal = modalMap[selectedOption.dataset.option];
        if (targetModal) {
          showModal(targetModal);
          
          // Setup additional handlers for the specific import type
          switch(selectedOption.dataset.option) {
            case 'session':
              setupSessionImport(proxyId, proxyText);
              break;
            case 'tdata':
              setupTDataImport(proxyId, proxyText);
              break;
            case 'phone':
              setupPhoneImport(proxyId, proxyText);
              break;
          }
        }
      });
    }
    
    // ============================
    // SECTION 3: FILE UPLOAD FIXES
    // ============================
    
    function fixFileUploads() {
      console.log("Fixing file upload areas");
      
      // Fix for Session Upload
      setupFileUpload(
        'session-file-input',
        'session-upload-area',
        'session-file-info',
        '.session'
      );
      
      // Fix for JSON Upload
      setupFileUpload(
        'json-file-input',
        'json-upload-area',
        'json-file-info',
        '.json'
      );
      
      // Fix for TData Upload
      setupFileUpload(
        'tdata-input',
        'tdata-upload-area',
        'upload-status-text',
        '.zip',
        function(file) {
          // Additional callback for TData file selection
          const uploadStatus = document.getElementById('upload-status');
          const submitBtn = document.getElementById('import-tdata-submit-btn');
          
          if (uploadStatus) uploadStatus.style.display = 'block';
          if (submitBtn) submitBtn.disabled = false;
        }
      );
      
      // Fix for Proxy Upload
      setupFileUpload(
        'proxy-file-input',
        'proxy-upload-area',
        null,
        '.txt'
      );
    }
    
    function setupFileUpload(inputId, areaId, infoId, fileExtension, callback) {
      const input = document.getElementById(inputId);
      const area = document.getElementById(areaId);
      const infoElement = infoId ? document.getElementById(infoId) : null;
      
      if (!input || !area) return;
      
      // Reset file input
      input.value = '';
      
      // Handle direct file selection via input change
      input.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          
          if (file.name.endsWith(fileExtension)) {
            console.log(`File selected via input: ${file.name}`);
            
            // Update info display if available
            if (infoElement) {
              infoElement.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
              infoElement.style.display = 'block';
            }
            
            // Call the callback if provided
            if (typeof callback === 'function') {
              callback(file);
            }
          } else {
            showToast(`Please select a ${fileExtension} file`, 'error');
          }
        }
      });
      
      // Setup browse button
      const browseBtn = area.querySelector('label.btn');
      if (browseBtn) {
        browseBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation(); // Prevent bubbling to the upload area
          console.log(`Browse button clicked for ${inputId}`);
          input.click();
        });
      }
      
      // Setup drag and drop on the upload area
      area.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
      });
      
      area.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
      });
      
      area.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          
          if (file.name.endsWith(fileExtension)) {
            console.log(`File dropped: ${file.name}`);
            
            // Set the file input's files property
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
          } else {
            showToast(`Please select a ${fileExtension} file`, 'error');
          }
        }
      });
      
      // Handle click on the upload area (except on buttons/inputs)
      area.addEventListener('click', function(e) {
        // Only trigger file input if clicked directly on the area
        if (e.target === area) {
          console.log(`Upload area clicked for ${inputId}`);
          input.click();
        }
      });
    }
    
    // ============================
    // SECTION 4: IMPORT TYPE SETUP
    // ============================
    
    function setupSessionImport(proxyId, proxyText) {
      console.log("Setting up session import with proxy ID:", proxyId);
      
      // Setup back button
      const backBtn = document.getElementById('back-to-import-options-btn-session');
      if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        
        newBackBtn.addEventListener('click', function() {
          hideModal('session-import-modal');
          showModal('account-import-modal');
        });
      }
      
      // Setup import button
      const importBtn = document.getElementById('import-session-btn');
      if (importBtn) {
        const newImportBtn = importBtn.cloneNode(true);
        importBtn.parentNode.replaceChild(newImportBtn, importBtn);
        
        newImportBtn.addEventListener('click', function() {
          handleSessionImport(proxyId);
        });
      }
    }
    
    function setupTDataImport(proxyId, proxyText) {
      console.log("Setting up TData import with proxy ID:", proxyId);
      
      // Setup back button
      const backBtn = document.getElementById('back-to-import-options-btn-tdata');
      if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        
        newBackBtn.addEventListener('click', function() {
          hideModal('tdata-import-modal');
          showModal('account-import-modal');
        });
      }
      
      // Reset upload status
      const uploadStatus = document.getElementById('upload-status');
      const progressBar = document.getElementById('upload-progress-bar');
      const statusText = document.getElementById('upload-status-text');
      
      if (uploadStatus) uploadStatus.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
      if (statusText) statusText.textContent = '';
      
      // Setup import button
      const importBtn = document.getElementById('import-tdata-submit-btn');
      if (importBtn) {
        importBtn.disabled = true; // Disabled until file is selected
        
        const newImportBtn = importBtn.cloneNode(true);
        importBtn.parentNode.replaceChild(newImportBtn, importBtn);
        
        newImportBtn.addEventListener('click', function() {
          handleTDataImport(proxyId);
        });
      }
    }
    
    function setupPhoneImport(proxyId, proxyText) {
      console.log("Setting up phone import with proxy ID:", proxyId);
      
      // Setup back button
      const backBtn = document.getElementById('back-to-import-options-btn-phone');
      if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        
        newBackBtn.addEventListener('click', function() {
          hideModal('phone-import-modal');
          showModal('account-import-modal');
        });
      }
      
      // Reset the form
      const phoneForm = document.getElementById('phone-import-form');
      if (phoneForm) phoneForm.reset();
      
      // Reset avatar preview
      const avatarPreview = document.getElementById('avatar-preview');
      if (avatarPreview) avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
      
      const avatarUrlInput = document.getElementById('avatar-url');
      if (avatarUrlInput) avatarUrlInput.value = '';
      
      // Hide verification code row
      const verificationCodeRow = document.getElementById('verification-code-row');
      if (verificationCodeRow) verificationCodeRow.style.display = 'none';
      
      // Show phone footer, hide verify footer
      const phoneImportFooter = document.getElementById('phone-import-footer');
      const phoneVerifyFooter = document.getElementById('phone-verify-footer');
      
      if (phoneImportFooter) phoneImportFooter.style.display = 'block';
      if (phoneVerifyFooter) phoneVerifyFooter.style.display = 'none';
      
      // Setup request code button
      const requestCodeBtn = document.getElementById('request-code-btn');
      if (requestCodeBtn) {
        const newRequestCodeBtn = requestCodeBtn.cloneNode(true);
        requestCodeBtn.parentNode.replaceChild(newRequestCodeBtn, requestCodeBtn);
        
        newRequestCodeBtn.addEventListener('click', function() {
          handleRequestCode(proxyId);
        });
      }
      
      // Setup verify code button
      const verifyCodeBtn = document.getElementById('verify-code-btn');
      if (verifyCodeBtn) {
        const newVerifyCodeBtn = verifyCodeBtn.cloneNode(true);
        verifyCodeBtn.parentNode.replaceChild(newVerifyCodeBtn, verifyCodeBtn);
        
        newVerifyCodeBtn.addEventListener('click', function() {
          handleVerifyCode(proxyId);
        });
      }
      
      // Setup back to phone input button
      const backToPhoneBtn = document.getElementById('back-to-phone-input-btn');
      if (backToPhoneBtn) {
        const newBackToPhoneBtn = backToPhoneBtn.cloneNode(true);
        backToPhoneBtn.parentNode.replaceChild(newBackToPhoneBtn, backToPhoneBtn);
        
        newBackToPhoneBtn.addEventListener('click', function() {
          // Show phone footer, hide verify footer
          if (phoneImportFooter) phoneImportFooter.style.display = 'block';
          if (phoneVerifyFooter) phoneVerifyFooter.style.display = 'none';
          
          // Hide verification code row
          if (verificationCodeRow) verificationCodeRow.style.display = 'none';
        });
      }
      
      // Setup avatar upload
      setupAvatarUpload();
    }
    
    // ============================
    // SECTION 5: IMPORT HANDLERS
    // ============================
    
    function handleSessionImport(proxyId) {
      console.log("Handling session import with proxy ID:", proxyId);
      
      // Get session file
      const sessionInput = document.getElementById('session-file-input');
      if (!sessionInput || !sessionInput.files || sessionInput.files.length === 0) {
        showToast('Please select a session file', 'error');
        return;
      }
      
      // Show loading state
      const importBtn = document.getElementById('import-session-btn');
      if (importBtn) {
        importBtn.disabled = true;
        importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('session_file', sessionInput.files[0]);
      
      // Add JSON file if selected
      const jsonInput = document.getElementById('json-file-input');
      if (jsonInput && jsonInput.files && jsonInput.files.length > 0) {
        formData.append('json_file', jsonInput.files[0]);
      }
      
      // Add list ID
      const listSelect = document.getElementById('session-account-list');
      if (listSelect) {
        formData.append('list_id', listSelect.value);
      }
      
      // Add proxy ID
      formData.append('proxy_id', proxyId);
      
      // Add custom name if provided
      const nameInput = document.getElementById('session-account-name');
      if (nameInput && nameInput.value.trim()) {
        formData.append('name', nameInput.value.trim());
      }
      
      // Send the request
      fetch('/api/accounts/import-session', {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || 'Failed to import session');
          });
        }
        return response.json();
      })
      .then(result => {
        if (result.success) {
          // Show success message
          showToast('Account imported successfully', 'success');
          
          // Close the modal
          hideModal('session-import-modal');
          
          // Reload the page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          throw new Error(result.error || 'Failed to import session');
        }
      })
      .catch(error => {
        console.error('Error importing session:', error);
        showToast(`Error: ${error.message}`, 'error');
        
        // Reset button state
        if (importBtn) {
          importBtn.disabled = false;
          importBtn.innerHTML = 'Import Account';
        }
      });
    }
    
    function handleTDataImport(proxyId) {
      console.log("Handling TData import with proxy ID:", proxyId);
      
      // Get the TData file
      const uploadInput = document.getElementById('tdata-input');
      if (!uploadInput || !uploadInput.files || uploadInput.files.length === 0) {
        showToast('Please select a TData ZIP file', 'error');
        return;
      }
      
      const file = uploadInput.files[0];
      
      // Get the selected list ID
      const listSelect = document.getElementById('tdata-account-list');
      const listId = listSelect ? listSelect.value : 'main';
      
      // Show loading state
      const submitBtn = document.getElementById('import-tdata-submit-btn');
      const progressBar = document.getElementById('upload-progress-bar');
      const statusText = document.getElementById('upload-status-text');
      
      if (submitBtn) submitBtn.disabled = true;
      if (statusText) statusText.textContent = 'Uploading and processing TData...';
      
      // Simulate progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        if (progress > 90) {
          clearInterval(interval);
        }
        if (progressBar) progressBar.style.width = `${progress}%`;
      }, 300);
      
      // Create form data
      const formData = new FormData();
      formData.append('tdata_zip', file);
      formData.append('target_list_id', listId);
      formData.append('proxy_id', proxyId);
      
      // Send the request
      fetch('/api/accounts/import-tdata-zip', {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || 'Failed to import TData');
          });
        }
        return response.json();
      })
      .then(result => {
        // Clear the interval
        clearInterval(interval);
        
        if (result.success) {
          // Show success state
          if (progressBar) progressBar.style.width = '100%';
          if (statusText) statusText.textContent = 'TData imported successfully!';
          
          // Close the modal after a short delay
          setTimeout(() => {
            hideModal('tdata-import-modal');
            
            // Show success message
            showToast('Account imported successfully', 'success');
            
            // Reload the page
            window.location.reload();
          }, 1000);
        } else {
          throw new Error(result.error || 'Failed to import TData');
        }
      })
      .catch(error => {
        console.error('Error importing TData:', error);
        
        // Clear the interval
        clearInterval(interval);
        
        // Show error state
        if (progressBar) progressBar.style.width = '0%';
        if (statusText) statusText.textContent = `Error: ${error.message}`;
        if (submitBtn) submitBtn.disabled = false;
        
        showToast(`Error: ${error.message}`, 'error');
      });
    }
    
    function handleRequestCode(proxyId) {
      console.log("Handling request code with proxy ID:", proxyId);
      
      // Get phone and name
      const nameInput = document.getElementById('name');
      const phoneInput = document.getElementById('phone');
      
      if (!nameInput || !nameInput.value.trim()) {
        showToast('Please enter a name', 'error');
        nameInput.focus();
        return;
      }
      
      if (!phoneInput || !phoneInput.value.trim()) {
        showToast('Please enter a phone number', 'error');
        phoneInput.focus();
        return;
      }
      
      // Show loading state
      const requestBtn = document.getElementById('request-code-btn');
      if (requestBtn) {
        requestBtn.disabled = true;
        requestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Requesting...';
      }
      
      // Request verification code
      fetch('/api/accounts/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneInput.value.trim(),
          proxy_id: proxyId
        })
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || 'Failed to request verification code');
          });
        }
        return response.json();
      })
      .then(result => {
        if (result.success) {
          // Show verification code input
          const codeRow = document.getElementById('verification-code-row');
          const phoneFooter = document.getElementById('phone-import-footer');
          const verifyFooter = document.getElementById('phone-verify-footer');
          
          if (codeRow) codeRow.style.display = 'block';
          if (phoneFooter) phoneFooter.style.display = 'none';
          if (verifyFooter) verifyFooter.style.display = 'block';
          
          // Focus the code input
          const codeInput = document.getElementById('verification-code');
          if (codeInput) codeInput.focus();
          
          showToast('Verification code sent to your Telegram app', 'success');
        } else {
          throw new Error(result.error || 'Failed to request verification code');
        }
      })
      .catch(error => {
        console.error('Error requesting code:', error);
        showToast(`Error: ${error.message}`, 'error');
        
        // Reset button state
        if (requestBtn) {
          requestBtn.disabled = false;
          requestBtn.innerHTML = 'Request Code';
        }
      });
    }
    
    function handleVerifyCode(proxyId) {
      console.log("Handling verify code with proxy ID:", proxyId);
      
      // Get the verification code
      const codeInput = document.getElementById('verification-code');
      
      if (!codeInput || !codeInput.value.trim()) {
        showToast('Please enter the verification code', 'error');
        codeInput.focus();
        return;
      }
      
      // Show loading state
      const verifyBtn = document.getElementById('verify-code-btn');
      if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
      }
      
      // Get form data
      const nameInput = document.getElementById('name');
      const phoneInput = document.getElementById('phone');
      const usernameInput = document.getElementById('username');
      const avatarUrlInput = document.getElementById('avatar-url');
      const listSelect = document.getElementById('account-list');
      const limitInvitesInput = document.getElementById('limit-invites');
      const limitMessagesInput = document.getElementById('limit-messages');
      
      // Create account data
      const accountData = {
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        username: usernameInput.value.trim(),
        avatar: avatarUrlInput.value,
        list_id: listSelect.value,
        proxy_id: proxyId,
        code: codeInput.value.trim(),
        limits: {
          daily_invites: parseInt(limitInvitesInput.value) || 30,
          daily_messages: parseInt(limitMessagesInput.value) || 50
        }
      };
      
      // Verify code
      fetch('/api/accounts/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountData)
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || 'Failed to verify code');
          });
        }
        return response.json();
      })
      .then(result => {
        if (result.success) {
          // Show success message
          showToast('Account verified and added successfully', 'success');
          
          // Close the modal
          hideModal('phone-import-modal');
          
          // Reload the page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          throw new Error(result.error || 'Failed to verify account');
        }
      })
      .catch(error => {
        console.error('Error verifying code:', error);
        showToast(`Error: ${error.message}`, 'error');
        
        // Reset button state
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = 'Verify & Add Account';
        }
      });
    }
    
    function setupAvatarUpload() {
      const avatarInput = document.getElementById('avatar-input');
      const avatarPreview = document.getElementById('avatar-preview');
      const avatarUrlInput = document.getElementById('avatar-url');
      
      if (!avatarInput || !avatarPreview || !avatarUrlInput) return;
      
      // Reset avatar input
      avatarInput.value = '';
      
      // Remove old listeners by cloning
      const newAvatarInput = avatarInput.cloneNode(true);
      avatarInput.parentNode.replaceChild(newAvatarInput, avatarInput);
      
      // Add change listener to new input
      newAvatarInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          
          // Create FormData for upload
          const formData = new FormData();
          formData.append('avatar', file);
          
          try {
            // Upload the avatar
            const response = await fetch('/api/accounts/upload-avatar', {
              method: 'POST',
              body: formData
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to upload avatar');
            }
            
            const result = await response.json();
            
            if (result.url) {
              // Update the avatar preview
              avatarPreview.innerHTML = `<img src="${result.url}" alt="Avatar">`;
              
              // Store the URL in the hidden input
              avatarUrlInput.value = result.url;
            } else {
              throw new Error('No URL returned from server');
            }
          } catch (error) {
            console.error('Error uploading avatar:', error);
            showToast('Error uploading avatar: ' + error.message, 'error');
          }
        }
      });
    }
    
    // ============================
    // SECTION 6: MANUAL GROUP MODAL FIX
    // ============================
    
    function fixManualGroupModal() {
      console.log("Fixing manual group modal");
      
      // Check if the modal exists
      let modal = document.getElementById('add-group-manually-modal');
      
      // If the modal exists but is not inside the modal container, move it
      if (modal && modal.parentElement && modal.parentElement.id !== 'modal-container') {
        console.log("Moving manual group modal into modal container");
        
        // Get the modal container
        const modalContainer = document.getElementById('modal-container');
        
        if (modalContainer) {
          // Remove it from current location
          modal.parentElement.removeChild(modal);
          
          // Add it to the modal container
          modalContainer.appendChild(modal);
        }
      }
      
      // Fix the Add Group Manually button
      const addGroupManuallyBtn = document.getElementById('add-group-manually-btn');
      if (addGroupManuallyBtn) {
        addGroupManuallyBtn.addEventListener('click', function() {
          showModal('add-group-manually-modal');
        });
      }
    }
    
    // ============================
    // SECTION 7: UTILITIES
    // ============================
    
    function showModal(modalId) {
      const modalContainer = document.getElementById('modal-container');
      const modal = document.getElementById(modalId);
      
      if (modalContainer && modal) {
        modalContainer.classList.add('active');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }
    
    function hideModal(modalId) {
      const modalContainer = document.getElementById('modal-container');
      const modal = document.getElementById(modalId);
      
      if (modalContainer && modal) {
        modalContainer.classList.remove('active');
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
    
    function showToast(message, type = 'info') {
      // Create toast element if it doesn't exist
      let toast = document.getElementById('toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
        
        // Add toast styles
        const style = document.createElement('style');
        style.textContent = `
          #toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s ease;
          }
          #toast.visible {
            transform: translateY(0);
            opacity: 1;
          }
          #toast.info { background-color: var(--primary-color); }
          #toast.success { background-color: var(--success-color); }
          #toast.error { background-color: var(--danger-color); }
          #toast.warning { background-color: #f2994a; }
        `;
        document.head.appendChild(style);
      }
      
      // Set toast content and type
      toast.textContent = message;
      toast.className = type;
      
      // Show toast
      setTimeout(() => {
        toast.classList.add('visible');
      }, 10);
      
      // Hide toast after a delay
      setTimeout(() => {
        toast.classList.remove('visible');
      }, 3000);
    }
    
    // ============================
    // SECTION 8: INITIALIZATION
    // ============================
    
    function initializeFixes() {
      console.log("Initializing TgNinja UI fixes");
      
      // Determine which page we're on
      const path = window.location.pathname;
      const isAccountsPage = path === '/' || path === '/index.html';
      const isParserPage = path === '/group-parser.html';
      const isProxiesPage = path === '/proxies.html';
      
      console.log(`Current page: ${path}`);
      
      // Apply general fixes that apply to all pages
      fixModalCloseButtons();
      
      // Apply page-specific fixes
      if (isAccountsPage) {
        // Attach event listeners to "Add Account" buttons
        const addAccountBtn = document.getElementById('add-account-btn');
        const emptyAddBtn = document.getElementById('empty-add-btn');
        
        if (addAccountBtn) {
          addAccountBtn.addEventListener('click', function() {
            // Apply account import fixes after modal is opened
            setTimeout(() => {
              fixImportOptions();
              fixContinueButton();
              fixFileUploads();
            }, 100);
          });
        }
        
        if (emptyAddBtn) {
          emptyAddBtn.addEventListener('click', function() {
            // Apply account import fixes after modal is opened
            setTimeout(() => {
              fixImportOptions();
              fixContinueButton();
              fixFileUploads();
            }, 100);
          });
        }
      }
      
      if (isParserPage) {
        // Apply group parser specific fixes
        fixManualGroupModal();
      }
      
      // Apply fixes immediately if a modal is already open
      if (document.getElementById('modal-container') && 
          document.getElementById('modal-container').classList.contains('active')) {
        console.log("Modal already open, applying relevant fixes immediately");
        
        // Apply account import fixes if on accounts page
        if (isAccountsPage && document.getElementById('account-import-modal')) {
          fixImportOptions();
          fixContinueButton();
          fixFileUploads();
        }
        
        // Apply manual group modal fixes if on parser page
        if (isParserPage && document.getElementById('add-group-manually-modal')) {
          fixManualGroupModal();
        }
      }
    }
    
    // Run initialization
    initializeFixes();
});