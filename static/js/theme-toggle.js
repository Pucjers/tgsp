/**
 * Theme Toggle functionality
 * - Adds a theme toggle button to the sidebar footer
 * - Switches between light and dark themes
 * - Saves theme preference to localStorage
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialization function
    const initThemeToggle = () => {
        // Create the theme toggle button if it doesn't exist yet
        createThemeToggleButton();
        
        // Apply the saved theme or default to light
        applyTheme(getSavedTheme());
        
        // Attach event listeners
        attachThemeToggleEvents();
    };
    
    // Create the theme toggle button and add it to the sidebar footer
    const createThemeToggleButton = () => {
        const sidebarFooter = document.querySelector('.sidebar-footer');
        
        if (!sidebarFooter) return;
        
        // Check if the button already exists - this prevents duplication
        if (document.getElementById('theme-toggle-btn')) return;
        
        // Create button element
        const themeToggleBtn = document.createElement('button');
        themeToggleBtn.id = 'theme-toggle-btn';
        themeToggleBtn.className = 'theme-toggle btn btn-icon';
        themeToggleBtn.setAttribute('title', 'Toggle dark mode');
        themeToggleBtn.innerHTML = `
            <i class="fas fa-sun light-icon"></i>
            <i class="fas fa-moon dark-icon"></i>
        `;
        
        // Add button to sidebar footer before the help button
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) {
            sidebarFooter.insertBefore(themeToggleBtn, helpBtn);
        } else {
            sidebarFooter.appendChild(themeToggleBtn);
        }
    };
    
    // Get the saved theme from localStorage
    const getSavedTheme = () => {
        return localStorage.getItem('tgninja-theme') || 'light';
    };
    
    // Save the current theme to localStorage
    const saveTheme = (theme) => {
        localStorage.setItem('tgninja-theme', theme);
    };
    
    // Apply the given theme to the document
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        saveTheme(theme);
    };
    
    // Toggle between light and dark themes
    const toggleTheme = () => {
        const currentTheme = getSavedTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        applyTheme(newTheme);
    };
    
    // Attach events to the theme toggle button
    const attachThemeToggleEvents = () => {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', toggleTheme);
        }
    };
    
    // Initialize the theme toggle
    initThemeToggle();
});