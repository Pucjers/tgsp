// Targeted fix for TgNinja account modal issues
(function() {
    console.log("Starting targeted fix for TgNinja account modal issues");
    
    // Fix 1: Properly pass proxy selection to next screen
    function fixProxyTransfer() {
      console.log("Setting up proxy transfer fix");
      
      // Set up proxy selection listener
      const proxySelect = document.getElementById('account-proxy');
      if (proxySelect) {
        // Store the selected proxy info whenever it changes
        proxySelect.addEventListener('change', function() {
          const selectedProxyOption = this.options[this.selectedIndex];
          const proxyId = this.value;
          const proxyText = selectedProxyOption ? selectedProxyOption.textContent.trim() : "None";
          
          // Store the info in session storage for persistence
          sessionStorage.setItem('selectedProxyId', proxyId);
          sessionStorage.setItem('selectedProxyText', proxyText);
          console.log(`Stored proxy selection: ${proxyText} (${proxyId})`);
        });
      }
      
      // Fix the continue button to properly transfer the proxy info
      const continueBtn = document.getElementById('continue-import-btn');
      if (continueBtn) {
        // Create a new button to replace the original (removes any existing handlers)
        const newContinueBtn = continueBtn.cloneNode(true);
        continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
        
        // Add our custom handler
        newContinueBtn.addEventListener('click', function() {
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
          
          // Get the proxy info
          const proxyId = proxySelect.value;
          const proxyOption = proxySelect.options[proxySelect.selectedIndex];
          const proxyText = proxyOption ? proxyOption.textContent.trim() : "None";
          console.log(`Continue clicked with proxy: ${proxyText} (${proxyId})`);
          
          // Determine which modal to show
          const importMethod = selectedOption.dataset.option;
          console.log(`Selected import method: ${importMethod}`);
          
          // Close the current modal
          document.getElementById('modal-container').classList.remove('active');
          document.getElementById('account-import-modal').classList.remove('active');
          
          // CRITICAL FIX: Need to update the proxy display elements BEFORE showing the next modal
          // Get all proxy display elements ready
          const sessionProxyDisplay = document.getElementById('session-selected-proxy');
          const tdataProxyDisplay = document.getElementById('tdata-selected-proxy');
          const phoneProxyDisplay = document.getElementById('phone-selected-proxy');
          
          // Update ALL of them with the selected proxy text
          if (sessionProxyDisplay) sessionProxyDisplay.textContent = proxyText;
          if (tdataProxyDisplay) tdataProxyDisplay.textContent = proxyText;
          if (phoneProxyDisplay) phoneProxyDisplay.textContent = proxyText;
          
          console.log(`Updated proxy displays to: ${proxyText}`);
          
          // Show the appropriate next modal
          document.getElementById('modal-container').classList.add('active');
          
          if (importMethod === 'session') {
            document.getElementById('session-import-modal').classList.add('active');
          } else if (importMethod === 'tdata') {
            document.getElementById('tdata-import-modal').classList.add('active');
          } else if (importMethod === 'phone') {
            document.getElementById('phone-import-modal').classList.add('active');
          }
        });
        
        console.log("Replaced continue button handler");
      }
    }
    
    // Fix 2: File input handling
    function fixFileInputs() {
      console.log("Setting up file input fix");
      
      // Fix the TData file upload
      const tdataInput = document.getElementById('tdata-input');
      const tdataArea = document.getElementById('tdata-upload-area');
      const tdataStatus = document.getElementById('upload-status');
      const tdataStatusText = document.getElementById('upload-status-text');
      const tdataSubmitBtn = document.getElementById('import-tdata-submit-btn');
      
      // First, reset file input value to ensure change events trigger
      if (tdataInput) tdataInput.value = '';
      
      if (tdataInput && tdataArea) {
        console.log("Setting up TData file handlers");
        
        // Direct file input change event
        tdataInput.onchange = function(event) {
          // This is the core file selection handler
          console.log("TData file input changed");
          
          if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            console.log(`File selected: ${file.name} (${file.size} bytes)`);
            
            // Update UI
            if (tdataStatusText) {
              tdataStatusText.textContent = `Selected: ${file.name}`;
            }
            
            if (tdataStatus) {
              tdataStatus.style.display = 'block';
            }
            
            if (tdataSubmitBtn) {
              tdataSubmitBtn.disabled = false;
            }
          } else {
            console.log("No file selected in change event");
          }
        };
        
        // Ensure the browse button works
        const browseBtn = tdataArea.querySelector('label.btn');
        if (browseBtn) {
          browseBtn.onclick = function(e) {
            // Stop propagation to prevent the upload area click from firing too
            e.stopPropagation();
            console.log("Browse button clicked");
            // Trigger the file input click
            tdataInput.click();
          };
        }
        
        // Fix the upload area click
        tdataArea.onclick = function(e) {
          // Only trigger the file input if we didn't click on a button or input
          if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
            console.log("Upload area clicked");
            tdataInput.click();
          }
        };
        
        // Fix drag and drop
        tdataArea.ondragover = function(e) {
          e.preventDefault();
          this.classList.add('dragover');
        };
        
        tdataArea.ondragleave = function(e) {
          e.preventDefault();
          this.classList.remove('dragover');
        };
        
        tdataArea.ondrop = function(e) {
          e.preventDefault();
          this.classList.remove('dragover');
          
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            console.log(`File dropped: ${file.name}`);
            
            // Create a new FileList-like object to set the file input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            // Set the file input's files property
            tdataInput.files = dataTransfer.files;
            
            // Manually trigger the change event
            const event = new Event('change', { bubbles: true });
            tdataInput.dispatchEvent(event);
          }
        };
      }
      
      // Also fix the session file upload in the same way
      const sessionFileInput = document.getElementById('session-file-input');
      const sessionArea = document.getElementById('session-upload-area');
      const sessionFileInfo = document.getElementById('session-file-info');
      
      if (sessionFileInput) sessionFileInput.value = '';
      
      if (sessionFileInput && sessionArea) {
        console.log("Setting up Session file handlers");
        
        // Direct file input change event
        sessionFileInput.onchange = function(event) {
          console.log("Session file input changed");
          
          if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            console.log(`File selected: ${file.name} (${file.size} bytes)`);
            
            // Update info display
            if (sessionFileInfo) {
              sessionFileInfo.textContent = `Selected: ${file.name}`;
            }
          }
        };
        
        // Ensure the browse button works
        const browseBtn = sessionArea.querySelector('label.btn');
        if (browseBtn) {
          browseBtn.onclick = function(e) {
            e.stopPropagation();
            console.log("Session browse button clicked");
            sessionFileInput.click();
          };
        }
        
        // Fix the upload area click
        sessionArea.onclick = function(e) {
          if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
            console.log("Session upload area clicked");
            sessionFileInput.click();
          }
        };
      }
      
      // Fix the JSON file upload too
      const jsonFileInput = document.getElementById('json-file-input');
      const jsonArea = document.getElementById('json-upload-area');
      const jsonFileInfo = document.getElementById('json-file-info');
      
      if (jsonFileInput) jsonFileInput.value = '';
      
      if (jsonFileInput && jsonArea) {
        console.log("Setting up JSON file handlers");
        
        // Direct file input change event
        jsonFileInput.onchange = function(event) {
          console.log("JSON file input changed");
          
          if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            console.log(`File selected: ${file.name} (${file.size} bytes)`);
            
            // Update info display
            if (jsonFileInfo) {
              jsonFileInfo.textContent = `Selected: ${file.name}`;
            }
          }
        };
        
        // Ensure the browse button works
        const browseBtn = jsonArea.querySelector('label.btn');
        if (browseBtn) {
          browseBtn.onclick = function(e) {
            e.stopPropagation();
            console.log("JSON browse button clicked");
            jsonFileInput.click();
          };
        }
        
        // Fix the upload area click
        jsonArea.onclick = function(e) {
          if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
            console.log("JSON upload area clicked");
            jsonFileInput.click();
          }
        };
      }
    }
    
    // Apply fixes when "Add Account" button is clicked
    function attachToAddAccountButton() {
      console.log("Setting up Add Account button handlers");
      
      const addAccountBtn = document.getElementById('add-account-btn');
      if (addAccountBtn) {
        addAccountBtn.addEventListener('click', function() {
          console.log("Add Account button clicked, applying fixes in 200ms");
          
          // Apply our fixes after a short delay
          setTimeout(() => {
            fixProxyTransfer();
            fixFileInputs();
            
            // Fix import options too
            fixImportOptions();
          }, 200);
        });
      }
      
      // Also fix the empty state add button
      const emptyAddBtn = document.getElementById('empty-add-btn');
      if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', function() {
          console.log("Empty Add button clicked, applying fixes in 200ms");
          
          // Apply our fixes after a short delay
          setTimeout(() => {
            fixProxyTransfer();
            fixFileInputs();
            
            // Fix import options too
            fixImportOptions();
          }, 200);
        });
      }
    }
    
    // Fix import options
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
    
    // Initialize our fixes
    function init() {
      console.log("Initializing account modal fixes");
      
      // Check if we're on the right page
      if (!document.getElementById('add-account-btn')) {
        console.log("Not on the accounts page, fixes will not be applied");
        return;
      }
      
      // Attach handlers to the add account buttons
      attachToAddAccountButton();
      
      // Apply the fixes immediately if a modal is already open
      if (document.getElementById('modal-container').classList.contains('active')) {
        console.log("Modal already open, applying fixes immediately");
        fixProxyTransfer();
        fixFileInputs();
        fixImportOptions();
      }
    }
    
    // Run the initialization
    init();
    
    // Return the fix functions for manual triggering if needed
    return {
      fixProxyTransfer,
      fixFileInputs,
      fixImportOptions
    };
  })();