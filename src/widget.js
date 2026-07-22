import { listenToMenu, listenToTheme } from './db';

const widgetContainer = document.getElementById('widgetContainer');
const widgetList = document.getElementById('widgetList');
const widgetLoading = document.getElementById('widgetLoading');
const widgetTitle = document.getElementById('widgetTitle');
const fullMenuLink = document.getElementById('fullMenuLink');

const urlParams = new URLSearchParams(window.location.search);
let restaurantId = urlParams.get('id');

// Fallback for clean URL structure e.g. /w/masalabar
if (!restaurantId) {
  const pathParts = window.location.pathname.split('/');
  if (pathParts.length >= 3 && pathParts[1] === 'w') {
    restaurantId = pathParts[2];
  }
}

if (!restaurantId) {
  widgetLoading.innerText = "Błąd: Brak ID restauracji.";
} else {
  // Config link
  const menuUrl = `${window.location.origin}/menu.html?id=${restaurantId}`;
  fullMenuLink.href = menuUrl;
  
  // Theme
  listenToTheme(restaurantId, (theme) => {
    widgetContainer.style.backgroundColor = theme.bgColor || '#1c1c1e';
    widgetContainer.style.color = theme.textColor || '#ffffff';
    widgetContainer.style.fontFamily = theme.fontFamily || "'Inter', sans-serif";
    widgetTitle.innerText = theme.restaurantName || "Nasze Menu";
  });

  // Menu items (Top 3)
  listenToMenu(restaurantId, (items) => {
    widgetLoading.style.display = 'none';
    renderWidgetMenu(items.slice(0, 3), restaurantId);
    if (items.length > 0) {
      fullMenuLink.style.display = 'block';
    } else {
      fullMenuLink.style.display = 'none';
    }
  });
}

function appendWidgetItem(item) {
  const div = document.createElement('div');
  div.className = 'widget-item';
  const priceFormatted = typeof item.price === 'number' ? `${item.price.toFixed(2)} zł` : '';
  
  div.innerHTML = `
    <div>
      <div class="widget-item-header">
        <div class="widget-item-name">${item.name}</div>
        ${priceFormatted ? `<div class="widget-item-price">${priceFormatted}</div>` : ''}
      </div>
      ${item.desc ? `<div class="widget-item-desc">${item.desc}</div>` : ''}
    </div>
  `;
  widgetList.appendChild(div);
}

function renderWidgetMenu(items, id) {
  const pitchOverlay = document.getElementById('pitchOverlay');
  const pitchTitle = document.getElementById('pitchTitle');
  const pitchDesc = document.getElementById('pitchDesc');
  const pitchBtn = document.getElementById('pitchBtn');
  
  widgetList.innerHTML = '';
  
  if (items.length === 0) {
    // Menu does not exist or has 0 items: show claim landing overlay
    pitchOverlay.classList.add('active');
    pitchOverlay.style.display = 'flex';
    
    if (pitchTitle) pitchTitle.innerText = "Przejmij ten link i skonfiguruj menu!";
    if (pitchDesc) {
      const displayName = id ? (id.charAt(0).toUpperCase() + id.slice(1)) : "swojej firmy";
      pitchDesc.innerText = `Menu dla "${displayName}" nie zostało jeszcze utworzone. Jesteś właścicielem? Skonfiguruj menu dla swojej firmy w 2 minuty.`;
    }
    if (pitchBtn) {
      pitchBtn.innerText = "Skonfiguruj menu dla swojej firmy";
      pitchBtn.href = `${window.location.origin}/dashboard.html?claim=${encodeURIComponent(id || '')}`;
    }
    
    // Generate mock items for the background blur template
    const mockItems = [
      { name: "Przykładowe Danie 1", desc: "Opis pysznego dania, które zachęci klientów.", price: 29.99 },
      { name: "Przykładowe Danie 2", desc: "Kolejna świetna propozycja z Twojego menu.", price: 34.50 },
      { name: "Przykładowy Deser", desc: "Słodki dodatek na koniec posiłku.", price: 15.00 }
    ];
    mockItems.forEach(appendWidgetItem);
  } else {
    // Menu exists and has items: hide landing overlay, display real items
    pitchOverlay.classList.remove('active');
    pitchOverlay.style.display = 'none';
    
    items.forEach(appendWidgetItem);
  }
}
