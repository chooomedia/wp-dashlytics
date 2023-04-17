import Settings from './DashlyticsSettings.svelte';

const dashlyticsadmin = new Settings({
    target: document.querySelector('#dashlytics-settings')
});

export default Settings;