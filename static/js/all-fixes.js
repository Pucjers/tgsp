/**
 * TgNinja UI Fix Script
 *
 * This script consolidates all fixes for modal interactions, file uploads,
 * and other UI functionality issues in the TgNinja application.
 */

document.addEventListener("DOMContentLoaded", function () {
  console.log("🔧 UI Fix Script initialized");

  function fixModalCloseButtons() {
    console.log("Fixing modal close buttons");

    document
      .querySelectorAll(".btn-close, [data-close-modal]")
      .forEach((button) => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener("click", function () {
          const modalId = this.dataset.closeModal;
          if (modalId) {
            hideModal(modalId);
          }
        });
      });
  }

  function fixImportOptions() {
    console.log("Fixing import options");

    const importOptions = document.querySelectorAll(".import-option");

    importOptions.forEach((option) => {
      const newOption = option.cloneNode(true);
      option.parentNode.replaceChild(newOption, option);

      newOption.addEventListener("click", function () {
        console.log(`Import option clicked: ${this.dataset.option}`);

        document.querySelectorAll(".import-option").forEach((opt) => {
          opt.classList.remove("selected");
        });

        this.classList.add("selected");
      });
    });
  }

  function fixContinueButton() {
    console.log("Fixing continue import button");

    const continueBtn = document.getElementById("continue-import-btn");
    if (!continueBtn) return;

    const newContinueBtn = continueBtn.cloneNode(true);
    continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);

    newContinueBtn.addEventListener("click", function () {
      const selectedOption = document.querySelector(".import-option.selected");
      if (!selectedOption) {
        showToast("Please select an import method", "error");
        return;
      }

      const proxySelect = document.getElementById("account-proxy");
      if (!proxySelect || !proxySelect.value) {
        showToast("Please select a proxy", "error");
        return;
      }

      const proxyId = proxySelect.value;
      const proxyOption = proxySelect.options[proxySelect.selectedIndex];
      const proxyText = proxyOption ? proxyOption.textContent.trim() : "None";
      sessionStorage.setItem("selectedProxyId", proxyId);
      sessionStorage.setItem("selectedProxyText", proxyText);

      console.log(`Selected proxy: ${proxyText} (${proxyId})`);
      console.log(`Selected import method: ${selectedOption.dataset.option}`);

      hideModal("account-import-modal");

      const proxyDisplays = {
        session: document.getElementById("session-selected-proxy"),
        tdata: document.getElementById("tdata-selected-proxy"),
        phone: document.getElementById("phone-selected-proxy"),
      };

      Object.values(proxyDisplays).forEach((display) => {
        if (display) display.textContent = proxyText;
      });

      const modalMap = {
        session: "session-import-modal",
        tdata: "tdata-import-modal",
        phone: "phone-import-modal",
      };

      const targetModal = modalMap[selectedOption.dataset.option];
      if (targetModal) {
        showModal(targetModal);

        switch (selectedOption.dataset.option) {
          case "session":
            setupSessionImport(proxyId, proxyText);
            break;
          case "tdata":
            setupTDataImport(proxyId, proxyText);
            break;
          case "phone":
            setupPhoneImport(proxyId, proxyText);
            break;
        }
      }
    });
  }

  function fixFileUploads() {
    console.log("Fixing file upload areas");

    setupFileUpload(
      "session-file-input",
      "session-upload-area",
      "session-file-info",
      ".session"
    );

    setupFileUpload(
      "json-file-input",
      "json-upload-area",
      "json-file-info",
      ".json"
    );

    setupFileUpload(
      "tdata-input",
      "tdata-upload-area",
      "upload-status-text",
      ".zip",
      function (file) {
        const uploadStatus = document.getElementById("upload-status");
        const submitBtn = document.getElementById("import-tdata-submit-btn");

        if (uploadStatus) uploadStatus.style.display = "block";
        if (submitBtn) submitBtn.disabled = false;
      }
    );

    setupFileUpload("proxy-file-input", "proxy-upload-area", null, ".txt");
  }

  function setupFileUpload(inputId, areaId, infoId, fileExtension, callback) {
    const input = document.getElementById(inputId);
    const area = document.getElementById(areaId);
    const infoElement = infoId ? document.getElementById(infoId) : null;

    if (!input || !area) return;

    input.value = "";

    input.addEventListener("change", function (e) {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];

        if (file.name.endsWith(fileExtension)) {
          console.log(`File selected via input: ${file.name}`);

          if (infoElement) {
            infoElement.textContent = `Selected: ${file.name} (${formatFileSize(
              file.size
            )})`;
            infoElement.style.display = "block";
          }

          if (typeof callback === "function") {
            callback(file);
          }
        } else {
          showToast(`Please select a ${fileExtension} file`, "error");
        }
      }
    });

    const browseBtn = area.querySelector("label.btn");
    if (browseBtn) {
      browseBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Browse button clicked for ${inputId}`);
        input.click();
      });
    }

    area.addEventListener("dragover", function (e) {
      e.preventDefault();
      this.classList.add("dragover");
    });

    area.addEventListener("dragleave", function (e) {
      e.preventDefault();
      this.classList.remove("dragover");
    });

    area.addEventListener("drop", function (e) {
      e.preventDefault();
      this.classList.remove("dragover");

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];

        if (file.name.endsWith(fileExtension)) {
          console.log(`File dropped: ${file.name}`);

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;

          const event = new Event("change", { bubbles: true });
          input.dispatchEvent(event);
        } else {
          showToast(`Please select a ${fileExtension} file`, "error");
        }
      }
    });

    area.addEventListener("click", function (e) {
      if (e.target === area) {
        console.log(`Upload area clicked for ${inputId}`);
        input.click();
      }
    });
  }

  function setupSessionImport(proxyId, proxyText) {
    console.log("Setting up session import with proxy ID:", proxyId);

    const backBtn = document.getElementById(
      "back-to-import-options-btn-session"
    );
    if (backBtn) {
      const newBackBtn = backBtn.cloneNode(true);
      backBtn.parentNode.replaceChild(newBackBtn, backBtn);

      newBackBtn.addEventListener("click", function () {
        hideModal("session-import-modal");
        showModal("account-import-modal");
      });
    }

    const importBtn = document.getElementById("import-session-btn");
    if (importBtn) {
      const newImportBtn = importBtn.cloneNode(true);
      importBtn.parentNode.replaceChild(newImportBtn, importBtn);

      newImportBtn.addEventListener("click", function () {
        handleSessionImport(proxyId);
      });
    }
  }

  function setupTDataImport(proxyId, proxyText) {
    console.log("Setting up TData import with proxy ID:", proxyId);

    const backBtn = document.getElementById("back-to-import-options-btn-tdata");
    if (backBtn) {
      const newBackBtn = backBtn.cloneNode(true);
      backBtn.parentNode.replaceChild(newBackBtn, backBtn);

      newBackBtn.addEventListener("click", function () {
        hideModal("tdata-import-modal");
        showModal("account-import-modal");
      });
    }

    const uploadStatus = document.getElementById("upload-status");
    const progressBar = document.getElementById("upload-progress-bar");
    const statusText = document.getElementById("upload-status-text");

    if (uploadStatus) uploadStatus.style.display = "none";
    if (progressBar) progressBar.style.width = "0%";
    if (statusText) statusText.textContent = "";

    const importBtn = document.getElementById("import-tdata-submit-btn");
    if (importBtn) {
      importBtn.disabled = true;

      const newImportBtn = importBtn.cloneNode(true);
      importBtn.parentNode.replaceChild(newImportBtn, importBtn);

      newImportBtn.addEventListener("click", function () {
        handleTDataImport(proxyId);
      });
    }
  }

  function setupPhoneImport(proxyId, proxyText) {
    console.log("Setting up phone import with proxy ID:", proxyId);

    const backBtn = document.getElementById("back-to-import-options-btn-phone");
    if (backBtn) {
      const newBackBtn = backBtn.cloneNode(true);
      backBtn.parentNode.replaceChild(newBackBtn, backBtn);

      newBackBtn.addEventListener("click", function () {
        hideModal("phone-import-modal");
        showModal("account-import-modal");
      });
    }

    const phoneForm = document.getElementById("phone-import-form");
    if (phoneForm) phoneForm.reset();

    const avatarPreview = document.getElementById("avatar-preview");
    if (avatarPreview) avatarPreview.innerHTML = '<i class="fas fa-user"></i>';

    const avatarUrlInput = document.getElementById("avatar-url");
    if (avatarUrlInput) avatarUrlInput.value = "";

    const verificationCodeRow = document.getElementById(
      "verification-code-row"
    );
    if (verificationCodeRow) verificationCodeRow.style.display = "none";

    const phoneImportFooter = document.getElementById("phone-import-footer");
    const phoneVerifyFooter = document.getElementById("phone-verify-footer");

    if (phoneImportFooter) phoneImportFooter.style.display = "block";
    if (phoneVerifyFooter) phoneVerifyFooter.style.display = "none";

    const requestCodeBtn = document.getElementById("request-code-btn");
    if (requestCodeBtn) {
      const newRequestCodeBtn = requestCodeBtn.cloneNode(true);
      requestCodeBtn.parentNode.replaceChild(newRequestCodeBtn, requestCodeBtn);

      newRequestCodeBtn.addEventListener("click", function () {
        handleRequestCode(proxyId);
      });
    }

    const verifyCodeBtn = document.getElementById("verify-code-btn");
    if (verifyCodeBtn) {
      const newVerifyCodeBtn = verifyCodeBtn.cloneNode(true);
      verifyCodeBtn.parentNode.replaceChild(newVerifyCodeBtn, verifyCodeBtn);

      newVerifyCodeBtn.addEventListener("click", function () {
        handleVerifyCode(proxyId);
      });
    }

    const backToPhoneBtn = document.getElementById("back-to-phone-input-btn");
    if (backToPhoneBtn) {
      const newBackToPhoneBtn = backToPhoneBtn.cloneNode(true);
      backToPhoneBtn.parentNode.replaceChild(newBackToPhoneBtn, backToPhoneBtn);

      newBackToPhoneBtn.addEventListener("click", function () {
        if (phoneImportFooter) phoneImportFooter.style.display = "block";
        if (phoneVerifyFooter) phoneVerifyFooter.style.display = "none";

        if (verificationCodeRow) verificationCodeRow.style.display = "none";
      });
    }

    setupAvatarUpload();
  }

  function handleSessionImport(proxyId) {
    console.log("Handling session import with proxy ID:", proxyId);

    const sessionInput = document.getElementById("session-file-input");
    if (
      !sessionInput ||
      !sessionInput.files ||
      sessionInput.files.length === 0
    ) {
      showToast("Please select a session file", "error");
      return;
    }

    const importBtn = document.getElementById("import-session-btn");
    if (importBtn) {
      importBtn.disabled = true;
      importBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Importing...';
    }

    const formData = new FormData();
    formData.append("session_file", sessionInput.files[0]);

    const jsonInput = document.getElementById("json-file-input");
    if (jsonInput && jsonInput.files && jsonInput.files.length > 0) {
      formData.append("json_file", jsonInput.files[0]);
    }

    const listSelect = document.getElementById("session-account-list");
    if (listSelect) {
      formData.append("list_id", listSelect.value);
    }

    formData.append("proxy_id", proxyId);

    const nameInput = document.getElementById("session-account-name");
    if (nameInput && nameInput.value.trim()) {
      formData.append("name", nameInput.value.trim());
    }

    fetch("/api/accounts/import-session", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((data) => {
            throw new Error(data.error || "Failed to import session");
          });
        }
        return response.json();
      })
      .then((result) => {
        if (result.success) {
          showToast("Account imported successfully", "success");

          hideModal("session-import-modal");

          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          throw new Error(result.error || "Failed to import session");
        }
      })
      .catch((error) => {
        console.error("Error importing session:", error);
        showToast(`Error: ${error.message}`, "error");

        if (importBtn) {
          importBtn.disabled = false;
          importBtn.innerHTML = "Import Account";
        }
      });
  }

  function handleTDataImport(proxyId) {
    console.log("Handling TData import with proxy ID:", proxyId);

    const uploadInput = document.getElementById("tdata-input");
    if (!uploadInput || !uploadInput.files || uploadInput.files.length === 0) {
      showToast("Please select a TData ZIP file", "error");
      return;
    }

    const file = uploadInput.files[0];

    const listSelect = document.getElementById("tdata-account-list");
    const listId = listSelect ? listSelect.value : "main";

    const submitBtn = document.getElementById("import-tdata-submit-btn");
    const progressBar = document.getElementById("upload-progress-bar");
    const statusText = document.getElementById("upload-status-text");

    if (submitBtn) submitBtn.disabled = true;
    if (statusText)
      statusText.textContent = "Uploading and processing TData...";

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      if (progress > 90) {
        clearInterval(interval);
      }
      if (progressBar) progressBar.style.width = `${progress}%`;
    }, 300);

    const formData = new FormData();
    formData.append("tdata_zip", file);
    formData.append("target_list_id", listId);
    formData.append("proxy_id", proxyId);

    fetch("/api/accounts/import-tdata-zip", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((data) => {
            throw new Error(data.error || "Failed to import TData");
          });
        }
        return response.json();
      })
      .then((result) => {
        clearInterval(interval);

        if (result.success) {
          if (progressBar) progressBar.style.width = "100%";
          if (statusText)
            statusText.textContent = "TData imported successfully!";

          setTimeout(() => {
            hideModal("tdata-import-modal");

            showToast("Account imported successfully", "success");

            window.location.reload();
          }, 1000);
        } else {
          throw new Error(result.error || "Failed to import TData");
        }
      })
      .catch((error) => {
        console.error("Error importing TData:", error);

        clearInterval(interval);

        if (progressBar) progressBar.style.width = "0%";
        if (statusText) statusText.textContent = `Error: ${error.message}`;
        if (submitBtn) submitBtn.disabled = false;

        showToast(`Error: ${error.message}`, "error");
      });
  }

  function handleRequestCode(proxyId) {
    console.log("Handling request code with proxy ID:", proxyId);

    const nameInput = document.getElementById("name");
    const phoneInput = document.getElementById("phone");

    if (!nameInput || !nameInput.value.trim()) {
      showToast("Please enter a name", "error");
      nameInput.focus();
      return;
    }

    if (!phoneInput || !phoneInput.value.trim()) {
      showToast("Please enter a phone number", "error");
      phoneInput.focus();
      return;
    }

    const requestBtn = document.getElementById("request-code-btn");
    if (requestBtn) {
      requestBtn.disabled = true;
      requestBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Requesting...';
    }

    fetch("/api/accounts/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phoneInput.value.trim(),
        proxy_id: proxyId,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((data) => {
            throw new Error(
              data.error || "Failed to request verification code"
            );
          });
        }
        return response.json();
      })
      .then((result) => {
        if (result.success) {
          const codeRow = document.getElementById("verification-code-row");
          const phoneFooter = document.getElementById("phone-import-footer");
          const verifyFooter = document.getElementById("phone-verify-footer");

          if (codeRow) codeRow.style.display = "block";
          if (phoneFooter) phoneFooter.style.display = "none";
          if (verifyFooter) verifyFooter.style.display = "block";

          const codeInput = document.getElementById("verification-code");
          if (codeInput) codeInput.focus();

          showToast("Verification code sent to your Telegram app", "success");
        } else {
          throw new Error(
            result.error || "Failed to request verification code"
          );
        }
      })
      .catch((error) => {
        console.error("Error requesting code:", error);
        showToast(`Error: ${error.message}`, "error");

        if (requestBtn) {
          requestBtn.disabled = false;
          requestBtn.innerHTML = "Request Code";
        }
      });
  }

  function handleVerifyCode(proxyId) {
    console.log("Handling verify code with proxy ID:", proxyId);

    const codeInput = document.getElementById("verification-code");

    if (!codeInput || !codeInput.value.trim()) {
      showToast("Please enter the verification code", "error");
      codeInput.focus();
      return;
    }

    const verifyBtn = document.getElementById("verify-code-btn");
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    }

    const nameInput = document.getElementById("name");
    const phoneInput = document.getElementById("phone");
    const usernameInput = document.getElementById("username");
    const avatarUrlInput = document.getElementById("avatar-url");
    const listSelect = document.getElementById("account-list");
    const limitInvitesInput = document.getElementById("limit-invites");
    const limitMessagesInput = document.getElementById("limit-messages");

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
        daily_messages: parseInt(limitMessagesInput.value) || 50,
      },
    };

    fetch("/api/accounts/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountData),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((data) => {
            throw new Error(data.error || "Failed to verify code");
          });
        }
        return response.json();
      })
      .then((result) => {
        if (result.success) {
          showToast("Account verified and added successfully", "success");

          hideModal("phone-import-modal");

          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          throw new Error(result.error || "Failed to verify account");
        }
      })
      .catch((error) => {
        console.error("Error verifying code:", error);
        showToast(`Error: ${error.message}`, "error");

        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = "Verify & Add Account";
        }
      });
  }

  function setupAvatarUpload() {
    const avatarInput = document.getElementById("avatar-input");
    const avatarPreview = document.getElementById("avatar-preview");
    const avatarUrlInput = document.getElementById("avatar-url");

    if (!avatarInput || !avatarPreview || !avatarUrlInput) return;

    avatarInput.value = "";

    const newAvatarInput = avatarInput.cloneNode(true);
    avatarInput.parentNode.replaceChild(newAvatarInput, avatarInput);

    newAvatarInput.addEventListener("change", async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];

        const formData = new FormData();
        formData.append("avatar", file);

        try {
          const response = await fetch("/api/accounts/upload-avatar", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to upload avatar");
          }

          const result = await response.json();

          if (result.url) {
            avatarPreview.innerHTML = `<img src="${result.url}" alt="Avatar">`;

            avatarUrlInput.value = result.url;
          } else {
            throw new Error("No URL returned from server");
          }
        } catch (error) {
          console.error("Error uploading avatar:", error);
          showToast("Error uploading avatar: " + error.message, "error");
        }
      }
    });
  }

  function fixManualGroupModal() {
    console.log("Fixing manual group modal");

    let modal = document.getElementById("add-group-manually-modal");

    if (
      modal &&
      modal.parentElement &&
      modal.parentElement.id !== "modal-container"
    ) {
      console.log("Moving manual group modal into modal container");

      const modalContainer = document.getElementById("modal-container");

      if (modalContainer) {
        modal.parentElement.removeChild(modal);

        modalContainer.appendChild(modal);
      }
    }

    const addGroupManuallyBtn = document.getElementById(
      "add-group-manually-btn"
    );
    if (addGroupManuallyBtn) {
      addGroupManuallyBtn.addEventListener("click", function () {
        showModal("add-group-manually-modal");
      });
    }
  }

  function showModal(modalId) {
    const modalContainer = document.getElementById("modal-container");
    const modal = document.getElementById(modalId);

    if (modalContainer && modal) {
      modalContainer.classList.add("active");
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  function hideModal(modalId) {
    const modalContainer = document.getElementById("modal-container");
    const modal = document.getElementById(modalId);

    if (modalContainer && modal) {
      modalContainer.classList.remove("active");
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  function showToast(message, type = "info") {
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      document.body.appendChild(toast);

      const style = document.createElement("style");
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

    toast.textContent = message;
    toast.className = type;

    setTimeout(() => {
      toast.classList.add("visible");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("visible");
    }, 3000);
  }

  function initializeFixes() {
    console.log("Initializing TgNinja UI fixes");

    const path = window.location.pathname;
    const isAccountsPage = path === "/" || path === "/index.html";
    const isParserPage = path === "/group-parser.html";
    const isProxiesPage = path === "/proxies.html";

    console.log(`Current page: ${path}`);

    fixModalCloseButtons();

    if (isAccountsPage) {
      const addAccountBtn = document.getElementById("add-account-btn");
      const emptyAddBtn = document.getElementById("empty-add-btn");

      if (addAccountBtn) {
        addAccountBtn.addEventListener("click", function () {
          setTimeout(() => {
            fixImportOptions();
            fixContinueButton();
            fixFileUploads();
          }, 100);
        });
      }

      if (emptyAddBtn) {
        emptyAddBtn.addEventListener("click", function () {
          setTimeout(() => {
            fixImportOptions();
            fixContinueButton();
            fixFileUploads();
          }, 100);
        });
      }
    }

    if (isParserPage) {
      fixManualGroupModal();
    }

    if (
      document.getElementById("modal-container") &&
      document.getElementById("modal-container").classList.contains("active")
    ) {
      console.log("Modal already open, applying relevant fixes immediately");

      if (isAccountsPage && document.getElementById("account-import-modal")) {
        fixImportOptions();
        fixContinueButton();
        fixFileUploads();
      }

      if (isParserPage && document.getElementById("add-group-manually-modal")) {
        fixManualGroupModal();
      }
    }
  }

  initializeFixes();
});
