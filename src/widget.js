import { listenToMenu, listenToTheme } from './db';

const widgetContainer = document.getElementById('widgetContainer');
const widgetList = document.getElementById('widgetList');
const widgetLoading = document.getElementById('widgetLoading');
const widgetTitle = document.getElementById('widgetTitle');
const fullMenuLink = document.getElementById('fullMenuLink');
const widgetFilters = document.getElementById('widgetFilters');

const urlParams = new URLSearchParams(window.location.search);
let restaurantId = urlParams.get('id');

// Fallback for clean URL structure e.g. /w/masalabar
if (!restaurantId) {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2 && pathParts[0] === 'w') {
    restaurantId = pathParts[1];
  } else if (pathParts.length === 1 && pathParts[0] !== 'widget' && pathParts[0] !== 'widget.html') {
    restaurantId = pathParts[0];
  }
}

let rawMenuItems = [];
let activeFilter = 'all';

if (!restaurantId) {
  widgetLoading.innerText = "Błąd: Brak ID restauracji.";
} else {
  // Config link
  const menuUrl = `${window.location.origin}/menu.html?id=${restaurantId}`;
  fullMenuLink.href = menuUrl;
  
  // Theme
  listenToTheme(restaurantId, (theme) => {
    if (theme.bgColor) widgetContainer.style.backgroundColor = theme.bgColor;
    if (theme.textColor) widgetContainer.style.color = theme.textColor;
    if (theme.fontFamily) widgetContainer.style.fontFamily = theme.fontFamily;
    widgetTitle.innerText = theme.restaurantName || "Nasze Menu";
  });

  // Menu items
  listenToMenu(restaurantId, (items) => {
    widgetLoading.style.display = 'none';
    rawMenuItems = items;
    renderCurrentState();
  });
}

// Setup filter button handlers
if (widgetFilters) {
  const filterBtns = widgetFilters.querySelectorAll('.filter-chip');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter || 'all';
      renderCurrentState();
    });
  });
}

function getItemTags(item) {
  const text = `${item.name || ''} ${item.desc || ''}`.toLowerCase();
  const tags = [];
  
  if (text.includes('wegan') || text.includes('wege') || text.includes('vege') || text.includes('vegan') || text.includes('warzyw') || text.includes('sałatk')) {
    tags.push({ label: '🌱 Wegańskie', type: 'wege' });
  }
  if (text.includes('bezgluten') || text.includes('gluten') || text.includes('gf')) {
    tags.push({ label: '🌾 Bezglutenowe', type: 'gf' });
  }
  if (text.includes('pikantn') || text.includes('ostre') || text.includes('spicy') || text.includes('curry') || text.includes('masala') || text.includes('chilli')) {
    tags.push({ label: '🌶️ Pikantne', type: 'spicy' });
  }
  return tags;
}

function appendWidgetItem(item) {
  const div = document.createElement('div');
  div.className = 'widget-item';
  const priceFormatted = typeof item.price === 'number' ? `${item.price.toFixed(2)} zł` : '';
  const tags = getItemTags(item);
  
  const tagsHtml = tags.length > 0 ? `
    <div class="item-badge-group">
      ${tags.map(t => `<span class="item-badge ${t.type}">${t.label}</span>`).join('')}
    </div>
  ` : '';

  div.innerHTML = `
    <div>
      <div class="widget-item-header">
        <div class="widget-item-name">${item.name}</div>
        ${priceFormatted ? `<div class="widget-item-price">${priceFormatted}</div>` : ''}
      </div>
      ${item.desc ? `<div class="widget-item-desc">${item.desc}</div>` : ''}
      ${tagsHtml}
    </div>
  `;
  widgetList.appendChild(div);
}

function renderCurrentState() {
  const pitchOverlay = document.getElementById('pitchOverlay');
  const pitchTitle = document.getElementById('pitchTitle');
  const pitchDesc = document.getElementById('pitchDesc');
  const pitchBtn = document.getElementById('pitchBtn');
  
  widgetList.innerHTML = '';
  
  if (rawMenuItems.length === 0) {
    // Menu does not exist or has 0 items: show claim landing overlay
    if (widgetFilters) widgetFilters.style.display = 'none';
    if (fullMenuLink) fullMenuLink.style.display = 'none';
    
    pitchOverlay.classList.add('active');
    pitchOverlay.style.display = 'flex';
    
    if (pitchTitle) pitchTitle.innerText = "Przejmij ten link i skonfiguruj menu!";
    if (pitchDesc) {
      const displayName = restaurantId ? (restaurantId.charAt(0).toUpperCase() + restaurantId.slice(1)) : "swojej firmy";
      pitchDesc.innerText = `Menu dla "${displayName}" nie zostało jeszcze utworzone. Jesteś właścicielem? Skonfiguruj menu dla swojej firmy w 2 minuty.`;
    }
    if (pitchBtn) {
      pitchBtn.innerText = "Skonfiguruj menu dla swojej firmy";
      pitchBtn.href = `${window.location.origin}/dashboard.html?claim=${encodeURIComponent(restaurantId || '')}`;
    }
    
    // Generate mock items for background template preview
    const mockItems = [
      { name: "Samosa Wegetariańska", desc: "Chrupiące pierożki z pikantnym nadzieniem warzywnym.", price: 22.00 },
      { name: "Paneer Tikka Masala", desc: "Ser paneer w sosie pomidorowym z aromatycznymi przyprawami.", price: 34.50 },
      { name: "Mango Lassi", desc: "Orzeźwiający napój jogurtowy z dojrzałego mango.", price: 16.00 }
    ];
    mockItems.forEach(appendWidgetItem);
  } else {
    // Menu exists and has items
    pitchOverlay.classList.remove('active');
    pitchOverlay.style.display = 'none';
    if (widgetFilters) widgetFilters.style.display = 'flex';
    if (fullMenuLink) fullMenuLink.style.display = 'block';
    
    // Apply active filter
    let filtered = rawMenuItems;
    if (activeFilter !== 'all') {
      filtered = rawMenuItems.filter(item => {
        const tags = getItemTags(item);
        return tags.some(t => t.type === activeFilter);
      });
    }
    
    if (filtered.length === 0) {
      widgetList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; opacity: 0.6; padding: 20px; font-size: 0.85rem;">Brak dań spełniających kryteria wybranego filtra.</div>';
    } else {
      filtered.slice(0, 4).forEach(appendWidgetItem);
    }
  }
}
