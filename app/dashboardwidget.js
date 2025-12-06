import DashboardWidget from './DashboardWidget.svelte';

function initWidget() {
    const target = document.querySelector("#dashlytics-widget");
    if (target) {
        new DashboardWidget({
            target: target
        });
    }
}

// Warte auf DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
} else {
    initWidget();
}
