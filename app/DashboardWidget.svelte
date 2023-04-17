<script>
import { Chart } from 'chart.js/auto';
import { onMount } from 'svelte';

let chart;
let data = {};
let labels = [];
let values = [];
let inputColor = '#01a9cd';
let wholeUrl = 'http://wordpress-local:8888/';

let inputStartDate = new Date(Date.now() - (24 * 60 * 60 * 1000 * 30)).toISOString().slice(0, 10);
let inputEndDate = new Date().toISOString().slice(0, 10);

const chartTypes = [{
        label: 'Balkendiagramm',
        value: 'bar'
    },
    {
        label: 'Linienchart',
        value: 'line'
    },
    {
        label: 'Kreisdiagramm',
        value: 'pie'
    }
];

function updateChart() {
    const chartStyleSelector = document.getElementById('chart-style-selector');
    const mainColorInput = document.getElementById('main-color-input');
    const selectedStyle = chartStyleSelector.value;
    const inputColor = mainColorInput.value;
    const canvas = document.getElementById('dashlytics-matomo-stats');
    const ctx = canvas.getContext('2d');

    if (chart) {
        chart.destroy();
    }

    const bgColor = {
        id: 'bgColor',
        beforeDraw: (chart, args, options) => {
            const {
                ctx,
                chartArea
            } = chart;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = options.color || '#ffffff';
            ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom -
                chartArea.top);
            ctx.restore();
        }
    };

    chart = new Chart(ctx, {
        type: selectedStyle,
        data: {
            labels: labels,
            datasets: [{
                label: 'Besuche pro Tag',
                data: values,
                borderColor: inputColor,
                tension: 0.9,
                backgroundColor: inputColor
            }],
        },
        plugins: [bgColor],
        options: {
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Datum'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Besuche'
                    }
                }
            }
        }
    });
}

async function loadData() {
    const response = await fetch('/wp-json/dashlytics/v1/options')
    data = await response.json();
    await getData(data);
}
// index.php ?rest_route=/matomo/v1/api/processed_report&period=date&date=year&filter_limit=10&apiModule=Actions&apiActions=getPageUrls
// http://wordpress-local:8888/wp-content/plugins/matomo/app/index.php?module=API&format=JSON&idSite=1&period=day&date=2023-03-06,2023-04-04&method=API.get&filter_limit=100&format_metrics=1&expanded=1&token_auth=anonymous&force_api_session=1
// `${wholeUrl}${data.apiurl}processed_report&period=day&date=${inputStartDate},${inputEndDate}&filter_limit=100&apiModule=Actions&apiActions=getPageUrls&force_api_session=1`

async function getData() {
  const endpoint = `${wholeUrl}${data.apiurl}`;
  const queryParams = new URLSearchParams({
        period: 'range',
        date: `${inputStartDate},${inputEndDate}`,
        filter_limit: -1,
        format: 'json',
        expanded: 1, // no difference without
        apiModule: 'Actions',
        apiAction: 'getPageUrls'
    }).toString();

    const headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(`${data.juser}:${data.jpass}`));
  
  try {
    const response = await fetch(`${endpoint}?${queryParams}`, {
        method: 'GET',
    });

    const data = await response.json();
        console.log(data);
  } catch (error) {
        console.error(error);
  }
}

onMount(async () => {
    try {
        await loadData(data);
        updateChart();
    } catch (error) {
        console.error(error);
        alert('Fehler beim Laden der Daten.');
    }
});
</script>

<div class="d-flex-row">
    <input id="start-date-picker" type="date" bind:value={inputStartDate} on:change={updateChart} />
    <input id="end-date-picker" type="date" bind:value={inputEndDate} on:change={updateChart} />
    <select id="chart-style-selector" on:change={updateChart}>
        {#each chartTypes as chartType}
        <option value={chartType.value}>
          {chartType.label}
        </option>
      {/each}
    </select>
    <input id="main-color-input" type="color" bind:value={inputColor} on:change={updateChart}>
    <button class="Settings--button" id="generate-pdf-button">Reporting</button>
    <div class="spinner"></div>
    <canvas id="dashlytics-matomo-stats"></canvas>
</div>
    
<style>
.d-flex-row {
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: row;
    line-height: 30px;
}

.Settings--button {
    background: #01a9cd;
    color: #ffffff;
    margin-left: .23rem;
    border: 0;
    outline: 0;
    border-radius: 3px;
}

.spinner {
    border: 5px solid rgba(0, 0, 0, 0.5);
    border-left-color: #01a9cd;
    border-radius: 50%;
    width: 25px;
    height: 25px;
    animation: spin 1s linear infinite;
    margin: auto;
    filter: invert(1);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

</style>