document.addEventListener("DOMContentLoaded", function () {
  const state = {
    proxies: [],
    selectedProxies: new Set(),
    accounts: [],
  };

  const elements = {
    proxiesTableBody: document.getElementById("proxies-table-body"),
    emptyProxyState: document.getElementById("empty-proxy-state"),
    selectAllCheckbox: document.getElementById("select-all-checkbox"),
    proxySelectionActions: document.getElementById("proxy-selection-actions"),
    selectedCount: document.getElementById("selected-count"),
    testSelectedBtn: document.getElementById("test-selected-btn"),
    testSelectedProxiesBtn: document.getElementById(
      "test-selected-proxies-btn"
    ),
    deleteSelectedProxiesBtn: document.getElementById(
      "delete-selected-proxies-btn"
    ),
    modalContainer: document.getElementById("modal-container"),
    addProxyBtn: document.getElementById("add-proxy-btn"),
    emptyAddBtn: document.getElementById("empty-add-btn"),
    searchInput: document.getElementById("search-input"),
    proxyCount: document.getElementById("proxy-count"),
  };

  const api = {
    async getProxies() {
      try {
        const response = await fetch("/api/proxies");
        if (!response.ok) throw new Error("Failed to fetch proxies");
        return await response.json();
      } catch (error) {
        console.error("Error fetching proxies:", error);
        showToast("Error loading proxies", "error");
        return [];
      }
    },

    async getProxy(proxyId) {
      try {
        const response = await fetch(`/api/proxies/${proxyId}`);
        if (!response.ok) throw new Error("Failed to fetch proxy");
        return await response.json();
      } catch (error) {
        console.error("Error fetching proxy:", error);
        showToast("Error loading proxy details", "error");
        return null;
      }
    },

    async createProxy(proxyData) {
      try {
        const response = await fetch("/api/proxies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proxyData),
        });
        if (!response.ok) throw new Error("Failed to create proxy");
        return await response.json();
      } catch (error) {
        console.error("Error creating proxy:", error);
        showToast("Error creating proxy", "error");
        return null;
      }
    },

    async updateProxy(proxyId, proxyData) {
      try {
        const response = await fetch(`/api/proxies/${proxyId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proxyData),
        });
        if (!response.ok) throw new Error("Failed to update proxy");
        return await response.json();
      } catch (error) {
        console.error("Error updating proxy:", error);
        showToast("Error updating proxy", "error");
        return null;
      }
    },

    async deleteProxy(proxyId) {
      try {
        const response = await fetch(`/api/proxies/${proxyId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete proxy");
        return await response.json();
      } catch (error) {
        console.error("Error deleting proxy:", error);
        showToast("Error deleting proxy", "error");
        return null;
      }
    },

    async bulkDeleteProxies(proxyIds) {
      try {
        const response = await fetch("/api/proxies/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proxy_ids: proxyIds }),
        });
        if (!response.ok) throw new Error("Failed to delete proxies");
        return await response.json();
      } catch (error) {
        console.error("Error deleting proxies:", error);
        showToast("Error deleting proxies", "error");
        return null;
      }
    },

    async testProxy(proxyData) {
      try {
        const response = await fetch("/api/proxies/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proxyData),
        });
        if (!response.ok) throw new Error("Failed to test proxy");
        return await response.json();
      } catch (error) {
        console.error("Error testing proxy:", error);
        return {
          success: false,
          error: error.message || "Error testing proxy",
        };
      }
    },

    async testProxies(proxyIds) {
      try {
        const response = await fetch("/api/proxies/test-multiple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proxy_ids: proxyIds }),
        });
        if (!response.ok) throw new Error("Failed to test proxies");
        return await response.json();
      } catch (error) {
        console.error("Error testing proxies:", error);
        showToast("Error testing proxies", "error");
        return null;
      }
    },

    async importProxies(proxiesList) {
      try {
        const response = await fetch("/api/proxies/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proxies: proxiesList }),
        });
        if (!response.ok) throw new Error("Failed to import proxies");
        return await response.json();
      } catch (error) {
        console.error("Error importing proxies:", error);
        showToast("Error importing proxies", "error");
        return null;
      }
    },

    async getAccounts() {
      try {
        const response = await fetch("/api/accounts");
        if (!response.ok) throw new Error("Failed to fetch accounts");
        return await response.json();
      } catch (error) {
        console.error("Error fetching accounts:", error);
        return [];
      }
    },
  };

  const renderProxies = (proxies) => {
    if (!proxies.length) {
      elements.emptyProxyState.style.display = "block";
      elements.proxiesTableBody.innerHTML = "";
      return;
    }

    elements.emptyProxyState.style.display = "none";
    elements.proxiesTableBody.innerHTML = proxies
      .map((proxy) => {
        const usedAccounts = proxy.accounts ? proxy.accounts.length : 0;
        const maxAccounts = 3;
        const usagePercentage = (usedAccounts / maxAccounts) * 100;

        const hasCredentials = proxy.username && proxy.password;
        const credentialsDisplay = hasCredentials
          ? `${proxy.username}:${proxy.password.substring(0, 2)}...`
          : "No authentication";

        let statusClass = "untested";
        if (proxy.status === "online") statusClass = "online";
        if (proxy.status === "offline") statusClass = "offline";

        return `
            <tr data-id="${proxy.id}">
                <td class="checkbox-col">
                    <input type="checkbox" class="proxy-checkbox" data-id="${
                      proxy.id
                    }">
                </td>
                <td>
                    <div class="proxy-info">
                        <div class="proxy-address">${proxy.host}:${
          proxy.port
        }</div>
                        <div class="proxy-details">${credentialsDisplay}</div>
                    </div>
                </td>
                <td>
                    <span class="proxy-type ${
                      proxy.type
                    }">${proxy.type.toUpperCase()}</span>
                </td>
                <td>
                    <div class="status-badge ${statusClass}">
                        <i class="fas fa-${
                          proxy.status === "online"
                            ? "check-circle"
                            : proxy.status === "offline"
                            ? "times-circle"
                            : "question-circle"
                        }"></i>
                        ${
                          proxy.status === "online"
                            ? "Online"
                            : proxy.status === "offline"
                            ? "Offline"
                            : "Untested"
                        }
                    </div>
                </td>
                <td>
                    <div>${usedAccounts} of ${maxAccounts} accounts</div>
                    <div class="proxy-usage">
                        <div class="proxy-usage-bar" style="width: ${usagePercentage}%;"></div>
                    </div>
                </td>
                <td>${
                  proxy.last_checked
                    ? new Date(proxy.last_checked).toLocaleString()
                    : "Never"
                }</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-text test-proxy-btn" data-id="${
                          proxy.id
                        }" title="Test proxy">
                            <i class="fas fa-vial"></i>
                        </button>
                        <button class="btn btn-icon btn-text edit-proxy-btn" data-id="${
                          proxy.id
                        }" title="Edit proxy">
                            <i class="fas fa-pencil"></i>
                        </button>
                        <button class="btn btn-icon btn-danger delete-proxy-btn" data-id="${
                          proxy.id
                        }" title="Delete proxy">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
      })
      .join("");

    attachProxyEventListeners();

    elements.proxyCount.textContent = proxies.length;
  };

  const handleSelectProxy = (event) => {
    const checkbox = event.target;
    const proxyId = checkbox.dataset.id;

    if (checkbox.checked) {
      state.selectedProxies.add(proxyId);
    } else {
      state.selectedProxies.delete(proxyId);
    }

    updateSelectionUI();
  };

  const handleSelectAll = (event) => {
    const checked = event.target.checked;

    document.querySelectorAll(".proxy-checkbox").forEach((checkbox) => {
      checkbox.checked = checked;
      const proxyId = checkbox.dataset.id;

      if (checked) {
        state.selectedProxies.add(proxyId);
      } else {
        state.selectedProxies.delete(proxyId);
      }
    });

    updateSelectionUI();
  };

  const handleAddProxyClick = () => {
    document.getElementById("add-proxy-form").reset();
    document.getElementById("proxy-test-results").style.display = "none";

    showModal("add-proxy-modal");
  };

  const handleSaveProxy = async () => {
    const form = document.getElementById("add-proxy-form");
    const hostInput = document.getElementById("proxy-host");
    const portInput = document.getElementById("proxy-port");

    if (!hostInput.value.trim()) {
      showToast("Please enter a host", "error");
      hostInput.focus();
      return;
    }

    if (!portInput.value.trim()) {
      showToast("Please enter a port", "error");
      portInput.focus();
      return;
    }

    const proxyData = {
      type: document.getElementById("proxy-type").value,
      host: hostInput.value.trim(),
      port: parseInt(portInput.value.trim()),
      username: document.getElementById("proxy-username").value.trim(),
      password: document.getElementById("proxy-password").value.trim(),
    };

    const newProxy = await api.createProxy(proxyData);

    if (newProxy) {
      showToast("Proxy created successfully", "success");
      hideModal("add-proxy-modal");

      await loadProxies();
    }
  };

  const handleTestProxy = async () => {
    const hostInput = document.getElementById("proxy-host");
    const portInput = document.getElementById("proxy-port");
    const resultsContainer = document.getElementById("proxy-test-results");

    if (!hostInput.value.trim() || !portInput.value.trim()) {
      showToast("Please enter host and port", "error");
      return;
    }

    const proxyData = {
      type: document.getElementById("proxy-type").value,
      host: hostInput.value.trim(),
      port: parseInt(portInput.value.trim()),
      username: document.getElementById("proxy-username").value.trim(),
      password: document.getElementById("proxy-password").value.trim(),
    };

    resultsContainer.style.display = "block";
    resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 10px;">
                <i class="fas fa-spinner fa-spin"></i> Testing proxy...
            </div>
        `;

    const result = await api.testProxy(proxyData);

    if (result.success) {
      resultsContainer.className = "test-results success";
      resultsContainer.innerHTML = `
                <div class="test-result-item">
                    <span>Status:</span>
                    <span><i class="fas fa-check-circle"></i> Online</span>
                </div>
                <div class="test-result-item">
                    <span>Response Time:</span>
                    <span>${result.response_time} ms</span>
                </div>
                <div class="test-result-item">
                    <span>IP Address:</span>
                    <span>${result.ip_address}</span>
                </div>
                <div class="test-result-item">
                    <span>Location:</span>
                    <span>${result.location || "Unknown"}</span>
                </div>
            `;
    } else {
      resultsContainer.className = "test-results error";
      resultsContainer.innerHTML = `
                <div class="test-result-item">
                    <span>Status:</span>
                    <span><i class="fas fa-times-circle"></i> Offline</span>
                </div>
                <div class="test-result-item">
                    <span>Error:</span>
                    <span>${result.error || "Failed to connect"}</span>
                </div>
            `;
    }
  };

  const handleDeleteProxy = async (proxyId) => {
    const affectedAccounts = state.accounts.filter(
      (account) => account.proxy_id === proxyId
    );

    showModal("delete-proxies-modal");

    const warningContainer = document.getElementById(
      "associated-accounts-warning"
    );
    const accountsList = document.getElementById("affected-accounts-list");

    if (affectedAccounts.length > 0) {
      warningContainer.style.display = "block";
      accountsList.innerHTML = affectedAccounts
        .map((account) => `<li>${account.name} (${account.phone})</li>`)
        .join("");
    } else {
      warningContainer.style.display = "none";
    }

    const confirmButton = document.getElementById("confirm-delete-proxies-btn");

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    newConfirmButton.addEventListener("click", async () => {
      const result = await api.deleteProxy(proxyId);

      if (result) {
        showToast("Proxy deleted successfully", "success");
        hideModal("delete-proxies-modal");

        await loadProxies();

        if (affectedAccounts.length > 0) {
          await loadAccounts();
        }
      }
    });
  };

  const handleDeleteSelectedProxies = async () => {
    if (state.selectedProxies.size === 0) return;

    const selectedProxyIds = Array.from(state.selectedProxies);
    const affectedAccounts = state.accounts.filter((account) =>
      selectedProxyIds.includes(account.proxy_id)
    );

    showModal("delete-proxies-modal");

    document.getElementById(
      "delete-proxies-message"
    ).textContent = `Are you sure you want to delete ${state.selectedProxies.size} selected proxies? This will remove them from all accounts using them.`;

    const warningContainer = document.getElementById(
      "associated-accounts-warning"
    );
    const accountsList = document.getElementById("affected-accounts-list");

    if (affectedAccounts.length > 0) {
      warningContainer.style.display = "block";
      accountsList.innerHTML = affectedAccounts
        .map((account) => `<li>${account.name} (${account.phone})</li>`)
        .join("");
    } else {
      warningContainer.style.display = "none";
    }

    const confirmButton = document.getElementById("confirm-delete-proxies-btn");

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    newConfirmButton.addEventListener("click", async () => {
      const result = await api.bulkDeleteProxies(
        Array.from(state.selectedProxies)
      );

      if (result) {
        showToast(
          `Successfully deleted ${result.deleted_count} proxies`,
          "success"
        );
        hideModal("delete-proxies-modal");

        state.selectedProxies.clear();
        updateSelectionUI();

        await loadProxies();

        if (affectedAccounts.length > 0) {
          await loadAccounts();
        }
      }
    });
  };

  const handleTestSelectedProxies = async () => {
    if (state.selectedProxies.size === 0) return;

    elements.testSelectedProxiesBtn.disabled = true;
    elements.testSelectedProxiesBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Testing...';

    const results = await api.testProxies(Array.from(state.selectedProxies));

    elements.testSelectedProxiesBtn.disabled = false;
    elements.testSelectedProxiesBtn.innerHTML =
      '<i class="fas fa-vial"></i> Test';

    if (results) {
      showModal("test-results-modal");

      const resultsContainer = document.getElementById("test-results-content");

      let resultsHTML = "";
      results.forEach((result) => {
        const proxy = state.proxies.find((p) => p.id === result.proxy_id);
        if (!proxy) return;

        resultsHTML += `
                    <div class="test-results ${
                      result.success ? "success" : "error"
                    }" style="margin-bottom: 15px;">
                        <h4>${proxy.host}:${
          proxy.port
        } (${proxy.type.toUpperCase()})</h4>
                        ${
                          result.success
                            ? `
                            <div class="test-result-item">
                                <span>Status:</span>
                                <span><i class="fas fa-check-circle"></i> Online</span>
                            </div>
                            <div class="test-result-item">
                                <span>Response Time:</span>
                                <span>${result.response_time} ms</span>
                            </div>
                            <div class="test-result-item">
                                <span>IP Address:</span>
                                <span>${result.ip_address}</span>
                            </div>
                            <div class="test-result-item">
                                <span>Location:</span>
                                <span>${result.location || "Unknown"}</span>
                            </div>
                        `
                            : `
                            <div class="test-result-item">
                                <span>Status:</span>
                                <span><i class="fas fa-times-circle"></i> Offline</span>
                            </div>
                            <div class="test-result-item">
                                <span>Error:</span>
                                <span>${
                                  result.error || "Failed to connect"
                                }</span>
                            </div>
                        `
                        }
                    </div>
                `;
      });

      resultsContainer.innerHTML = resultsHTML;

      await loadProxies();
    }
  };

  const handleProxyFileUpload = async (file) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const content = e.target.result;
      const lines = content.split("\n").filter((line) => line.trim());

      const proxiesList = lines
        .map((line) => {
          const parts = line.trim().split(":");

          if (parts.length === 2) {
            return {
              type: "http",
              host: parts[0],
              port: parseInt(parts[1]),
              username: "",
              password: "",
            };
          } else if (
            parts.length === 3 &&
            ["http", "https", "socks5"].includes(parts[0].toLowerCase())
          ) {
            return {
              type: parts[0].toLowerCase(),
              host: parts[1],
              port: parseInt(parts[2]),
              username: "",
              password: "",
            };
          } else if (parts.length === 4) {
            return {
              type: "http",
              host: parts[0],
              port: parseInt(parts[1]),
              username: parts[2],
              password: parts[3],
            };
          } else if (
            parts.length === 5 &&
            ["http", "https", "socks5"].includes(parts[0].toLowerCase())
          ) {
            return {
              type: parts[0].toLowerCase(),
              host: parts[1],
              port: parseInt(parts[2]),
              username: parts[3],
              password: parts[4],
            };
          }

          return null;
        })
        .filter((proxy) => proxy !== null);

      if (proxiesList.length > 0) {
        const result = await api.importProxies(proxiesList);

        if (result) {
          showToast(
            `Successfully imported ${result.imported_count} proxies`,
            "success"
          );
          hideModal("add-proxy-modal");

          await loadProxies();
        }
      } else {
        showToast("No valid proxies found in the file", "error");
      }
    };

    reader.readAsText(file);
  };

  const updateSelectionUI = () => {
    const selectedCount = state.selectedProxies.size;

    elements.selectedCount.textContent = `${selectedCount} selected`;

    elements.proxySelectionActions.style.display =
      selectedCount > 0 ? "flex" : "none";

    const totalProxies = document.querySelectorAll(".proxy-checkbox").length;
    elements.selectAllCheckbox.checked =
      selectedCount > 0 && selectedCount === totalProxies;
    elements.selectAllCheckbox.indeterminate =
      selectedCount > 0 && selectedCount < totalProxies;

    elements.testSelectedProxiesBtn.disabled = selectedCount === 0;
    elements.deleteSelectedProxiesBtn.disabled = selectedCount === 0;
    elements.testSelectedBtn.disabled = selectedCount === 0;
  };

  const showModal = (modalId) => {
    elements.modalContainer.classList.add("active");
    document.getElementById(modalId).classList.add("active");
    document.body.style.overflow = "hidden";
  };

  const hideModal = (modalId) => {
    elements.modalContainer.classList.remove("active");
    document.getElementById(modalId).classList.remove("active");
    document.body.style.overflow = "";
  };

  const showToast = (message, type = "info") => {
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
  };

  const attachProxyEventListeners = () => {
    document.querySelectorAll(".proxy-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", handleSelectProxy);
    });

    document.querySelectorAll(".test-proxy-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const proxyId = button.dataset.id;
        const proxy = state.proxies.find((p) => p.id === proxyId);

        if (proxy) {
          button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          button.disabled = true;

          const result = await api.testProxy(proxy);

          button.innerHTML = '<i class="fas fa-vial"></i>';
          button.disabled = false;

          if (result.success) {
            showToast(`Proxy ${proxy.host}:${proxy.port} is online`, "success");
          } else {
            showToast(
              `Proxy ${proxy.host}:${proxy.port} is offline: ${result.error}`,
              "error"
            );
          }

          await loadProxies();
        }
      });
    });

    document.querySelectorAll(".edit-proxy-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const proxyId = button.dataset.id;

        showToast("Edit proxy functionality is not implemented yet", "info");
      });
    });

    document.querySelectorAll(".delete-proxy-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const proxyId = button.dataset.id;
        handleDeleteProxy(proxyId);
      });
    });
  };

  const attachGlobalEventListeners = () => {
    elements.selectAllCheckbox.addEventListener("change", handleSelectAll);

    elements.addProxyBtn.addEventListener("click", handleAddProxyClick);
    elements.emptyAddBtn.addEventListener("click", handleAddProxyClick);

    elements.testSelectedBtn.addEventListener(
      "click",
      handleTestSelectedProxies
    );
    elements.testSelectedProxiesBtn.addEventListener(
      "click",
      handleTestSelectedProxies
    );

    elements.deleteSelectedProxiesBtn.addEventListener(
      "click",
      handleDeleteSelectedProxies
    );

    document
      .getElementById("save-proxy-btn")
      .addEventListener("click", handleSaveProxy);

    document
      .getElementById("test-proxy-btn")
      .addEventListener("click", handleTestProxy);

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.dataset.closeModal;
        hideModal(modalId);
      });
    });

    elements.searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      filterProxies(searchTerm);
    });

    const proxyUploadArea = document.getElementById("proxy-upload-area");
    const proxyFileInput = document.getElementById("proxy-file-input");

    if (proxyUploadArea && proxyFileInput) {
      proxyFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleProxyFileUpload(e.target.files[0]);
        }
      });

      proxyUploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        proxyUploadArea.classList.add("dragover");
      });

      proxyUploadArea.addEventListener("dragleave", (e) => {
        e.preventDefault();
        proxyUploadArea.classList.remove("dragover");
      });

      proxyUploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        proxyUploadArea.classList.remove("dragover");

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.name.endsWith(".txt")) {
            handleProxyFileUpload(file);
          } else {
            showToast("Please upload a .txt file", "error");
          }
        }
      });

      proxyUploadArea.addEventListener("click", () => {
        proxyFileInput.click();
      });
    }
  };

  const loadProxies = async () => {
    const proxies = await api.getProxies();
    state.proxies = proxies;
    renderProxies(proxies);
  };

  const loadAccounts = async () => {
    const accounts = await api.getAccounts();
    state.accounts = accounts;
  };

  const filterProxies = (searchTerm) => {
    if (!searchTerm) {
      renderProxies(state.proxies);
      return;
    }

    const filteredProxies = state.proxies.filter((proxy) => {
      return (
        proxy.host.toLowerCase().includes(searchTerm) ||
        proxy.port.toString().includes(searchTerm) ||
        (proxy.username && proxy.username.toLowerCase().includes(searchTerm)) ||
        proxy.type.toLowerCase().includes(searchTerm)
      );
    });

    renderProxies(filteredProxies);
  };

  const init = async () => {
    await Promise.all([loadProxies(), loadAccounts()]);

    attachGlobalEventListeners();
  };

  init();
});
