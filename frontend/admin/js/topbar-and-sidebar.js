document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Fetch and inject Top Bar
    fetch("top-bar.html")
        .then(response => {
            if (!response.ok) throw new Error("Top bar file not found");
            return response.text();
        })
        .then(data => {
            document.getElementById("top-bar-container").innerHTML = data;
        })
        .catch(error => console.error("Error loading top bar:", error));

    // 2. Fetch, inject, and animate Side Bar
    fetch("side-bar.html")
        .then(response => {
            if (!response.ok) throw new Error("Side bar file not found");
            return response.text();
        })
        .then(data => {
            document.getElementById("sidebar-container").innerHTML = data;
            
            // Attach the click listener NOW, because the sidebar finally exists in the page
            const sidebar = document.getElementById("side-bar");
            const menuBtn = document.getElementById("menu-toggle-btn");

            if (menuBtn && sidebar) {
                menuBtn.addEventListener("click", () => {
                    sidebar.classList.toggle("expanded");
                });
            }
        })
        .catch(error => console.error("Error loading side bar:", error));
});