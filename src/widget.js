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
    renderWidgetMenu(items.slice(0, 3));
    if (items.length > 0) {
      fullMenuLink.style.display = 'block';
    }
  });
}

function renderWidgetMenu(items) {
  const pitchOverlay = document.getElementById('pitchOverlay');
  widgetList.innerHTML = '';
  
  let itemsToRender = items;
  
  if (items.length === 0) {
    // Show pitch overlay
    pitchOverlay.classList.add('active');
    // Generate mock items for the background blur
    itemsToRender = [
      { name: "Przykładowe Danie 1", desc: "Opis pysznego dania, które zachęci klientów.", price: 29.99 },
      { name: "Przykładowe Danie 2", desc: "Kolejna świetna propozycja z Twojego menu.", price: 34.50 },
      { name: "Przykładowy Deser", desc: "Słodki dodatek na koniec posiłku.", price: 15.00 }
    ];
  } else {
    pitchOverlay.classList.remove('active');
  }

  itemsToRender.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'widget-item';
    
    div.innerHTML = `
      <div style="flex: 1; padding-right: 12px;">
        <div class="widget-item-name">${item.name}</div>
        ${item.desc ? `<div class="widget-item-desc">${item.desc}</div>` : ''}
      </div>
      <div class="widget-item-price">
        ${item.price.toFixed(2)} zł
      </div>
    `;
    widgetList.appendChild(div);
  });
}
