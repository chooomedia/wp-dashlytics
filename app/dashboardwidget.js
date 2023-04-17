import DashboardWidget from './DashboardWidget.svelte';

const dashboardWidget = new DashboardWidget({
    target: document.querySelector("#dashlytics-widget")
});

export default dashboardWidget;