document.addEventListener('DOMContentLoaded', function() {
    console.log("🔧 Running TgNinja file upload and import fix...");
    
    // PART 1: Fix duplicate file dialogs
    function fixFileDialogs() {
      console.log("Fixing file dialog issues...");
      
      // Function to properly set up file input handlers
      function setupFileInput(inputId, uploadAreaId, fileInfoId, fileType) {
        // Get the elements
        const input = document.getElementById(inputId);
        const uploadArea = document.getElementById(uploadAreaId);
        const fileInfo = document.getElementById(fileInfoId);
        
        if (!input || !uploadArea) {
          console.warn(`Missing elements for ${inputId} setup`);
          return;
        }
        
        // Remove all existing event listeners by cloning and replacing
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        const newUploadArea = uploadArea.cloneNode(true);
        uploadArea.parentNode.replaceChild(newUploadArea, uploadArea);
        
        // Add the browse button handler
        const browseBtn = newUploadArea.querySelector('label.btn');
        if (browseBtn) {
          // Remove old handler and add new one
          const newBrowseBtn = browseBtn.cloneNode(true);
          browseBtn.parentNode.replaceChild(newBrowseBtn, browseBtn);
          
          // Critical fix: Use a cleaner click handler with stopPropagation
          newBrowseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent click from bubbling to upload area
            console.log(`Browse button clicked for ${inputId}`);
            newInput.click();
          });
        }
        
        // Handle file selection
        newInput.addEventListener('change', function(e) {
          if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            console.log(`File selected for ${inputId}: ${file.name}`);
            
            // Update file info
            if (fileInfo) {
              const size = file.size < 1024 
                ? `${file.size} B` 
                : file.size < 1024 * 1024 
                  ? `${(file.size / 1024).toFixed(2)} KB` 
                  : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
                  
              fileInfo.textContent = `Selected: ${file.name} (${size})`;
              fileInfo.style.display = 'block';
            }
          }
        });
        
        // Handle upload area clicks (but not when clicking the button)
        newUploadArea.addEventListener('click', function(e) {
          // Only trigger if clicking directly on the upload area
          if (e.target === newUploadArea) {
            console.log(`Upload area clicked for ${inputId}`);
            newInput.click();
          }
        });
        
        // Handle drag and drop
        newUploadArea.addEventListener('dragover', function(e) {
          e.preventDefault();
          this.classList.add('dragover');
        });
        
        newUploadArea.addEventListener('dragleave', function(e) {
          e.preventDefault();
          this.classList.remove('dragover');
        });
        
        newUploadArea.addEventListener('drop', function(e) {
          e.preventDefault();
          this.classList.remove('dragover');
          
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            
            // Validate file type if fileType is provided
            if (fileType && !file.name.endsWith(fileType)) {
              alert(`Please select a ${fileType} file`);
              return;
            }
            
            // Set the file to the input
            // Create a DataTransfer to set the file
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            newInput.files = dataTransfer.files;
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            newInput.dispatchEvent(event);
          }
        });
        
        console.log(`Setup complete for ${inputId}`);
      }
      
      // Fix Session import
      setupFileInput('session-file-input', 'session-upload-area', 'session-file-info', '.session');
      setupFileInput('json-file-input', 'json-upload-area', 'json-file-info', '.json');
      
      // Fix TData import
      setupFileInput('tdata-input', 'tdata-upload-area', 'upload-status-text');
    }
    
    // PART 2: Fix import buttons not working
    function fixImportButtons() {
      console.log("Fixing import buttons...");
      
      // Fix Session Import Button
      const sessionImportBtn = document.getElementById('import-session-btn');
      if (sessionImportBtn) {
        // Clone to remove existing handlers
        const newSessionImportBtn = sessionImportBtn.cloneNode(true);
        sessionImportBtn.parentNode.replaceChild(newSessionImportBtn, sessionImportBtn);
        
        newSessionImportBtn.addEventListener('click', function() {
          console.log("Session import button clicked");
          
          // Get selected proxy
          const proxyDisplay = document.getElementById('session-selected-proxy');
          if (!proxyDisplay || proxyDisplay.textContent === 'None') {
            alert('Please select a proxy first');
            return;
          }
          
          // Get session file
          const sessionInput = document.getElementById('session-file-input');
          if (!sessionInput || !sessionInput.files || sessionInput.files.length === 0) {
            alert('Please select a session file');
            return;
          }
          
          // Show loading state
          this.disabled = true;
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
          
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
          
          // Get proxy ID from storage
          const proxyId = sessionStorage.getItem('selectedProxyId');
          if (proxyId) {
            formData.append('proxy_id', proxyId);
          }
          
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
              alert('Account imported successfully!');
              
              // Close the modal
              const modalContainer = document.getElementById('modal-container');
              const modal = document.getElementById('session-import-modal');
              if (modalContainer && modal) {
                modalContainer.classList.remove('active');
                modal.classList.remove('active');
              }
              
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
            alert(`Error: ${error.message}`);
            
            // Reset button state
            this.disabled = false;
            this.innerHTML = 'Import Account';
          });
        });
      }
      
      // Fix TData Import Button
      const tdataImportBtn = document.getElementById('import-tdata-submit-btn');
      if (tdataImportBtn) {
        // Clone to remove existing handlers
        const newTdataImportBtn = tdataImportBtn.cloneNode(true);
        tdataImportBtn.parentNode.replaceChild(newTdataImportBtn, tdataImportBtn);
        
        newTdataImportBtn.addEventListener('click', function() {
          console.log("TData import button clicked");
          
          // Get TData file
          const tdataInput = document.getElementById('tdata-input');
          if (!tdataInput || !tdataInput.files || tdataInput.files.length === 0) {
            alert('Please select a TData ZIP file');
            return;
          }
          
          // Show loading state
          this.disabled = true;
          const progressBar = document.getElementById('upload-progress-bar');
          const statusText = document.getElementById('upload-status-text');
          
          if (progressBar) progressBar.style.width = '0%';
          if (statusText) statusText.textContent = 'Uploading...';
          
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
          formData.append('tdata_zip', tdataInput.files[0]);
          
          // Add list ID
          const listSelect = document.getElementById('tdata-account-list');
          if (listSelect) {
            formData.append('target_list_id', listSelect.value);
          }
          
          // Get proxy ID from storage
          const proxyId = sessionStorage.getItem('selectedProxyId');
          if (proxyId) {
            formData.append('proxy_id', proxyId);
          }
          
          // Send the request
          fetch('/services/import-tdata-zip', {
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
                const modalContainer = document.getElementById('modal-container');
                const modal = document.getElementById('tdata-import-modal');
                if (modalContainer && modal) {
                  modalContainer.classList.remove('active');
                  modal.classList.remove('active');
                }
                
                // Show success message
                alert('Account imported successfully!');
                
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
            
            // Re-enable button
            this.disabled = false;
            
            alert(`Error: ${error.message}`);
          });
        });
      }
      
      // Fix Phone Import Button
      const requestCodeBtn = document.getElementById('request-code-btn');
      if (requestCodeBtn) {
        // Clone to remove existing handlers
        const newRequestCodeBtn = requestCodeBtn.cloneNode(true);
        requestCodeBtn.parentNode.replaceChild(newRequestCodeBtn, requestCodeBtn);
        
        newRequestCodeBtn.addEventListener('click', function() {
          console.log("Request code button clicked");
          
          // Get phone and name
          const phoneInput = document.getElementById('phone');
          const nameInput = document.getElementById('name');
          
          if (!phoneInput || !phoneInput.value.trim()) {
            alert('Please enter a phone number');
            return;
          }
          
          if (!nameInput || !nameInput.value.trim()) {
            alert('Please enter a name');
            return;
          }
          
          // Show loading state
          this.disabled = true;
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Requesting...';
          
          // Get proxy ID from storage
          const proxyId = sessionStorage.getItem('selectedProxyId');
          if (!proxyId) {
            alert('Please select a proxy first');
            this.disabled = false;
            this.innerHTML = 'Request Code';
            return;
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
              
              alert('Verification code sent to your Telegram app');
            } else {
              throw new Error(result.error || 'Failed to request verification code');
            }
          })
          .catch(error => {
            console.error('Error requesting code:', error);
            alert(`Error: ${error.message}`);
            
            // Reset button state
            this.disabled = false;
            this.innerHTML = 'Request Code';
          });
        });
      }
      
      // Fix Verify Code Button
      const verifyCodeBtn = document.getElementById('verify-code-btn');
      if (verifyCodeBtn) {
        // Clone to remove existing handlers
        const newVerifyCodeBtn = verifyCodeBtn.cloneNode(true);
        verifyCodeBtn.parentNode.replaceChild(newVerifyCodeBtn, verifyCodeBtn);
        
        newVerifyCodeBtn.addEventListener('click', function() {
          console.log("Verify code button clicked");
          
          // Get verification code
          const codeInput = document.getElementById('verification-code');
          if (!codeInput || !codeInput.value.trim()) {
            alert('Please enter the verification code');
            return;
          }
          
          // Show loading state
          this.disabled = true;
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
          
          // Get form data
          const nameInput = document.getElementById('name');
          const phoneInput = document.getElementById('phone');
          const usernameInput = document.getElementById('username');
          const avatarUrlInput = document.getElementById('avatar-url');
          const listSelect = document.getElementById('account-list');
          const limitInvitesInput = document.getElementById('limit-invites');
          const limitMessagesInput = document.getElementById('limit-messages');
          
          // Get proxy ID from storage
          const proxyId = sessionStorage.getItem('selectedProxyId');
          
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
              alert('Account verified and added successfully!');
              
              // Close the modal
              const modalContainer = document.getElementById('modal-container');
              const modal = document.getElementById('phone-import-modal');
              if (modalContainer && modal) {
                modalContainer.classList.remove('active');
                modal.classList.remove('active');
              }
              
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
            alert(`Error: ${error.message}`);
            
            // Reset button state
            this.disabled = false;
            this.innerHTML = 'Verify & Add Account';
          });
        });
      }
    }
    
    // PART 3: Fix Proxy Transfer Between Modals
    function fixProxyTransfer() {
      console.log("Fixing proxy transfer between modals...");
      
      // Fix the Continue button in the import options modal
      const continueBtn = document.getElementById('continue-import-btn');
      if (continueBtn) {
        // Clone to remove existing handlers
        const newContinueBtn = continueBtn.cloneNode(true);
        continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
        
        newContinueBtn.addEventListener('click', function() {
          console.log("Continue button clicked");
          
          // Get selected import option
          const selectedOption = document.querySelector('.import-option.selected');
          if (!selectedOption) {
            alert('Please select an import method');
            return;
          }
          
          // Get selected proxy
          const proxySelect = document.getElementById('account-proxy');
          if (!proxySelect || !proxySelect.value) {
            alert('Please select a proxy');
            return;
          }
          
          // Store proxy info
          const proxyId = proxySelect.value;
          const proxyText = proxySelect.options[proxySelect.selectedIndex].textContent.trim();
          
          sessionStorage.setItem('selectedProxyId', proxyId);
          sessionStorage.setItem('selectedProxyText', proxyText);
          
          console.log(`Selected proxy: ${proxyText} (${proxyId})`);
          
          // Hide current modal
          const importModal = document.getElementById('account-import-modal');
          const modalContainer = document.getElementById('modal-container');
          
          if (importModal) importModal.classList.remove('active');
          
          // Get the target modal based on the selected option
          const importMethod = selectedOption.dataset.option;
          
          // Update the proxy displays in target modals BEFORE showing them
          const displaySelectors = {
            'session': 'session-selected-proxy',
            'tdata': 'tdata-selected-proxy',
            'phone': 'phone-selected-proxy'
          };
          
          Object.values(displaySelectors).forEach(selector => {
            const display = document.getElementById(selector);
            if (display) display.textContent = proxyText;
          });
          
          // Show the appropriate modal
          const targetModal = document.getElementById(`${importMethod}-import-modal`);
          if (targetModal) {
            targetModal.classList.add('active');
          }
        });
      }
      
      // Update proxy displays when modal reopens
      const addAccountBtns = ['add-account-btn', 'empty-add-btn'];
      addAccountBtns.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.addEventListener('click', function() {
            // Reset proxy selection
            sessionStorage.removeItem('selectedProxyId');
            sessionStorage.removeItem('selectedProxyText');
          });
        }
      });
    }
    
    // Run the fixes
    fixFileDialogs();
    fixImportButtons();
    fixProxyTransfer();
    
    console.log("✅ All fixes applied successfully");
  });