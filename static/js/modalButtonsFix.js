// modalButtonsFix.js
// Comprehensive fix for modal button functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Modal buttons fix script loaded');
    
    // Fix modal close buttons (X icons)
    function fixModalCloseButtons() {
      console.log('Fixing modal close buttons...');
      document.querySelectorAll('.btn-close, [data-close-modal]').forEach(button => {
        console.log('Found close button for modal: ' + button.dataset.closeModal);
        
        // Clone to remove existing event listeners
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add click event listener
        newButton.addEventListener('click', function() {
          const modalId = this.dataset.closeModal;
          console.log('Closing modal: ' + modalId);
          
          if (modalId) {
            document.getElementById('modal-container').classList.remove('active');
            document.getElementById(modalId).classList.remove('active');
            document.body.style.overflow = '';
          }
        });
      });
    }
    
    // Fix account import modal buttons
    function fixAccountImportModal() {
      console.log('Fixing account import modal buttons...');
      
      // Fix import options
      document.querySelectorAll('.import-option').forEach(option => {
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
        
        newOption.addEventListener('click', function() {
          console.log('Import option clicked: ' + this.dataset.option);
          document.querySelectorAll('.import-option').forEach(o => {
            o.classList.remove('selected');
          });
          this.classList.add('selected');
        });
      });
      
      // Fix continue button
      const continueBtn = document.getElementById('continue-import-btn');
      if (continueBtn) {
        const newContinueBtn = continueBtn.cloneNode(true);
        continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
        
        newContinueBtn.addEventListener('click', function() {
          const selectedOption = document.querySelector('.import-option.selected');
          if (!selectedOption) {
            alert('Please select an import method');
            return;
          }
          
          const proxySelect = document.getElementById('account-proxy');
          if (!proxySelect || !proxySelect.value) {
            alert('Please select a proxy');
            return;
          }
          
          const selectedProxyId = proxySelect.value;
          const importMethod = selectedOption.dataset.option;
          
          document.getElementById('modal-container').classList.remove('active');
          document.getElementById('account-import-modal').classList.remove('active');
          
          document.getElementById('modal-container').classList.add('active');
          
          switch (importMethod) {
            case 'session':
              document.getElementById('session-import-modal').classList.add('active');
              setupSessionImport(selectedProxyId);
              break;
            case 'tdata':
              document.getElementById('tdata-import-modal').classList.add('active');
              setupTDataImport(selectedProxyId);
              break;
            case 'phone':
              document.getElementById('phone-import-modal').classList.add('active');
              setupPhoneImport(selectedProxyId);
              break;
            default:
              alert('Invalid import method');
              break;
          }
        });
      }
      
      // Fix back buttons in specific modals
      ['back-to-import-options-btn-session', 'back-to-import-options-btn-tdata', 'back-to-import-options-btn-phone'].forEach(btnId => {
        const backBtn = document.getElementById(btnId);
        if (backBtn) {
          const newBackBtn = backBtn.cloneNode(true);
          backBtn.parentNode.replaceChild(newBackBtn, backBtn);
          
          newBackBtn.addEventListener('click', function() {
            // Hide current modal
            const currentModal = this.closest('.modal');
            currentModal.classList.remove('active');
            
            // Show import options modal
            document.getElementById('account-import-modal').classList.add('active');
          });
        }
      });
    }
    
    // Fix proxy modal buttons
    function fixProxyModal() {
      console.log('Fixing proxy modal buttons...');
      
      // Fix test proxy button
      const testProxyBtn = document.getElementById('test-proxy-btn');
      if (testProxyBtn) {
        const newTestProxyBtn = testProxyBtn.cloneNode(true);
        testProxyBtn.parentNode.replaceChild(newTestProxyBtn, testProxyBtn);
        
        newTestProxyBtn.addEventListener('click', function() {
          console.log('Test proxy button clicked');
          
          // Get proxy details
          const type = document.getElementById('proxy-type').value;
          const host = document.getElementById('proxy-host').value;
          const port = document.getElementById('proxy-port').value;
          const username = document.getElementById('proxy-username').value;
          const password = document.getElementById('proxy-password').value;
          
          if (!host || !port) {
            alert('Please enter proxy host and port');
            return;
          }
          
          // Show loading state
          this.disabled = true;
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
          
          // Test the proxy
          fetch('/api/proxies/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: type,
              host: host,
              port: parseInt(port),
              username: username,
              password: password
            })
          })
          .then(response => response.json())
          .then(data => {
            // Reset button state
            this.disabled = false;
            this.innerHTML = 'Test Proxy';
            
            // Show test results
            const resultsContainer = document.getElementById('proxy-test-results');
            if (resultsContainer) {
              resultsContainer.style.display = 'block';
              
              if (data.success) {
                resultsContainer.className = 'test-results success';
                resultsContainer.innerHTML = `
                  <div class="test-result-item">
                    <span>Status:</span>
                    <span><i class="fas fa-check-circle"></i> Online</span>
                  </div>
                  <div class="test-result-item">
                    <span>Response Time:</span>
                    <span>${data.response_time} ms</span>
                  </div>
                  <div class="test-result-item">
                    <span>IP Address:</span>
                    <span>${data.ip_address}</span>
                  </div>
                  <div class="test-result-item">
                    <span>Location:</span>
                    <span>${data.location || 'Unknown'}</span>
                  </div>
                `;
              } else {
                resultsContainer.className = 'test-results error';
                resultsContainer.innerHTML = `
                  <div class="test-result-item">
                    <span>Status:</span>
                    <span><i class="fas fa-times-circle"></i> Offline</span>
                  </div>
                  <div class="test-result-item">
                    <span>Error:</span>
                    <span>${data.error || 'Failed to connect'}</span>
                  </div>
                `;
              }
            }
          })
          .catch(error => {
            console.error('Error testing proxy:', error);
            
            // Reset button state
            this.disabled = false;
            this.innerHTML = 'Test Proxy';
            
            // Show error
            alert('Error testing proxy: ' + error.message);
          });
        });
      }
      
      // Fix save proxy button
      const saveProxyBtn = document.getElementById('save-proxy-btn');
      if (saveProxyBtn) {
        const newSaveProxyBtn = saveProxyBtn.cloneNode(true);
        saveProxyBtn.parentNode.replaceChild(newSaveProxyBtn, saveProxyBtn);
        
        newSaveProxyBtn.addEventListener('click', function() {
          console.log('Save proxy button clicked');
          
          // Get proxy details
          const type = document.getElementById('proxy-type').value;
          const host = document.getElementById('proxy-host').value;
          const port = document.getElementById('proxy-port').value;
          const username = document.getElementById('proxy-username').value;
          const password = document.getElementById('proxy-password').value;
          
          if (!host || !port) {
            alert('Please enter proxy host and port');
            return;
          }
          
          // Show loading state
          this.disabled = true;
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
          
          // Save the proxy
          fetch('/api/proxies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: type,
              host: host,
              port: parseInt(port),
              username: username,
              password: password
            })
          })
          .then(response => response.json())
          .then(data => {
            // Reset button state
            this.disabled = false;
            this.innerHTML = 'Save Proxy';
            
            // Close the modal
            document.getElementById('modal-container').classList.remove('active');
            document.getElementById('add-proxy-modal').classList.remove('active');
            
            // Show success message
            alert('Proxy saved successfully');
            
            // Reload the page to update the proxy list
            window.location.reload();
          })
          .catch(error => {
            console.error('Error saving proxy:', error);
            
            // Reset button state
            this.disabled = false;
            this.innerHTML = 'Save Proxy';
            
            // Show error
            alert('Error saving proxy: ' + error.message);
          });
        });
      }
    }
    
    // Helper function to simulate a showModal function for core functionality
    function showModal(modalId) {
      document.getElementById('modal-container').classList.add('active');
      document.getElementById(modalId).classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    
    // Helper function to simulate a hideModal function for core functionality
    function hideModal(modalId) {
      document.getElementById('modal-container').classList.remove('active');
      document.getElementById(modalId).classList.remove('active');
      document.body.style.overflow = '';
    }
    
    // Stub functions for import setup
    function setupSessionImport(proxyId) {
      console.log('Setting up session import with proxy ID:', proxyId);
      // Implementation would go here
    }
    
    function setupTDataImport(proxyId) {
      console.log('Setting up TData import with proxy ID:', proxyId);
      // Implementation would go here
    }
    
    function setupPhoneImport(proxyId) {
      console.log('Setting up phone import with proxy ID:', proxyId);
      // Implementation would go here
    }
    
    // Fix "Add Account" button
    const addAccountBtn = document.getElementById('add-account-btn');
    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', function() {
        showModal('account-import-modal');
        setTimeout(() => {
          fixModalCloseButtons();
          fixAccountImportModal();
        }, 100);
      });
    }
    
    // Fix "Empty Add" button
    const emptyAddBtn = document.getElementById('empty-add-btn');
    if (emptyAddBtn) {
      emptyAddBtn.addEventListener('click', function() {
        showModal('account-import-modal');
        setTimeout(() => {
          fixModalCloseButtons();
          fixAccountImportModal();
        }, 100);
      });
    }
    
    // Fix "Add Proxy" button
    const addProxyBtn = document.getElementById('add-proxy-btn');
    if (addProxyBtn) {
      addProxyBtn.addEventListener('click', function() {
        showModal('add-proxy-modal');
        setTimeout(() => {
          fixModalCloseButtons();
          fixProxyModal();
        }, 100);
      });
    }
    
    // Fix "Import TData" button
    const importTdataBtn = document.getElementById('import-tdata-btn');
    if (importTdataBtn) {
      importTdataBtn.addEventListener('click', function() {
        showModal('tdata-import-modal');
        setTimeout(() => {
          fixModalCloseButtons();
        }, 100);
      });
    }
    
    // Run initial fix for modals that might already be open
    fixModalCloseButtons();
    
    console.log('Modal buttons fix script initialized');
  });