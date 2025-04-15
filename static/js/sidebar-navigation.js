document.addEventListener('DOMContentLoaded', function() {
    // Get the sidebar menu element
    const sidebarMenu = document.getElementById('sidebar-menu');
    
    if (!sidebarMenu) {
        console.error("Sidebar menu not found!");
        return;
    }
    
    // Define page URLs
    const pageUrls = {
        'accounts': '/index.html',
        'proxies': '/proxies.html',
        'parser': '/group-parser.html',
        'broadcaster': '/broadcaster.html'
    };
    
    // Function to handle navigation
    function handleNavigation(event) {
        const item = event.target.closest('li');
        if (!item) return;
        
        const page = item.dataset.page;
        
        if (page && pageUrls[page]) {
            console.log(`Navigating to ${page} page: ${pageUrls[page]}`);
            window.location.href = pageUrls[page];
        }
    }
    
    // Remove any existing click listeners by cloning and replacing
    const newSidebarMenu = sidebarMenu.cloneNode(true);
    sidebarMenu.parentNode.replaceChild(newSidebarMenu, sidebarMenu);
    
    // Add click event listener to the menu
    newSidebarMenu.addEventListener('click', handleNavigation);
    
    console.log("Sidebar navigation initialized");
});