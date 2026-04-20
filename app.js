const repoInput = document.getElementById('repo-input');
const trackButton = document.getElementById('track-button');
const exportButton = document.getElementById('export-button');
const toggleLegendButton = document.getElementById('toggle-legend');
const statusEl = document.getElementById('status');
const tableBody = document.querySelector('#release-table tbody');
const chartCanvas = document.getElementById('downloads-chart');

let chartInstance = null;
let latestCsvData = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b91c1c' : '#0f172a';
}

function formatDate(isoString) {
  return new Date(isoString).toISOString().slice(0, 10);
}

function createCsv(releaseRows) {
  const headers = ['Repo', 'Release Date', 'Tag', 'Name', 'Asset', 'Downloads', 'Total Downloads'];
  const lines = [headers.join(',')];
  releaseRows.forEach((row) => {
    const line = [
      `"${row.repo}"`,
      row.releaseDate,
      `"${row.tag}"`,
      `"${row.releaseName}"`,
      `"${row.assetName}"`,
      row.downloads,
      row.releaseTotal,
    ].join(',');
    lines.push(line);
  });
  return lines.join('\n');
}

function downloadCsv(csvText, repo) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${repo.replace('/', '-')}-release-downloads.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function updateTable(releaseRows) {
  tableBody.innerHTML = '';
  releaseRows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.repo}</td>
      <td>${row.releaseDate}</td>
      <td>${row.tag}</td>
      <td>${row.releaseName}</td>
      <td>${row.assetName}</td>
      <td>${row.downloads}</td>
      <td>${row.releaseTotal}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function updateChart(releaseTotals, options = {}) {
  const labelKey = options.labelKey || 'tag';
  const valueKey = options.valueKey || 'totalDownloads';
  const titleText = options.title || 'Asset Downloads per Release';

  const labels = releaseTotals.map((item) => item[labelKey]);
  const values = releaseTotals.map((item) => item[valueKey]);

  const data = {
    labels,
    datasets: [
      {
        label: titleText,
        data: values,
        backgroundColor: 'rgba(37, 99, 235, 0.75)',
        borderColor: 'rgba(37, 99, 235, 1)',
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };

  const config = {
    type: 'bar',
    data,
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        title: {
          display: true,
          text: titleText,
          padding: { top: 10, bottom: 10 },
        },
      },
      scales: {
        x: {
          title: { display: true, text: options.xAxisLabel || 'Release Tags' },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Number of Downloads' },
          ticks: {
            stepSize: 1,
            precision: 0,
          },
        },
      },
    },
  };

  if (chartInstance) {
    chartInstance.destroy();
  }
  chartInstance = new Chart(chartCanvas, config);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    const message = response.status === 404 ? 'Not found.' : `GitHub API error: ${response.status}`;
    throw new Error(message);
  }

  return await response.json();
}

async function fetchRepos(username) {
  const url = `https://api.github.com/users/${username}/repos?per_page=100&type=owner`;
  try {
    return await fetchJson(url);
  } catch (error) {
    if (error.message === 'Not found.') {
      const orgUrl = `https://api.github.com/orgs/${username}/repos?per_page=100`;
      return await fetchJson(orgUrl);
    }
    throw error;
  }
}

async function fetchReleasesForRepo(repoFullName) {
  const url = `https://api.github.com/repos/${repoFullName}/releases?per_page=100`;
  return await fetchJson(url);
}

async function loadStats() {
  const rawInput = repoInput.value.trim();
  if (!rawInput) {
    setStatus('Enter a repository or username first.', true);
    return;
  }

  setStatus('Loading data...');
  exportButton.disabled = true;
  latestCsvData = null;

  try {
    const isRepo = rawInput.includes('/');
    const tableRows = [];
    let chartData = [];

    if (isRepo) {
      const releases = await fetchReleasesForRepo(rawInput);
      if (!Array.isArray(releases) || releases.length === 0) {
        setStatus('No releases found for this repository.');
        updateTable([]);
        updateChart([]);
        return;
      }

      const releaseTotals = releases.map((release) => {
        const totalDownloads = release.assets.reduce((sum, asset) => sum + (asset.download_count || 0), 0);
        return {
          repo: rawInput,
          tag: release.tag_name || release.name || 'untagged',
          releaseName: release.name || release.tag_name || 'Untitled Release',
          releaseDate: release.published_at ? formatDate(release.published_at) : 'Unknown',
          totalDownloads,
          assets: release.assets.map((asset) => ({
            assetName: asset.name || 'Unnamed asset',
            downloads: asset.download_count || 0,
          })),
        };
      });

      releaseTotals.forEach((release) => {
        if (release.assets.length === 0) {
          tableRows.push({
            repo: release.repo,
            releaseDate: release.releaseDate,
            tag: release.tag,
            releaseName: release.releaseName,
            assetName: 'No assets',
            downloads: 0,
            releaseTotal: release.totalDownloads,
          });
        } else {
          release.assets.forEach((asset) => {
            tableRows.push({
              repo: release.repo,
              releaseDate: release.releaseDate,
              tag: release.tag,
              releaseName: release.releaseName,
              assetName: asset.assetName,
              downloads: asset.downloads,
              releaseTotal: release.totalDownloads,
            });
          });
        }
      });

      chartData = releaseTotals;
      updateChart(chartData, {
        labelKey: 'tag',
        valueKey: 'totalDownloads',
        title: `Release downloads for ${rawInput}`,
        xAxisLabel: 'Release Tags',
      });
      setStatus(`Loaded ${releases.length} release(s) for ${rawInput}.`);
    } else {
      const repos = await fetchRepos(rawInput);
      if (!Array.isArray(repos) || repos.length === 0) {
        setStatus('No repositories found for this user or organization.');
        updateTable([]);
        updateChart([]);
        return;
      }

      const repoSummaries = [];
      for (const repo of repos) {
        const releases = await fetchReleasesForRepo(repo.full_name);
        const repoTotal = Array.isArray(releases)
          ? releases.reduce((repoSum, release) => {
              return repoSum + release.assets.reduce((assetSum, asset) => assetSum + (asset.download_count || 0), 0);
            }, 0)
          : 0;

        repoSummaries.push({ repo: repo.full_name, totalDownloads: repoTotal });

        if (!Array.isArray(releases) || releases.length === 0) {
          tableRows.push({
            repo: repo.full_name,
            releaseDate: 'No releases',
            tag: '-',
            releaseName: '-',
            assetName: '-',
            downloads: 0,
            releaseTotal: 0,
          });
          continue;
        }

        releases.forEach((release) => {
          const releaseTotal = release.assets.reduce((sum, asset) => sum + (asset.download_count || 0), 0);
          if (release.assets.length === 0) {
            tableRows.push({
              repo: repo.full_name,
              releaseDate: release.published_at ? formatDate(release.published_at) : 'Unknown',
              tag: release.tag_name || release.name || 'untagged',
              releaseName: release.name || release.tag_name || 'Untitled Release',
              assetName: 'No assets',
              downloads: 0,
              releaseTotal,
            });
          } else {
            release.assets.forEach((asset) => {
              tableRows.push({
                repo: repo.full_name,
                releaseDate: release.published_at ? formatDate(release.published_at) : 'Unknown',
                tag: release.tag_name || release.name || 'untagged',
                releaseName: release.name || release.tag_name || 'Untitled Release',
                assetName: asset.name || 'Unnamed asset',
                downloads: asset.download_count || 0,
                releaseTotal,
              });
            });
          }
        });
      }

      chartData = repoSummaries.sort((a, b) => b.totalDownloads - a.totalDownloads);
      updateChart(chartData, {
        labelKey: 'repo',
        valueKey: 'totalDownloads',
        title: `Repository download totals for ${rawInput}`,
        xAxisLabel: 'Repositories',
      });
      const nonZeroCount = chartData.filter((item) => item.totalDownloads > 0).length;
      setStatus(`Loaded ${repos.length} repos for ${rawInput}, ${nonZeroCount} with release downloads.`);
    }

    updateTable(tableRows);
    latestCsvData = createCsv(tableRows);
    exportButton.disabled = false;
  } catch (error) {
    setStatus(error.message, true);
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    tableBody.innerHTML = '';
  }
}

trackButton.addEventListener('click', loadStats);
repoInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    loadStats();
  }
});

exportButton.addEventListener('click', () => {
  if (latestCsvData) {
    downloadCsv(latestCsvData, repoInput.value.trim());
  }
});

toggleLegendButton.addEventListener('click', () => {
  if (!chartInstance) return;
  chartInstance.options.plugins.legend.display = !chartInstance.options.plugins.legend.display;
  chartInstance.update();
});

setStatus('Enter a repository or username and click Track Releases to begin.');
