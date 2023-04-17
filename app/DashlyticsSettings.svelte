<script>
import { onMount } from "svelte";

let SettingsTitle = 'Dashlytic Settings';
let settingsTutorialGif = '../wp-content/plugins/wp-dashlytics/assets/how-to-show-matomo-token-for-reporting-api.gif';
let shareImageUri = '';
let data = {};
// let siteUrl = window.location.href;
// TODO Generate dynamic
const wholeUrl = 'http://wordpress-local:8888/index.php';
const matomoRestUrl = '?rest_route=/matomo/v1/api/';
const restUrl = '/wp-json/dashlytics/v1/options';

// Function who checks if request token for matomo valid if not generate new one and write into REST Plugin Api
async function checkToken() {
    try {
        const response = await fetch(`${wholeUrl}/${matomoRestUrl}`, {
        headers: {
            Authorization: `Bearer ${data.authtoken}`
        }
        });
        
        if (response.ok) {
        // Token is valid
        console.log('Token is valid');
        return true;
        } else if (response.status === 404) {
        // Token is invalid, generate new token
        console.log('Generating new token...');
        const newTokenResponse = await fetch(`${wholeUrl}/${matomoRestUrl}`, {
            method: 'POST'
        });
        
        if (newTokenResponse.ok) {
            // Update tokenauth variable with new token
            const newToken = await newTokenResponse.text();
            await fetch(restUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tokenauth: newToken
            })
            });
            
            console.log('Token updated successfully');
            return true;
        } else {
            console.log('Failed to generate new token');
            return false;
        }
        } else {
        console.log(`Error: ${response.status} - ${response.statusText}`);
        return false;
        }
    } catch (error) {
        console.log(`Error: ${error}`);
        return false;
    }
}

// Loads Data from REST Plugin route
async function loadRestData() {
    const response = await fetch(`${restUrl}`);
    data = await response.json();
}

// Function for save Values from form into REST Plugin route
async function saveChanges() {
    const response = await fetch(`${restUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiurl: data.apiurl,
        siteidarl: data.siteidarl,
        tokenauth: data.tokenauth
      })
    });

    const responseData = await response.json();
    console.log(responseData);
}

// Saves data values for Plugin from form input values
async function handleSubmit(event) {
    event.preventDefault();
    const savedData = await saveChanges();
    console.log('Saved Data:', savedData);
}

async function updateData() {
    const isTokenValid = await getData();
    if (isTokenValid) {
        // Do something with the data
        console.log('Data is valid');
    } else {
        // Handle invalid token error
        console.log('Data is invalid');
    }
}

onMount(() => {
    loadRestData();
});
</script>

<div class="wrap">
    <h1>{SettingsTitle}</h1>
    <div id="welcome-panel" class="welcome-panel hidden">
        <input type="hidden" id="welcomepanelnonce" name="welcomepanelnonce" value="1" />
    </div>

    <div id="dashboard-settings-wrap" class="dashboard-settings">
        <form id="dashboard-widgets" on:submit={handleSubmit} class="metabox-holder">
            <div class="postbox-container">
                <div class="meta-box-sortables ui-sortable">
                    <div id="api-settings" class="postbox ">
                        <div class="postbox-header">
                            <h2 class="hndle ui-sortable-handle">API Settings</h2>
                        </div>
                        <div class="inside">
                            <h3 style="margin-top:14px;">Api Url</h3>
                            <i>Standard Matomo Api Url: <b>?rest_route=/matomo/v1/api/</b></i><br />
                            {wholeUrl}
                            <input class="Settings--input" type="text" name="api_url" placeholder={data.apiurl} bind:value={data.apiurl} />
                            <h3 style="margin-top:14px;">Site Id</h3>
                            <i>Standard Site Id: <b>1</b></i><br />
                            <input class="Settings--input" type="number" name="site_id_arl"
                                bind:value={data.siteidarl} /><br />
                            <div style="max-height:44px;">
                                <button type="submit" class="Settings--button button button-primary">
                                    Save Changes
                                </button>
                            </div>
                            {#if Object.keys(data).length > 0}
                            <h2>Daten:</h2>
                                <pre>{JSON.stringify(data, null, 2)}</pre>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
            <div class="postbox-container">
                <div class="meta-box-sortables ui-sortable">
                    <div id="auth-token" class="postbox ">
                        <div class="postbox-header">
                            <h2 class="hndle ui-sortable-handle">Auth Token</h2>
                        </div>
                        <div class="inside">
                            <i>1. Go to your <b>Matomo Dashboard</b> <a
                                    href="/wp-content/plugins/matomo/app/index.php"
                                    target="_blank">Matomo Dashboard</a></i><br>
                            <i>2. Click on the <b>Export Button</b> <img
                                    style="object-fit:cover;width:24px;height:18px;transform:translateY(3px);"
                                    src="{shareImageUri}" alt="share logo" /> Icon of "last visits"</i><br>
                            <i>3. Export Metrics as <b>HTML or JSON</b></i><br>
                            <i>4. Have a look on the <b>Video above</b></i> 😎<br>
                            <i>5. Look into our <b>Website Url</b></i> (i.E.
                            <code>http://domain...&token_auth=00e3dwwdewDew...</code> ) --> find
                            <code>token_auth</code><br>
                            <i>6. Copy the Value of your Url <b>after</b> </i><code>token_auth=</code> and paste it
                            below to request data from your Matomo<br>
                            <br>
                            <span style="background:#f5f5f5;width:100%;padding:1.1rem 1.2rem;">
                                <b>Insert your Auth token here:</b>
                                <input class="Settings--input" bind:value={data.tokenauth} type="text" minlength="32"
                                    name="token_auth" /><br>
                            </span>
                            <br>
                        </div>
                    </div>
                </div>
            </div>
            <div class="postbox-container">
                <div class="meta-box-sortables ui-sortable">
                    <div id="dev-infos" class="postbox">
                        <div class="postbox-header">
                            <h2 class="hndle ui-sortable-handle">Video find Auth Token</h2>
                        </div>
                        <div class="inside">
                            <img src={settingsTutorialGif} alt="Gif Tutorial how to find the scret token api"
                                style="width:100%;object-fit:contain;">
                            <br>
                            <p>Thanks for choosing the Plugin! 🎉 Keep in mind it's in beta, so expect some quirks
                                😅.
                                We're always working to improve it.</p>
                            <p>Feel like supporting Christopher, the developer? He'd be grateful for a small
                                donation, like a coffee ☕ or snack 🍪:
                                <a href="https://www.paypal.com/paypalme/choooomedia/4" target="_blank">Buy me a ☕
                                    or 🍪</a>
                            </p>
                            <p>Stay awesome 😎 and enjoy the plugin!</p>
                            <div class="d-flex">
                                <a class="Settings--button button button-primary"
                                    href="https://www.paypal.com/paypalme/choooomedia/4" target="_blank"
                                    style="height:28px;margin-top:5px;">Support Plugin Developer</a>
                                <a class="Settings--button button button-primary"
                                    href="https://github.com/chooomedia/wp-dashboard-statistics-widget-matomo"
                                    target="_blank" style="height:28px;margin-top:5px;">Plugin Github Repository</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>
</div>

<style>
    .d-flex {
        display: flex;
        gap: 5px;
    }

    i {
        line-height: 17pt;
    }

    .Settings--button {
        line-height: 1.4;
        padding: 3px 10px 3px;
        font-family: Consolas, Monaco, monospace;
        border: 1px solid #ccc;
        border-radius: 0px;
        background: #fff;
        color: #fff;
    }

    .Settings--input {
        line-height: 1.4;
        padding: 3px 10px 3px;
        font-family: Consolas, Monaco, monospace;
        border: 1px solid #ccc;
        border-radius: 0px;
        background: #fff;
        color: #fff;
        min-width: 20vw;
    }
</style>