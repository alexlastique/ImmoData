/**
 * ImmoData - Main JavaScript (js/main.js)
 * Handles: Address Autocomplete (BAN API), Search routing, Debouncing, Quick suggestions
 */

(function () {
  'use strict';

  // Constants & Config
  const BAN_API_URL = 'https://api-adresse.data.gouv.fr/search/';
  const DEBOUNCE_DELAY_MS = 250;

  // Utility: Debounce function
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // Fetch address suggestions from Base Adresse Nationale (BAN)
  async function fetchAddressSuggestions(query) {
    if (!query || query.trim().length < 3) return [];

    try {
      const url = `${BAN_API_URL}?q=${encodeURIComponent(query)}&limit=5`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.warn('BAN Autocomplete error:', error);
      // Fallback local mock addresses if network error/offline
      return getLocalFallbackSuggestions(query);
    }
  }

  // Local fallback suggestions if network is blocked
  function getLocalFallbackSuggestions(query) {
    const q = query.toLowerCase();
    const defaults = [
      {
        properties: {
          label: '8 Rue de Londres, 75009 Paris',
          city: 'Paris',
          postcode: '75009',
          citycode: '75109',
          context: '75, Paris, Île-de-France',
          type: 'housenumber'
        },
        geometry: { coordinates: [2.3298, 48.8778] }
      },
      {
        properties: {
          label: 'Place Bellecour, 69002 Lyon',
          city: 'Lyon',
          postcode: '69002',
          citycode: '69382',
          context: '69, Rhône, Auvergne-Rhône-Alpes',
          type: 'street'
        },
        geometry: { coordinates: [4.8322, 45.7578] }
      },
      {
        properties: {
          label: 'Quai des Belges, 13001 Marseille',
          city: 'Marseille',
          postcode: '13001',
          citycode: '13201',
          context: '13, Bouches-du-Rhône, Provence-Alpes-Côte d\'Azur',
          type: 'street'
        },
        geometry: { coordinates: [5.3744, 43.2954] }
      },
      {
        properties: {
          label: 'Place de la Bourse, 33000 Bordeaux',
          city: 'Bordeaux',
          postcode: '33000',
          citycode: '33063',
          context: '33, Gironde, Nouvelle-Aquitaine',
          type: 'street'
        },
        geometry: { coordinates: [-0.5694, 44.8415] }
      },
      {
        properties: {
          label: 'Place Royale, 44000 Nantes',
          city: 'Nantes',
          postcode: '44000',
          citycode: '44109',
          context: '44, Loire-Atlantique, Pays de la Loire',
          type: 'street'
        },
        geometry: { coordinates: [-1.5583, 47.2144] }
      }
    ];

    return defaults.filter(item => 
      item.properties.label.toLowerCase().includes(q) || 
      item.properties.city.toLowerCase().includes(q)
    );
  }

  // Navigate to results page with query parameters
  function navigateToResults(item) {
    if (!item) return;

    const props = item.properties || {};
    const coords = item.geometry && item.geometry.coordinates ? item.geometry.coordinates : [2.3522, 48.8566];
    const lon = coords[0];
    const lat = coords[1];

    const label = props.label || props.name || 'Adresse sélectionnée';
    const city = props.city || '';
    const postcode = props.postcode || '';
    const insee = props.citycode || '';

    // Save to localStorage for quick retrieval & history
    localStorage.setItem('immo_last_query', label);
    localStorage.setItem('immo_last_lat', lat);
    localStorage.setItem('immo_last_lon', lon);
    localStorage.setItem('immo_last_city', city);
    localStorage.setItem('immo_last_insee', insee);
    localStorage.setItem('immo_last_postcode', postcode);

    const params = new URLSearchParams({
      q: label,
      lat: lat,
      lon: lon,
      city: city,
      insee: insee,
      postcode: postcode
    });

    window.location.href = `results.html?${params.toString()}`;
  }

  // Setup search input and dropdown for a given form
  function setupSearchComponent(formId, inputId, dropdownId, clearBtnId) {
    const form = document.getElementById(formId);
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const clearBtn = clearBtnId ? document.getElementById(clearBtnId) : null;

    if (!form || !input || !dropdown) return;

    let currentResults = [];
    let selectedIndex = -1;

    // Toggle clear button
    function updateClearButton() {
      if (clearBtn) {
        clearBtn.style.display = input.value.trim().length > 0 ? 'inline-flex' : 'none';
      }
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        updateClearButton();
        closeDropdown();
        input.focus();
      });
    }

    // Render dropdown results
    function renderDropdown(features) {
      currentResults = features;
      selectedIndex = -1;

      if (!features || features.length === 0) {
        dropdown.innerHTML = `
          <div class="autocomplete-item" style="cursor: default; color: var(--gray-500);">
            <div class="autocomplete-item-icon">⚠️</div>
            <div class="autocomplete-item-content">
              <div class="autocomplete-item-label">Aucune adresse trouvée</div>
              <div class="autocomplete-item-sub">Essayez de préciser le numéro, la rue ou le code postal</div>
            </div>
          </div>
        `;
        dropdown.classList.add('active');
        return;
      }

      dropdown.innerHTML = features.map((feat, index) => {
        const p = feat.properties;
        const icon = p.type === 'housenumber' ? '📍' : (p.type === 'municipality' ? '🏙️' : '🛣️');
        return `
          <div class="autocomplete-item" data-index="${index}" role="option">
            <div class="autocomplete-item-icon">${icon}</div>
            <div class="autocomplete-item-content">
              <div class="autocomplete-item-label">${p.label || p.name}</div>
              <div class="autocomplete-item-sub">${p.context || p.city || ''}</div>
            </div>
          </div>
        `;
      }).join('');

      dropdown.classList.add('active');

      // Click event on item
      dropdown.querySelectorAll('.autocomplete-item').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
          const idx = parseInt(itemEl.dataset.index, 10);
          if (currentResults[idx]) {
            navigateToResults(currentResults[idx]);
          }
        });
      });
    }

    function closeDropdown() {
      dropdown.classList.remove('active');
      selectedIndex = -1;
    }

    // Debounced search on input
    const onInputDebounced = debounce(async (e) => {
      const query = input.value.trim();
      updateClearButton();

      if (query.length < 3) {
        closeDropdown();
        return;
      }

      const features = await fetchAddressSuggestions(query);
      renderDropdown(features);
    }, DEBOUNCE_DELAY_MS);

    input.addEventListener('input', onInputDebounced);

    // Keyboard navigation (arrows + enter)
    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.autocomplete-item');
      if (!dropdown.classList.contains('active') || items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        updateSelectedHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateSelectedHighlight(items);
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && currentResults[selectedIndex]) {
          e.preventDefault();
          navigateToResults(currentResults[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    function updateSelectedHighlight(items) {
      items.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.classList.add('selected');
          input.value = currentResults[idx]?.properties?.label || input.value;
        } else {
          item.classList.remove('selected');
        }
      });
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!form.contains(e.target) && !dropdown.contains(e.target)) {
        closeDropdown();
      }
    });

    // Form submit fallback
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (!query) return;

      if (selectedIndex >= 0 && currentResults[selectedIndex]) {
        navigateToResults(currentResults[selectedIndex]);
        return;
      }

      if (currentResults.length > 0) {
        navigateToResults(currentResults[0]);
        return;
      }

      // Fetch first result directly
      const features = await fetchAddressSuggestions(query);
      if (features.length > 0) {
        navigateToResults(features[0]);
      } else {
        // Fallback default
        const mockItem = {
          properties: {
            label: query,
            city: query,
            postcode: '75001',
            citycode: '75101'
          },
          geometry: { coordinates: [2.3488, 48.8534] }
        };
        navigateToResults(mockItem);
      }
    });
  }

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', () => {
    // Landing page hero search
    setupSearchComponent('heroSearchForm', 'addressInput', 'autocompleteDropdown', 'clearSearchBtn');

    // Results page topbar search
    setupSearchComponent('resultsSearchForm', 'resultsAddressInput', 'resultsAutocompleteDropdown', null);

    // Quick tags click handlers (landing page)
    const quickTags = document.querySelectorAll('.quick-tag');
    quickTags.forEach(tag => {
      tag.addEventListener('click', async () => {
        const query = tag.dataset.query || tag.textContent.trim();
        const input = document.getElementById('addressInput');
        if (input) {
          input.value = query;
        }
        const features = await fetchAddressSuggestions(query);
        if (features.length > 0) {
          navigateToResults(features[0]);
        }
      });
    });
  });

  // Export to window for modular access
  window.ImmoData = window.ImmoData || {};
  window.ImmoData.fetchAddressSuggestions = fetchAddressSuggestions;
  window.ImmoData.navigateToResults = navigateToResults;
})();
