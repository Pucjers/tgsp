/**
 * Telegram Account Import Implementation
 *
 * This script handles the implementation of two account import methods:
 * 1. Session + JSON import
 * 2. Phone number import with verification code
 *
 * Both methods require proxy integration.
 */

document.addEventListener("DOMContentLoaded", function () {
  const elements = {
    sessionForm: document.getElementById("session-import-form"),
    sessionFileInput: document.getElementById("session-file-input"),
    sessionUploadArea: document.getElementById("session-upload-area"),
    sessionFileInfo: document.getElementById("session-file-info"),
    jsonFileInput: document.getElementById("json-file-input"),
    jsonUploadArea: document.getElementById("json-upload-area"),
    jsonFileInfo: document.getElementById("json-file-info"),
    importSessionBtn: document.getElementById("import-session-btn"),
    sessionProxyDisplay: document.getElementById("session-selected-proxy"),
    sessionAccountList: document.getElementById("session-account-list"),
    sessionAccountName: document.getElementById("session-account-name"),

    phoneForm: document.getElementById("phone-import-form"),
    phoneInput: document.getElementById("phone"),
    nameInput: document.getElementById("name"),
    usernameInput: document.getElementById("username"),
    verificationCodeInput: document.getElementById("verification-code"),
    verificationCodeRow: document.getElementById("verification-code-row"),
    phoneImportFooter: document.getElementById("phone-import-footer"),
    phoneVerifyFooter: document.getElementById("phone-verify-footer"),
    requestCodeBtn: document.getElementById("request-code-btn"),
    verifyCodeBtn: document.getElementById("verify-code-btn"),
    avatarInput: document.getElementById("avatar-input"),
    avatarPreview: document.getElementById("avatar-preview"),
    avatarUrlInput: document.getElementById("avatar-url"),
    phoneProxyDisplay: document.getElementById("phone-selected-proxy"),
    accountList: document.getElementById("account-list"),

    backToImportBtnSession: document.getElementById(
      "back-to-import-options-btn-session"
    ),
    backToImportBtnPhone: document.getElementById(
      "back-to-import-options-btn-phone"
    ),
    backToPhoneInputBtn: document.getElementById("back-to-phone-input-btn"),

    modalContainer: document.getElementById("modal-container"),
  };

  /**
   * Initialize session import functionality
   * @param {string} proxyId - Selected proxy ID
   */
  function setupSessionImport(proxyId) {
    updateProxyDisplay(elements.sessionProxyDisplay, proxyId);

    setupFileUpload(
      elements.sessionFileInput,
      elements.sessionUploadArea,
      elements.sessionFileInfo,
      ".session",
      "Session"
    );

    setupFileUpload(
      elements.jsonFileInput,
      elements.jsonUploadArea,
      elements.jsonFileInfo,
      ".json",
      "JSON"
    );

    elements.backToImportBtnSession.onclick = function () {
      hideModal("session-import-modal");
      showModal("account-import-modal");
    };

    elements.importSessionBtn.onclick = function () {
      handleSessionImport(proxyId);
    };
  }

  /**
   * Handle the session import process
   * @param {string} proxyId - Selected proxy ID
   */
  async function handleSessionImport(proxyId) {
    if (!elements.sessionFileInput.files.length) {
      showToast("Please select a session file", "error");
      return;
    }

    const sessionFile = elements.sessionFileInput.files[0];
    const jsonFile = elements.jsonFileInput.files.length
      ? elements.jsonFileInput.files[0]
      : null;
    const listId = elements.sessionAccountList.value;
    const customName = elements.sessionAccountName.value.trim();

    elements.importSessionBtn.disabled = true;
    elements.importSessionBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Importing...';

    try {
      const formData = new FormData();
      formData.append("session_file", sessionFile);

      if (jsonFile) {
        formData.append("json_file", jsonFile);
      }

      formData.append("list_id", listId);
      formData.append("proxy_id", proxyId);

      if (customName) {
        formData.append("name", customName);
      }

      const response = await fetch("/api/accounts/import-session", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import account");
      }

      const result = await response.json();

      showToast("Account imported successfully", "success");

      hideModal("session-import-modal");

      if (typeof loadAccounts === "function") {
        await loadAccounts(state.currentListId);
        await loadStats(state.currentListId);
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error("Error importing session:", error);
      showToast("Error importing account: " + error.message, "error");
    } finally {
      elements.importSessionBtn.disabled = false;
      elements.importSessionBtn.innerHTML = "Import Account";
    }
  }

  /**
   * Initialize phone number import functionality
   * @param {string} proxyId - Selected proxy ID
   */
  function setupPhoneImport(proxyId) {
    updateProxyDisplay(elements.phoneProxyDisplay, proxyId);

    elements.phoneForm.reset();

    elements.avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
    elements.avatarUrlInput.value = "";

    elements.verificationCodeRow.style.display = "none";

    elements.phoneImportFooter.style.display = "block";
    elements.phoneVerifyFooter.style.display = "none";

    setupAvatarUpload();

    elements.backToImportBtnPhone.onclick = function () {
      hideModal("phone-import-modal");
      showModal("account-import-modal");
    };

    elements.requestCodeBtn.onclick = function () {
      handleRequestCode(proxyId);
    };

    elements.verifyCodeBtn.onclick = function () {
      handleVerifyCode(proxyId);
    };

    elements.backToPhoneInputBtn.onclick = function () {
      elements.phoneImportFooter.style.display = "block";
      elements.phoneVerifyFooter.style.display = "none";

      elements.verificationCodeRow.style.display = "none";
    };
  }

  async function handleRequestCode(proxyId) {
    const name = elements.nameInput.value.trim();
    const phone = elements.phoneInput.value.trim();

    if (!name) {
      showToast("Please enter a name", "error");
      elements.nameInput.focus();
      return;
    }

    if (!phone) {
      showToast("Please enter a phone number", "error");
      elements.phoneInput.focus();
      return;
    }

    elements.requestCodeBtn.disabled = true;
    elements.requestCodeBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Requesting...';

    try {
      const response = await fetch("/api/accounts/request-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          proxy_id: proxyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to request verification code"
        );
      }

      const result = await response.json();

      if (result.success) {
        elements.verificationCodeRow.style.display = "block";
        elements.phoneImportFooter.style.display = "none";
        elements.phoneVerifyFooter.style.display = "block";

        showToast("Verification code sent to your Telegram app", "success");

        setTimeout(() => {
          elements.verificationCodeInput.focus();
        }, 100);
      } else {
        throw new Error(result.error || "Failed to request verification code");
      }
    } catch (error) {
      console.error("Error requesting code:", error);
      showToast("Error: " + error.message, "error");
    } finally {
      elements.requestCodeBtn.disabled = false;
      elements.requestCodeBtn.innerHTML = "Request Code";
    }
  }

  /**
   * Handle the verification code submission
   * @param {string} proxyId - Selected proxy ID
   */
  async function handleVerifyCode(proxyId) {
    const code = elements.verificationCodeInput.value.trim();

    if (!code) {
      showToast("Please enter the verification code", "error");
      elements.verificationCodeInput.focus();
      return;
    }

    elements.verifyCodeBtn.disabled = true;
    elements.verifyCodeBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
      const accountData = {
        name: elements.nameInput.value.trim(),
        phone: elements.phoneInput.value.trim(),
        username: elements.usernameInput.value.trim().replace("@", ""),
        avatar: elements.avatarUrlInput.value,
        list_id: elements.accountList.value,
        proxy_id: proxyId,
        code: code,
        limits: {
          daily_invites:
            parseInt(document.getElementById("limit-invites").value) || 30,
          daily_messages:
            parseInt(document.getElementById("limit-messages").value) || 50,
        },
      };

      const response = await fetch("/api/accounts/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(accountData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify code");
      }

      const result = await response.json();

      if (result.success) {
        showToast("Account verified and added successfully", "success");

        hideModal("phone-import-modal");

        if (typeof loadAccounts === "function") {
          await loadAccounts(state.currentListId);
          await loadStats(state.currentListId);
        } else {
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } else {
        throw new Error(result.error || "Failed to verify account");
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      showToast("Error: " + error.message, "error");
    } finally {
      elements.verifyCodeBtn.disabled = false;
      elements.verifyCodeBtn.innerHTML = "Verify & Add Account";
    }
  }

  /**
   * Set up file upload functionality for an area
   * @param {HTMLElement} fileInput - The file input element
   * @param {HTMLElement} uploadArea - The upload area element
   * @param {HTMLElement} infoElement - The element to display file info
   * @param {string} fileExtension - The allowed file extension
   * @param {string} fileType - The file type name for display
   */
  function setupFileUpload(
    fileInput,
    uploadArea,
    infoElement,
    fileExtension,
    fileType
  ) {
    if (!fileInput || !uploadArea) return;

    fileInput.value = "";

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];

        if (file.name.endsWith(fileExtension)) {
          displayFileInfo(file, infoElement);
        } else {
          showToast(`Please select a ${fileExtension} file`, "error");
        }
      }
    });

    uploadArea.addEventListener("click", (e) => {
      if (e.target === uploadArea || e.target.tagName !== "INPUT") {
        fileInput.click();
      }
    });

    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];

        if (file.name.endsWith(fileExtension)) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;

          displayFileInfo(file, infoElement);
        } else {
          showToast(`Please select a ${fileExtension} file`, "error");
        }
      }
    });

    const browseButton = uploadArea.querySelector("label.btn");
    if (browseButton) {
      browseButton.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      };
    }
  }

  /**
   * Display file information
   * @param {File} file - The selected file
   * @param {HTMLElement} infoElement - The element to display file info
   */
  function displayFileInfo(file, infoElement) {
    if (!infoElement) return;

    const fileSize = formatFileSize(file.size);
    infoElement.textContent = `Selected: ${file.name} (${fileSize})`;
    infoElement.style.display = "block";
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + " B";
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + " KB";
    } else {
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }
  }

  /**
   * Set up avatar upload functionality
   */
  function setupAvatarUpload() {
    if (!elements.avatarInput || !elements.avatarPreview) return;

    elements.avatarInput.value = "";

    elements.avatarInput.addEventListener("change", async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];

        if (file.type.startsWith("image/")) {
          try {
            const formData = new FormData();
            formData.append("avatar", file);

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
              elements.avatarPreview.innerHTML = `<img src="${result.url}" alt="Avatar">`;

              elements.avatarUrlInput.value = result.url;
            } else {
              throw new Error("No URL returned from server");
            }
          } catch (error) {
            console.error("Error uploading avatar:", error);
            showToast("Error uploading avatar: " + error.message, "error");
          }
        } else {
          showToast("Please select an image file", "error");
        }
      }
    });

    const avatarUploadBtn = elements.avatarPreview.nextElementSibling;
    if (avatarUploadBtn) {
      avatarUploadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        elements.avatarInput.click();
      });
    }
  }

  /**
   * Update the proxy display element with the selected proxy info
   * @param {HTMLElement} displayElement - The element to display the proxy info
   * @param {string} proxyId - The selected proxy ID
   */
  function updateProxyDisplay(displayElement, proxyId) {
    if (!displayElement) return;

    const proxy =
      window.state && window.state.proxies
        ? window.state.proxies.find((p) => p.id === proxyId)
        : null;

    if (proxy) {
      displayElement.textContent = `${proxy.host}:${proxy.port}`;
    } else {
      const proxySelect = document.getElementById("account-proxy");
      if (proxySelect) {
        const selectedOption = Array.from(proxySelect.options).find(
          (opt) => opt.value === proxyId
        );
        if (selectedOption) {
          displayElement.textContent = selectedOption.textContent.trim();
        } else {
          displayElement.textContent = "None";
        }
      } else {
        displayElement.textContent = proxyId ? proxyId : "None";
      }
    }
  }

  /**
   * Show a modal dialog
   * @param {string} modalId - The ID of the modal to show
   */
  function showModal(modalId) {
    const modalContainer = document.getElementById("modal-container");
    const modal = document.getElementById(modalId);

    if (modalContainer && modal) {
      modalContainer.classList.add("active");
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  /**
   * Hide a modal dialog
   * @param {string} modalId - The ID of the modal to hide
   */
  function hideModal(modalId) {
    const modalContainer = document.getElementById("modal-container");
    const modal = document.getElementById(modalId);

    if (modalContainer && modal) {
      modalContainer.classList.remove("active");
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - The type of notification (info, success, error, warning)
   */
  function showToast(message, type = "info") {
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      document.body.appendChild(toast);
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

  window.accountImporter = {
    setupSessionImport,
    handleSessionImport,
    setupPhoneImport,
    handleRequestCode,
    handleVerifyCode,
  };

  function setupAccountImportHandlers() {
    const addAccountBtn = document.getElementById("add-account-btn");
    const emptyAddBtn = document.getElementById("empty-add-btn");
    const continueImportBtn = document.getElementById("continue-import-btn");

    [addAccountBtn, emptyAddBtn].forEach((btn) => {
      if (btn) {
        btn.addEventListener("click", () => {
          setTimeout(() => {
            setupImportOptions();
          }, 100);
        });
      }
    });

    if (continueImportBtn) {
      continueImportBtn.addEventListener("click", handleContinueImport);
    }
  }

  /**
   * Set up import options selection
   */
  function setupImportOptions() {
    const importOptions = document.querySelectorAll(".import-option");

    importOptions.forEach((option) => {
      option.addEventListener("click", function () {
        importOptions.forEach((opt) => {
          opt.classList.remove("selected");
        });

        this.classList.add("selected");
      });
    });
  }

  /**
   * Handle continuing to the next step of import
   */
  function handleContinueImport() {
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

    const selectedProxyId = proxySelect.value;

    const importMethod = selectedOption.dataset.option;

    hideModal("account-import-modal");

    switch (importMethod) {
      case "session":
        showModal("session-import-modal");
        setupSessionImport(selectedProxyId);
        break;
      case "tdata":
        showModal("tdata-import-modal");
        break;
      case "phone":
        showModal("phone-import-modal");
        setupPhoneImport(selectedProxyId);
        break;
      default:
        showToast("Invalid import method", "error");
        break;
    }
  }

  setupAccountImportHandlers();
});
