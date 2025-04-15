document.addEventListener('DOMContentLoaded', function() {
    // Get the sidebar menu element
    const sidebarMenu = document.getElementById('sidebar-menu');
    
    if (!sidebarMenu) {
        console.error("Sidebar menu not found!");
        return;
    }

    const pageUrls = {
        'accounts': '/index.html',
        'proxies': '/proxies.html',
        'parser': '/group-parser.html',
        'broadcaster': '/broadcaster.html'
    };
    
    function handleNavigation(event) {
        const item = event.target.closest('li');
        if (!item) return;
        
        const page = item.dataset.page;
        
        if (page && pageUrls[page]) {
            console.log(`Navigating to ${page} page: ${pageUrls[page]}`);
            window.location.href = pageUrls[page];
        }
    }
    const newSidebarMenu = sidebarMenu.cloneNode(true);
    sidebarMenu.parentNode.replaceChild(newSidebarMenu, sidebarMenu);
    
    newSidebarMenu.addEventListener('click', handleNavigation);
    
    console.log("Sidebar navigation initialized");
});