// accountModalFix.js
// Add this script to fix the import option buttons in the account modal
document.addEventListener('DOMContentLoaded', function() {
    // Fix for import options in account modal
    function fixImportOptionButtons() {
      console.log('Fixing import option buttons...');
      
      // Get the import options
      const importOptions = document.querySelectorAll('.import-option');
      console.log('Found ' + importOptions.length + ' import options');
      
      // Add click event handlers
      importOptions.forEach(option => {
        // Remove existing event listeners by cloning and replacing
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
        
        // Add click event listener
        newOption.addEventListener('click', function() {
          console.log('Import option clicked: ' + this.dataset.option);
          
          // Remove selected class from all options
          document.querySelectorAll('.import-option').forEach(o => {
            o.classList.remove('selected');
          });
          
          // Add selected class to clicked option
          this.classList.add('selected');
        });
      });
      
      // Fix continue button
      const continueBtn = document.getElementById('continue-import-btn');
      if (continueBtn) {
        console.log('Found continue button, fixing...');
        
        // Clone to remove existing event listeners
        const newContinueBtn = continueBtn.cloneNode(true);
        continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
        
        // Add event listener
        newContinueBtn.addEventListener('click', function() {
          console.log('Continue button clicked');
          
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
          
          // Store selected proxy ID
          const selectedProxyId = proxySelect.value;
          
          // Get import method
          const importMethod = selectedOption.dataset.option;
          console.log('Selected import method: ' + importMethod);
          
          // Hide the import options modal
          document.getElementById('modal-container').classList.remove('active');
          document.getElementById('account-import-modal').classList.remove('active');
          
          // Show the appropriate import modal based on the selected method
          switch (importMethod) {
            case 'session':
              document.getElementById('modal-container').classList.add('active');
              document.getElementById('session-import-modal').classList.add('active');
              console.log('Showing session import modal');
              break;
            case 'tdata':
              document.getElementById('modal-container').classList.add('active');
              document.getElementById('tdata-import-modal').classList.add('active');
              console.log('Showing tdata import modal');
              break;
            case 'phone':
              document.getElementById('modal-container').classList.add('active');
              document.getElementById('phone-import-modal').classList.add('active');
              console.log('Showing phone import modal');
              break;
            default:
              alert('Invalid import method');
              break;
          }
        });
      } else {
        console.log('Continue button not found');
      }
    }
    
    // Add click handler to the add account button to ensure our fix runs
    const addAccountBtn = document.getElementById('add-account-btn');
    if (addAccountBtn) {
      const originalClickHandler = addAccountBtn.onclick;
      
      addAccountBtn.onclick = function(e) {
        // Call the original handler if it exists
        if (typeof originalClickHandler === 'function') {
          originalClickHandler.call(this, e);
        }
        
        // Apply our fix after a short delay to ensure the modal is shown
        setTimeout(fixImportOptionButtons, 100);
      };
    }
    
    // Also fix the empty add button
    const emptyAddBtn = document.getElementById('empty-add-btn');
    if (emptyAddBtn) {
      const originalEmptyClickHandler = emptyAddBtn.onclick;
      
      emptyAddBtn.onclick = function(e) {
        // Call the original handler if it exists
        if (typeof originalEmptyClickHandler === 'function') {
          originalEmptyClickHandler.call(this, e);
        }
        
        // Apply our fix after a short delay to ensure the modal is shown
        setTimeout(fixImportOptionButtons, 100);
      };
    }
  });